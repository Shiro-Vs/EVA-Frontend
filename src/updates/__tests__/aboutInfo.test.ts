import {
  channelLabel,
  extractManifestDate,
  extractManifestId,
  formatBuildDate,
  healthUrlFromApiBase,
  hostLabel,
  shortId,
} from "../aboutInfo";

describe("aboutInfo", () => {
  it("acorta IDs de actualización y maneja valores vacíos", () => {
    expect(shortId("036b56e2-38fa-45b0-ba09-23bfca085b08")).toBe("036b56e2");
    expect(shortId("  abcdef123456 ")).toBe("abcdef12");
    expect(shortId(null)).toBe("—");
    expect(shortId("")).toBe("—");
  });

  it("traduce el nombre del canal según estado de Updates", () => {
    expect(channelLabel("preview", false)).toBe("Desarrollo");
    expect(channelLabel("preview", true)).toBe("Preview");
    expect(channelLabel("production", true)).toBe("Producción");
    expect(channelLabel("staging", true)).toBe("Staging");
    expect(channelLabel(null, true)).toBe("Sin canal");
  });

  it("formatea fechas válidas y devuelve guion en fechas inválidas", () => {
    expect(formatBuildDate(null)).toBe("—");
    expect(formatBuildDate("no-es-fecha")).toBe("—");
    const formatted = formatBuildDate("2026-11-21T15:10:00.000Z");
    expect(formatted).not.toBe("—");
    expect(formatted).toContain("2026");
  });

  it("extrae id y createdAt de manifiestos de forma segura", () => {
    expect(extractManifestId({ id: "036b56e2-38fa" })).toBe("036b56e2-38fa");
    expect(extractManifestId(null)).toBeNull();
    expect(extractManifestDate({ createdAt: "2026-11-21T15:10:00Z" })).toBe("2026-11-21T15:10:00Z");
    expect(extractManifestDate({})).toBeNull();
  });

  it("deriva la URL de salud y etiqueta del servidor desde la base de la API", () => {
    expect(healthUrlFromApiBase("https://api.eva-app.lat/v1")).toBe("https://api.eva-app.lat/healthz");
    expect(healthUrlFromApiBase("https://api.eva-app.lat/v1/")).toBe("https://api.eva-app.lat/healthz");
    expect(healthUrlFromApiBase("http://localhost:3000/v1")).toBe("http://localhost:3000/healthz");
    expect(hostLabel("https://api.eva-app.lat/v1")).toBe("api.eva-app.lat");
    expect(hostLabel("http://localhost:3000/v1/")).toBe("localhost:3000");
  });
});
