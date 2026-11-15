import { AuthError, googleAuthUrl, parseAuthRedirect, recoverPassword, refreshSession, signInWithPassword, signUp, supabaseConfigured, updatePassword, verifyRecoveryCode } from "../supabaseAuth";

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
const ENV = { ...process.env };

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co/";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-publica";
});
afterAll(() => { process.env = ENV; });

describe("Supabase Auth (REST)", () => {
  it("sin URL o sin clave pública no está configurado y no llama a la red", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "";
    expect(supabaseConfigured()).toBe(false);
    await expect(signInWithPassword("a@b.co", "x")).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inicia sesión con correo y contraseña enviando solo la clave pública", async () => {
    fetchMock.mockResolvedValue(reply(200, { access_token: "AT", refresh_token: "RT", expires_at: 1900000000 }));
    const s = await signInWithPassword("  rosa@example.com ", "Secreta123");
    expect(s).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: 1900000000 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://proyecto.supabase.co/auth/v1/token?grant_type=password");
    expect(init.headers.apikey).toBe("anon-publica");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ email: "rosa@example.com", password: "Secreta123" });
  });

  it("traduce los errores conocidos y no filtra el mensaje técnico", async () => {
    fetchMock.mockResolvedValue(reply(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }));
    await expect(signInWithPassword("a@b.co", "mal")).rejects.toMatchObject({ code: "invalid_credentials", message: "Correo o contraseña incorrectos.", status: 400 });
    fetchMock.mockResolvedValue(reply(400, { error_code: "email_not_confirmed" }));
    await expect(signInWithPassword("a@b.co", "x")).rejects.toThrow(/Confirma tu correo/);
    fetchMock.mockResolvedValue(reply(500, {}));
    await expect(signInWithPassword("a@b.co", "x")).rejects.toThrow(/no responde/);
    fetchMock.mockResolvedValue(reply(418, { error_code: "algo_raro", msg: "teapot" }));
    await expect(signInWithPassword("a@b.co", "x")).rejects.not.toThrow(/teapot/);
  });

  it("sin red informa que no hay conexión", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(signInWithPassword("a@b.co", "x")).rejects.toMatchObject({ code: "network" });
  });

  it("registra con nombre; si pide confirmar el correo no hay sesión todavía", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: "u1", email: "rosa@example.com" }));
    expect(await signUp("rosa@example.com", "Secreta123", " Rosa Pérez ")).toEqual({ session: null, needsConfirmation: true });
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body)).toEqual({ email: "rosa@example.com", password: "Secreta123", data: { full_name: "Rosa Pérez" } });
    fetchMock.mockResolvedValue(reply(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
    const r = await signUp("rosa@example.com", "Secreta123", "Rosa");
    expect(r.needsConfirmation).toBe(false);
    expect(r.session?.accessToken).toBe("AT");
  });

  it("recuperar contraseña manda el enlace de retorno a la app", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await recoverPassword("rosa@example.com", "eva://auth-callback");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://proyecto.supabase.co/auth/v1/recover?redirect_to=eva%3A%2F%2Fauth-callback");
  });

  it("renueva la sesión con el token de renovación; si ya no sirve, pide entrar de nuevo", async () => {
    fetchMock.mockResolvedValue(reply(200, { access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }));
    expect((await refreshSession("RT")).accessToken).toBe("AT2");
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("grant_type=refresh_token");
    fetchMock.mockResolvedValue(reply(400, { error_code: "refresh_token_not_found" }));
    await expect(refreshSession("viejo")).rejects.toThrow(/sesión venció/);
  });

  it("Google: arma la dirección y lee la sesión del fragmento de retorno", () => {
    expect(googleAuthUrl("eva://auth-callback")).toBe("https://proyecto.supabase.co/auth/v1/authorize?provider=google&redirect_to=eva%3A%2F%2Fauth-callback");
    expect(parseAuthRedirect("eva://auth-callback#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer")).toMatchObject({ accessToken: "AT", refreshToken: "RT" });
    expect(() => parseAuthRedirect("eva://auth-callback#error=access_denied&error_code=access_denied")).toThrow(AuthError);
    expect(() => parseAuthRedirect("eva://auth-callback")).toThrow(/No se recibió la sesión/);
  });

  it("canjea el código de recuperación y devuelve la sesión", async () => {
    fetchMock.mockResolvedValue(reply(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
    const sess = await verifyRecoveryCode(" rosa@example.com ", "123 456");
    expect(sess.accessToken).toBe("AT");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe("https://proyecto.supabase.co/auth/v1/verify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ type: "recovery", email: "rosa@example.com", token: "123456" });
  });

  it("un código vencido o equivocado se informa en español", async () => {
    fetchMock.mockResolvedValue(reply(403, { error_code: "otp_expired", msg: "Token has expired or is invalid" }));
    await expect(verifyRecoveryCode("a@b.co", "000000")).rejects.toMatchObject({ code: "otp_expired", message: "El código no es válido o ya venció. Pide uno nuevo." });
  });

  it("cambia la contraseña con PUT /user y el token de la persona", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await updatePassword("AT", "Nueva1234");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://proyecto.supabase.co/auth/v1/user");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer AT");
    expect(init.headers.apikey).toBe("anon-publica");
    expect(JSON.parse(init.body)).toEqual({ password: "Nueva1234" });
  });

  it("rechaza una contraseña igual a la actual con un mensaje claro", async () => {
    fetchMock.mockResolvedValue(reply(422, { error_code: "same_password" }));
    await expect(updatePassword("AT", "Igual1234")).rejects.toThrow(/distinta a la actual/);
  });
});
