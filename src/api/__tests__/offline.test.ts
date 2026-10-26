import AsyncStorage from "@react-native-async-storage/async-storage";
import { _cacheReset, cacheClear, cacheRead, cacheWrite } from "../cache";
import { connectivity } from "../connectivity";
import { request, session } from "../http";

jest.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => mem.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { mem.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { mem.delete(k); }),
      multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => mem.delete(k)); }),
      getAllKeys: jest.fn(async () => [...mem.keys()]),
      clear: jest.fn(async () => { mem.clear(); }),
    },
  };
});
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

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
});
const fetchMock = jest.fn();
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  session._reset(); _cacheReset(); connectivity._reset();
  await AsyncStorage.clear();
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  await session.setBaseUrl("http://api.test/v1");
  await session.setToken("tok-a");
});

describe("Sin conexión solo se consulta (RN-OF01…OF05)", () => {
  it("una lectura correcta se guarda y, sin red, se sirve de la caché con su fecha", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { balance: "173.00" }, { etag: '"4"' }));
    await request("GET", "/accounts/1");
    await flush();
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    const r = await request<{ balance: string }>("GET", "/accounts/1");
    expect(r.data).toEqual({ balance: "173.00" });
    expect(r.version).toBe(4);
    expect(r.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(connectivity.get()).toMatchObject({ offline: true, dataAt: r.cachedAt });
  });

  it("al volver la conexión la siguiente lectura quita el aviso", async () => {
    connectivity.setOffline("2026-10-25T10:00:00.000Z");
    fetchMock.mockResolvedValueOnce(reply(200, {}));
    await request("GET", "/me");
    expect(connectivity.get().offline).toBe(false);
  });

  it("la caché distingue la consulta (query) de cada lectura", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { items: ["a"] }));
    await request("GET", "/operations", { query: { accountId: "1" } });
    await flush();
    fetchMock.mockRejectedValueOnce(new TypeError("x"));
    await expect(request("GET", "/operations", { query: { accountId: "2" } })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("una lectura que nunca se guardó falla con un mensaje claro", async () => {
    fetchMock.mockRejectedValue(new TypeError("x"));
    await expect(request("GET", "/contacts")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR", message: expect.stringContaining("todavía no estaba guardada") });
  });

  it("una escritura sin red NUNCA se finge confirmada ni sale de la caché", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: "x" }));
    await request("GET", "/operations/1");
    await flush();
    fetchMock.mockRejectedValue(new TypeError("x"));
    const err = await request("POST", "/operations", { body: { amount: "1.00" }, idempotencyKey: "k-12345678" }).catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(err.message).toContain("no se duplicará");
    expect(connectivity.get().offline).toBe(false); // un POST fallido no muestra datos viejos como si fueran actuales
    expect(await cacheRead("/operations")).toBeNull();
  });

  it("un error del servidor (4xx/5xx) no se confunde con falta de conexión ni se cachea", async () => {
    fetchMock.mockResolvedValue(reply(500, { error: { code: "INTERNAL_ERROR", message: "x" } }));
    await expect(request("GET", "/me")).rejects.toMatchObject({ status: 500 });
    expect(await cacheRead("/me")).toBeNull();
    expect(connectivity.get().offline).toBe(false);
  });

  it("cerrar sesión o entrar otro usuario borra la caché (RN-OF04)", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { n: 1 }));
    await request("GET", "/me");
    await flush();
    expect(await cacheRead("/me")).not.toBeNull();
    await session.setToken("tok-a"); // mismo usuario: se conserva
    expect(await cacheRead("/me")).not.toBeNull();
    await session.setToken("tok-b"); // otro usuario
    expect(await cacheRead("/me")).toBeNull();
    fetchMock.mockResolvedValueOnce(reply(200, { n: 2 }));
    await request("GET", "/me");
    await flush();
    await session.setToken(null); // cierre de sesión
    expect(await cacheRead("/me")).toBeNull();
  });

  it("no guarda respuestas enormes y acota la cantidad de lecturas guardadas", async () => {
    await cacheWrite("/grande", { at: "2026-10-25T00:00:00.000Z", data: "x".repeat(450_000) });
    expect(await cacheRead("/grande")).toBeNull();
    for (let i = 0; i < 160; i++) await cacheWrite(`/r${i}`, { at: "2026-10-25T00:00:00.000Z", data: i });
    expect(await cacheRead("/r0")).toBeNull(); // las más viejas se descartan
    expect(await cacheRead("/r159")).toEqual({ at: "2026-10-25T00:00:00.000Z", data: 159 });
    await cacheClear();
    expect(await cacheRead("/r159")).toBeNull();
  });

  it("conserva la fecha más antigua de lo que se está mostrando", () => {
    connectivity.setOffline("2026-10-25T12:00:00.000Z");
    connectivity.setOffline("2026-10-25T09:00:00.000Z");
    connectivity.setOffline("2026-10-25T11:00:00.000Z");
    expect(connectivity.get().dataAt).toBe("2026-10-25T09:00:00.000Z");
  });
});
