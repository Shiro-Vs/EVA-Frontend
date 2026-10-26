import AsyncStorage from "@react-native-async-storage/async-storage";
import { _cacheReset } from "../cache";
import { ApiError, devLogin, newKey, request, session } from "../http";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("../storage", () => {
  const mem: Record<string, string> = {};
  return {
    KEYS: { token: "eva.token", apiUrl: "eva.api_url" },
    storage: {
      get: jest.fn(async (k: string) => mem[k] ?? null),
      set: jest.fn(async (k: string, v: string) => { mem[k] = v; }),
      remove: jest.fn(async (k: string) => { delete mem[k]; }),
    },
  };
});

type FetchInit = { method: string; headers: Record<string, string>; body?: string };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
});
const fetchMock = jest.fn();
beforeEach(async () => {
  await AsyncStorage.clear(); _cacheReset();
  session._reset();
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  await session.setBaseUrl("http://api.test/v1/");
  await session.setToken("tok123");
});

describe("request", () => {
  it("envía el token, la URL base sin barra final y parsea JSON", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: "1" }, { etag: '"3"' }));
    const r = await request<{ id: string }>("GET", "/me");
    const [url, init] = fetchMock.mock.calls[0] as [string, FetchInit];
    expect(url).toBe("http://api.test/v1/me");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(r.data).toEqual({ id: "1" });
    expect(r.version).toBe(3);
    expect(r.replayed).toBe(false);
  });

  it("PATCH lleva If-Match entre comillas; POST lleva Idempotency-Key solo si se pasa", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await request("PATCH", "/accounts/1", { body: { name: "x" }, version: 4 });
    await request("POST", "/operations", { body: {}, idempotencyKey: "key-12345678" });
    await request("POST", "/contacts", { body: {} });
    const h = (i: number) => (fetchMock.mock.calls[i] as [string, FetchInit])[1].headers;
    expect(h(0)["If-Match"]).toBe('"4"');
    expect(h(0)["Content-Type"]).toBe("application/json");
    expect(h(1)["Idempotency-Key"]).toBe("key-12345678");
    expect(h(2)["Idempotency-Key"]).toBeUndefined();
  });

  it("arma la query sin parámetros indefinidos", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await request("GET", "/subscriptions/1/cost-summary", { query: { cycleId: undefined, limit: 5 } });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://api.test/v1/subscriptions/1/cost-summary?limit=5");
  });

  it("marca las respuestas reenviadas por idempotencia", async () => {
    fetchMock.mockResolvedValue(reply(201, {}, { "idempotency-replayed": "true" }));
    expect((await request("POST", "/receipts", { body: {}, idempotencyKey: "k-12345678" })).replayed).toBe(true);
  });

  it("convierte el formato de error uniforme en ApiError", async () => {
    fetchMock.mockResolvedValue(reply(422, { error: { code: "OVER_ALLOCATION", message: "Allocation exceeds", details: [{ a: 1 }], requestId: "r1" } }));
    const err = await request("POST", "/receipts", { body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "OVER_ALLOCATION", requestId: "r1", details: [{ a: 1 }] });
  });

  it("un 401 avisa para cerrar la sesión", async () => {
    const cb = jest.fn();
    session.onUnauthorized(cb);
    fetchMock.mockResolvedValue(reply(401, { error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }));
    await expect(request("GET", "/me")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("un fallo de red se informa como NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(request("GET", "/me")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("una respuesta sin cuerpo y no válida no rompe", async () => {
    fetchMock.mockResolvedValue(reply(500, undefined));
    await expect(request("GET", "/me")).rejects.toMatchObject({ status: 500, code: "UNKNOWN_ERROR" });
  });
});

describe("newKey", () => {
  it("genera claves distintas con formato UUID", () => {
    const a = newKey(), b = newKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("devLogin", () => {
  it("pide el token a /dev/login quitando el sufijo /v1", async () => {
    fetchMock.mockResolvedValue(reply(200, { token: "abc" }));
    expect(await devLogin("http://api.test:3000/v1/")).toBe("abc");
    expect((fetchMock.mock.calls[0] as [string, FetchInit])[0]).toBe("http://api.test:3000/dev/login");
  });
  it("si el servidor no lo habilita (404) lo informa", async () => {
    fetchMock.mockResolvedValue(reply(404, { error: { code: "NOT_FOUND", message: "x", requestId: "r" } }));
    await expect(devLogin("http://api.test/v1")).rejects.toMatchObject({ code: "DEV_LOGIN_DISABLED" });
  });
});
