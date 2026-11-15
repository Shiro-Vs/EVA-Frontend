// Inicio de sesión con Supabase Auth por su API REST (sin librería): correo y contraseña, registro, recuperación y Google.
// La URL del proyecto y la clave pública («anon») son PÚBLICAS por diseño; nunca va aquí una clave de servicio ni una contraseña guardada.

const config = () => ({
  url: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, ""),
  anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
});

export const supabaseConfigured = () => { const c = config(); return c.url !== "" && c.anon !== ""; };

export interface AuthSession { accessToken: string; refreshToken: string | null; /** Epoch en segundos. */ expiresAt: number | null }

export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0, /** Segundos de espera que pide el servidor (límite de correos). */ public readonly retryAfter?: number) { super(message); this.name = "AuthError"; }
}

const TEXT: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar: te enviamos un enlace.",
  user_already_exists: "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
  email_exists: "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
  weak_password: "La contraseña es muy débil: usa al menos 8 caracteres con mayúscula y número.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  over_email_send_rate_limit: "Ya te enviamos un correo hace poco. Espera unos minutos.",
  signup_disabled: "El registro está desactivado.",
  refresh_token_not_found: "Tu sesión venció. Vuelve a entrar.",
  refresh_token_already_used: "Tu sesión venció. Vuelve a entrar.",
  session_expired: "Tu sesión venció. Vuelve a entrar.",
  bad_id_token: "No se pudo validar tu cuenta de Google. Inténtalo otra vez.",
  provider_disabled: "El inicio con Google no está activado.",
  otp_expired: "El código no es válido o ya venció. Pide uno nuevo.",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  bad_jwt: "Tu sesión venció. Vuelve a entrar.",
};

async function call<T>(path: string, body: unknown, query = "", o: { method?: "POST" | "PUT"; bearer?: string } = {}): Promise<T> {
  const { url, anon } = config();
  if (!url || !anon) throw new AuthError("not_configured", "El inicio de sesión real todavía no está configurado en esta versión.");
  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1${path}${query}`, { method: o.method ?? "POST", headers: { apikey: anon, "Content-Type": "application/json", ...(o.bearer ? { Authorization: `Bearer ${o.bearer}` } : {}) }, body: JSON.stringify(body) });
  } catch {
    throw new AuthError("network", "No hay conexión. Revisa tu internet e inténtalo otra vez.");
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok) {
    const code = String(json.error_code ?? json.code ?? json.error ?? "unknown");
    if (code === "over_email_send_rate_limit") {
      const wait = Number(/(\d+)\s*seconds?/i.exec(String(json.msg ?? json.message ?? ""))?.[1]);
      if (wait > 0) throw new AuthError(code, `Espera ${wait} ${wait === 1 ? "segundo" : "segundos"} antes de pedir otro código.`, res.status, wait);
    }
    // El mensaje original de Supabase está en inglés: se traduce lo conocido y lo demás se muestra genérico.
    throw new AuthError(code, TEXT[code] ?? (res.status >= 500 ? "El servicio de inicio de sesión no responde. Inténtalo más tarde." : "No se pudo completar la acción. Revisa los datos."), res.status);
  }
  return json as T;
}

interface TokenResponse { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number }
const toSession = (r: TokenResponse): AuthSession | null =>
  r.access_token ? { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, expiresAt: r.expires_at ?? (r.expires_in ? Math.floor(Date.now() / 1000) + r.expires_in : null) } : null;

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const s = toSession(await call<TokenResponse>("/token", { email: email.trim(), password }, "?grant_type=password"));
  if (!s) throw new AuthError("unknown", "No se pudo iniciar sesión.");
  return s;
}

/** Con confirmación de correo activada no hay sesión todavía: `needsConfirmation` indica que hay que abrir el enlace del correo. */
/** Entra con el ID token que entrega la hoja nativa de cuentas de Google (Supabase lo valida con el ID de cliente web). */
export async function signInWithGoogleIdToken(idToken: string): Promise<AuthSession> {
  const s = toSession(await call<TokenResponse>("/token", { provider: "google", id_token: idToken }, "?grant_type=id_token"));
  if (!s) throw new AuthError("unknown", "No se pudo iniciar sesión con Google.");
  return s;
}

export async function signUp(email: string, password: string, fullName: string): Promise<{ session: AuthSession | null; needsConfirmation: boolean }> {
  const r = await call<TokenResponse & { user?: unknown }>("/signup", { email: email.trim(), password, data: { full_name: fullName.trim() } });
  const session = toSession(r);
  return { session, needsConfirmation: !session };
}

export async function recoverPassword(email: string, redirectTo?: string): Promise<void> {
  await call<unknown>("/recover", { email: email.trim() }, redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "");
}

/** Canjea el código de 6 dígitos que llega por correo al recuperar la contraseña: devuelve una sesión para poder fijar la nueva. */
export async function verifyRecoveryCode(email: string, code: string): Promise<AuthSession> {
  const s = toSession(await call<TokenResponse>("/verify", { type: "recovery", email: email.trim(), token: code.replace(/\s+/g, "") }));
  if (!s) throw new AuthError("otp_expired", TEXT.otp_expired!);
  return s;
}

/** Cambia la contraseña de la persona dueña del token. */
export async function updatePassword(accessToken: string, password: string): Promise<void> {
  await call<unknown>("/user", { password }, "", { method: "PUT", bearer: accessToken });
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const s = toSession(await call<TokenResponse>("/token", { refresh_token: refreshToken }, "?grant_type=refresh_token"));
  if (!s) throw new AuthError("session_expired", TEXT.session_expired!);
  return s;
}

/** Dirección que abre el navegador para entrar con Google; Supabase devuelve a `redirectTo` con la sesión en el fragmento (#). */
export function googleAuthUrl(redirectTo: string): string {
  const { url } = config();
  return `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

/** Lee la sesión que Supabase deja en el fragmento de la dirección de retorno (#access_token=…&refresh_token=…). */
export function parseAuthRedirect(redirectUrl: string): AuthSession {
  const frag = redirectUrl.includes("#") ? redirectUrl.slice(redirectUrl.indexOf("#") + 1) : "";
  const p = new URLSearchParams(frag);
  const err = p.get("error_code") ?? p.get("error");
  if (err) throw new AuthError(err, TEXT[err] ?? "No se pudo entrar con Google.");
  const s = toSession({ access_token: p.get("access_token") ?? undefined, refresh_token: p.get("refresh_token") ?? undefined, expires_at: p.get("expires_at") ? Number(p.get("expires_at")) : undefined, expires_in: p.get("expires_in") ? Number(p.get("expires_in")) : undefined });
  if (!s) throw new AuthError("no_session", "No se recibió la sesión de Google. Inténtalo otra vez.");
  return s;
}
