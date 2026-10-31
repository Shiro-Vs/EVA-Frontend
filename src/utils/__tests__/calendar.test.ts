import { daysInMonth, formatDateTyping, monthGrid, parseIso, shiftMonth, toIso } from "../calendar";

describe("Escritura de fechas", () => {
  it("acepta solo dígitos y pone los guiones solos", () => {
    expect(formatDateTyping("2026")).toBe("2026");
    expect(formatDateTyping("20261")).toBe("2026-1");
    expect(formatDateTyping("202611")).toBe("2026-11");
    expect(formatDateTyping("2026110")).toBe("2026-11-0");
    expect(formatDateTyping("20261105")).toBe("2026-11-05");
  });

  it("descarta letras, símbolos y lo que sobra", () => {
    expect(formatDateTyping("2a0b2-6/1.1x0 5")).toBe("2026-11-05");
    expect(formatDateTyping("2026-11-05999")).toBe("2026-11-05");
    expect(formatDateTyping("abc")).toBe("");
  });

  it("borrar el último dígito no deja guiones colgando", () => {
    expect(formatDateTyping("2026-1".slice(0, -1))).toBe("2026");
    expect(formatDateTyping("2026-11-0".slice(0, -1))).toBe("2026-11");
  });
});

describe("Calendario", () => {
  it("valida fechas reales (no existe el 31 de febrero ni el mes 13)", () => {
    expect(parseIso("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseIso("2026-02-29")).toBeNull();
    expect(parseIso("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIso("2026-13-01")).toBeNull();
    expect(parseIso("2026-04-31")).toBeNull();
    expect(parseIso("2026-4-1")).toBeNull();
  });

  it("cuenta los días de cada mes", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
  });

  it("arma la cuadrícula con la semana desde el lunes", () => {
    const g = monthGrid(2026, 10); // el 1 de octubre de 2026 es jueves
    expect(g[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter((d) => d !== null)).toHaveLength(31);
    expect(g[g.length - 1]![6] ?? null).toBeNull; // la última semana se completa con huecos
  });

  it("cambia de mes cruzando el año", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 10, 14)).toEqual({ year: 2027, month: 12 });
  });

  it("compone la fecha ISO con ceros", () => {
    expect(toIso(2026, 3, 7)).toBe("2026-03-07");
  });
});
