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
let urlCache: string | undefined;
let onUnauthorized: (() => void) | undefined;

export const session = {
  /** La app registra aquí qué hacer ante un 401 (cerrar sesión). */
  onUnauthorized(fn: () => void) { onUnauthorized = fn; },
  async getToken() {
    if (tokenCache === undefined) tokenCache = await storage.get(KEYS.token);
    return tokenCache;
  },
  async setToken(token: string | null) {
    tokenCache = token;
    if (token) await storage.set(KEYS.token, token);
    else await storage.remove(KEYS.token);
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
  _reset() { tokenCache = undefined; urlCache = undefined; onUnauthorized = undefined; },
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
  /** Versión del recurso (cabecera ETag), si la hay. */
  version?: number;
  replayed: boolean;
}

export async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
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

  let res: Response;
  try {
    res = await fetch(`${base}${path}${qs}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor");
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null)?.error;
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, e?.code ?? "UNKNOWN_ERROR", e?.message ?? `Error ${res.status}`, e?.details, e?.requestId);
  }
  const etag = res.headers.get("etag");
  return {
    data: json as T,
    version: etag ? Number(etag.replace(/"/g, "")) || undefined : undefined,
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
