import { cacheClear, cacheRead, cacheWrite } from "./cache";
import { connectivity } from "./connectivity";
import { KEYS, storage } from "./storage";

/** Error de la API con el formato uniforme de docs/especificacion/13 §3. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/v1";

let tokenCache: string | null | undefined;
let refreshCache: string | null | undefined;
let refresher: (() => Promise<string | null>) | undefined;
let refreshing: Promise<string | null> | null = null;

/** Identificador de la persona dentro de un JWT (sin verificarlo: solo para saber si cambió de usuario). */
function subOf(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const b64 = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(globalThis.atob(b64)) as { sub?: string }).sub ?? null;
  } catch { return null; }
}
let urlCache: string | undefined;
let onUnauthorized: (() => void) | undefined;

export const session = {
  /** La app registra cómo renovar el token ante un 401 (devuelve el token nuevo o null si ya no se puede). */
  setRefresher(fn: (() => Promise<string | null>) | undefined) { refresher = fn; },
  async getRefreshToken() {
    if (refreshCache === undefined) refreshCache = await storage.get(KEYS.refresh);
    return refreshCache;
  },
  async setRefreshToken(token: string | null) {
    refreshCache = token;
    if (token) await storage.set(KEYS.refresh, token);
    else await storage.remove(KEYS.refresh);
  },
  /** La app registra aquí qué hacer ante un 401 (cerrar sesión). */
  onUnauthorized(fn: () => void) { onUnauthorized = fn; },
  async getToken() {
    if (tokenCache === undefined) tokenCache = await storage.get(KEYS.token);
    return tokenCache;
  },
  async setToken(token: string | null) {
    // La caché es de UNA sesión: al cerrar sesión o entrar otro usuario se borra (RN-OF04).
    const previous = tokenCache === undefined ? await storage.get(KEYS.token) : tokenCache;
    // Renovar el token de la MISMA persona no borra la caché; cambiar de persona o cerrar sesión, sí.
    const sameUser = previous && token && (subOf(previous) !== null && subOf(token) !== null ? subOf(previous) === subOf(token) : previous === token);
    if (!sameUser && previous !== token) { await cacheClear(); connectivity.setOnline(); }
    tokenCache = token;
    if (token) await storage.set(KEYS.token, token);
    else { await storage.remove(KEYS.token); await session.setRefreshToken(null); }
  },
  async getBaseUrl() {
    if (urlCache === undefined) urlCache = (await storage.get(KEYS.apiUrl)) || DEFAULT_URL;
    return urlCache as string;
  },
  async setBaseUrl(url: string) {
    urlCache = url.trim().replace(/\/+$/, "");
    await storage.set(KEYS.apiUrl, urlCache);
  },
  /** Solo para pruebas. */
  _reset() { tokenCache = undefined; refreshCache = undefined; urlCache = undefined; onUnauthorized = undefined; refresher = undefined; refreshing = null; },
};

/** UUID v4 para claves de idempotencia. Basta con que no se repita entre acciones del usuario. */
export function newKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Versión del recurso para If-Match (PATCH). */
  version?: number;
  /** Clave de idempotencia: reintentar con la MISMA clave devuelve el resultado ya guardado. */
  idempotencyKey?: string;
}

export interface ApiResponse<T> {
  data: T;
  /** Si no hubo red y la lectura se sirvió desde la caché: de cuándo son los datos. */
  cachedAt?: string;
  /** Versión del recurso (cabecera ETag), si la hay. */
  version?: number;
  replayed: boolean;
}

async function refreshOnce(): Promise<string | null> {
  if (!refresher) return null;
  refreshing ??= refresher().catch(() => null).finally(() => { refreshing = null; });
  return refreshing;
}

export async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, opts: RequestOptions = {}, retried = false): Promise<ApiResponse<T>> {
  const base = await session.getBaseUrl();
  const token = await session.getToken();
  const qs = opts.query
    ? "?" + Object.entries(opts.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.version !== undefined) headers["If-Match"] = `"${opts.version}"`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const cacheKey = `${path}${qs}`;
  let res: Response;
  try {
    res = await fetch(`${base}${path}${qs}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    // Sin red solo se CONSULTA: una lectura se sirve de la caché; una escritura nunca se finge confirmada (RN-OF01, RN-OF05).
    if (method === "GET") {
      const hit = await cacheRead(cacheKey);
      if (hit) { connectivity.setOffline(hit.at); return { data: hit.data as T, version: hit.version, replayed: false, cachedAt: hit.at }; }
      throw new ApiError(0, "NETWORK_ERROR", "Sin conexión, y esta información todavía no estaba guardada en tu teléfono.");
    }
    throw new ApiError(0, "NETWORK_ERROR", "Se perdió la conexión. Sin internet solo se puede consultar; si tocaste Guardar, reintenta: no se duplicará.");
  }
  connectivity.setOnline();

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null)?.error;
    if (res.status === 401) {
      // Un token vencido se renueva una vez y se reintenta (la misma clave de idempotencia evita duplicar); si no se puede, se cierra la sesión.
      if (!retried && (await refreshOnce())) return request<T>(method, path, opts, true);
      onUnauthorized?.();
    }
    throw new ApiError(res.status, e?.code ?? "UNKNOWN_ERROR", e?.message ?? `Error ${res.status}`, e?.details, e?.requestId);
  }
  const etag = res.headers.get("etag");
  const version = etag ? Number(etag.replace(/"/g, "")) || undefined : undefined;
  if (method === "GET") void cacheWrite(cacheKey, { at: new Date().toISOString(), version, data: json });
  return {
    data: json as T,
    version,
    replayed: res.headers.get("idempotency-replayed") === "true",
  };
}

/** Descarga un archivo (PDF, respaldo) con la sesión actual. */
export async function requestBytes(path: string, query?: Record<string, string | number | undefined>): Promise<{ bytes: Uint8Array; filename: string | null }> {
  const base = await session.getBaseUrl();
  const token = await session.getToken();
  const qs = query ? "?" + Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : "";
  let res: Response;
  try { res = await fetch(`${base}${path}${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch { throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor"); }
  if (!res.ok) {
    let e: { code?: string; message?: string } | undefined;
    try { e = ((await res.json()) as { error?: { code?: string; message?: string } }).error; } catch { e = undefined; }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, e?.code ?? "UNKNOWN_ERROR", e?.message ?? `Error ${res.status}`);
  }
  const cd = res.headers.get("content-disposition") ?? "";
  return { bytes: new Uint8Array(await res.arrayBuffer()), filename: /filename="([^"]+)"/.exec(cd)?.[1] ?? null };
}

/** Acceso de desarrollo: pide al backend (solo con AUTH_MODE=dev) un token del usuario de desarrollo. */
export async function devLogin(baseUrl: string): Promise<string> {
  const root = baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
  let res: Response;
  try {
    res = await fetch(`${root}/dev/login`, { method: "POST" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor");
  }
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? "DEV_LOGIN_DISABLED" : "UNKNOWN_ERROR", "El acceso de desarrollo no está habilitado en este servidor");
  return (JSON.parse(await res.text()) as { token: string }).token;
}
