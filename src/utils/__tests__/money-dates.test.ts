import { addMonthsIso, humanDate, humanRange, isIsoDate, todayLocalIso } from "../dates";
import { intervalLabel } from "../intervals";
import { cmpMoney, formatSoles, normalizeMoneyInput, pctOf, suggestAllocation } from "../money";

describe("formatSoles", () => {
  it.each([
    ["20.00", "S/ 20.00"], ["0.05", "S/ 0.05"], ["1234.5", "S/ 1,234.50"], ["1000000.00", "S/ 1,000,000.00"],
    ["-100.00", "-S/ 100.00"], ["7", "S/ 7.00"],
  ])("%s → %s", (input, expected) => expect(formatSoles(input)).toBe(expected));
  it("sin valor", () => { expect(formatSoles(null)).toBe("S/ —"); expect(formatSoles("")).toBe("S/ —"); });
});

describe("normalizeMoneyInput", () => {
  it.each([["12,5", "12.50"], ["12", "12.00"], ["0.5", "0.50"], ["007.10", "7.10"], ["  20.00 ", "20.00"], ["0", "0.00"]])("%s → %s", (i, e) => expect(normalizeMoneyInput(i)).toBe(e));
  it.each(["", "1.234", "abc", "1e3", "-5", "1,2,3", "."])("rechaza %p", (i) => expect(normalizeMoneyInput(i)).toBeNull());
  it("acepta negativos solo si se pide (deuda de tarjeta)", () => {
    expect(normalizeMoneyInput("-100", { allowNegative: true })).toBe("-100.00");
    expect(normalizeMoneyInput("-100")).toBeNull();
  });
});

describe("cmpMoney (sin coma flotante)", () => {
  it("compara exactamente", () => {
    expect(cmpMoney("0.10", "0.1")).toBe(0);
    expect(cmpMoney("0.30", "0.29")).toBe(1);
    expect(cmpMoney("-1.00", "0.00")).toBe(-1);
    expect(cmpMoney("10.00", "9.99")).toBe(1);
  });
});

describe("fechas", () => {
  it("humanDate omite el año actual", () => {
    expect(humanDate("2026-10-07", 2026)).toBe("7 oct");
    expect(humanDate("2027-01-31", 2026)).toBe("31 ene 2027");
    expect(humanDate(null)).toBe("—");
  });
  it("humanRange", () => expect(humanRange("2026-10-07", "2026-11-07", 2026)).toBe("7 oct → 7 nov"));
  it("todayLocalIso usa la fecha local del dispositivo", () => expect(todayLocalIso(new Date(2026, 9, 12, 23, 59))).toBe("2026-10-12"));
  it("isIsoDate", () => { expect(isIsoDate("2026-10-12")).toBe(true); expect(isIsoDate("12/10/2026")).toBe(false); });
});

describe("addMonthsIso", () => {
  it.each([
    ["2026-10-07", 1, "2026-11-07"], ["2026-01-31", 1, "2026-02-28"], ["2028-01-31", 1, "2028-02-29"],
    ["2026-12-15", 1, "2027-01-15"], ["2026-10-07", 12, "2027-10-07"], ["2026-01-31", 3, "2026-04-30"],
  ])("%s + %i meses = %s", (i, n, e) => expect(addMonthsIso(i, n)).toBe(e));
  it("fecha inválida → null", () => expect(addMonthsIso("07/10/2026", 1)).toBeNull());
});

describe("suggestAllocation (D-10)", () => {
  const items = [
    { id: "tarde", pending: "12.00", dueDate: "2026-10-30" },
    { id: "vieja", pending: "8.00", dueDate: "2026-10-07" },
    { id: "media", pending: "4.00", dueDate: "2026-10-15" },
  ];
  it("asigna primero lo más antiguo sin exceder pendiente ni importe", () => {
    expect(suggestAllocation("40.00", items)).toEqual({ vieja: "8.00", media: "4.00", tarde: "12.00" });
    expect(suggestAllocation("10.00", items)).toEqual({ vieja: "8.00", media: "2.00" });
    expect(suggestAllocation("0.00", items)).toEqual({});
  });
  it("sin errores de coma flotante", () => expect(suggestAllocation("0.30", [{ id: "a", pending: "0.10", dueDate: "1" }, { id: "b", pending: "0.20", dueDate: "2" }])).toEqual({ a: "0.10", b: "0.20" }));
});

describe("pctOf", () => {
  it("proporción para barras, acotada a 0–100", () => {
    expect(pctOf("24.00", "47.00")).toBeCloseTo(51.06, 1);
    expect(pctOf("0.00", "47.00")).toBe(0);
    expect(pctOf("60.00", "47.00")).toBe(100);
    expect(pctOf("5.00", "0.00")).toBe(0);
  });
});

describe("intervalLabel", () => {
  it.each([
    [{ unit: "month", count: 1 }, "mensual"], [{ unit: "month", count: 3 }, "cada 3 meses"], [{ unit: "year", count: 1 }, "anual"],
    [{ unit: "week", count: 1 }, "semanal"], [{ unit: "day", count: 15 }, "cada 15 días"],
  ] as const)("%j → %s", (iv, e) => expect(intervalLabel({ ...iv })).toBe(e));
});
