import { shouldCheckForUpdate, UPDATE_CHECK_GAP_MS } from "../throttle";

describe("cada cuánto se busca una actualización", () => {
  it("la primera vez siempre se busca", () => {
    expect(shouldCheckForUpdate(null, 1_000)).toBe(true);
  });

  it("no se vuelve a buscar hasta que pasen 10 minutos", () => {
    const t0 = 5_000_000;
    expect(shouldCheckForUpdate(t0, t0 + 60_000)).toBe(false);
    expect(shouldCheckForUpdate(t0, t0 + UPDATE_CHECK_GAP_MS - 1)).toBe(false);
    expect(shouldCheckForUpdate(t0, t0 + UPDATE_CHECK_GAP_MS)).toBe(true);
  });
});
