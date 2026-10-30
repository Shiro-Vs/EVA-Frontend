import { Colors } from "../Colors";

// Guardia de accesibilidad: la paleta no puede volver a bajar de estos mínimos (WCAG 2.x y APCA).
const hex = (s: string) => [0, 2, 4].map((i) => parseInt(s.slice(1 + i, 3 + i), 16));
const lin = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
const wcag = (a: string, b: string) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const apcaY = ([r, g, b]: number[]) => { const y = 0.2126729 * Math.pow(r! / 255, 2.4) + 0.7151522 * Math.pow(g! / 255, 2.4) + 0.072175 * Math.pow(b! / 255, 2.4); return y < 0.022 ? y + Math.pow(0.022 - y, 1.414) : y; };
const apca = (t: string, b: string) => {
  const yt = apcaY(hex(t)), yb = apcaY(hex(b));
  if (yb > yt) { const s = (Math.pow(yb, 0.56) - Math.pow(yt, 0.57)) * 1.14; return s < 0.1 ? 0 : (s - 0.027) * 100; }
  const s = (Math.pow(yb, 0.65) - Math.pow(yt, 0.62)) * 1.14;
  return s > -0.1 ? 0 : Math.abs((s + 0.027) * 100);
};

type Theme = typeof Colors.light;
const themes: Array<[string, Theme, number]> = [["claro", Colors.light, 60], ["oscuro", Colors.dark, 50]];

describe.each(themes)("Contraste en tema %s", (_name, c, minLc) => {
  const surfaces = [c.background, c.card];
  const textTokens: Array<keyof Theme> = ["text", "textSecondary", "muted", "primary", "incomeStrong", "expenseStrong", "warningStrong"];

  it.each(textTokens)("el texto «%s» cumple 4.5:1 sobre fondo y tarjeta", (tk) => {
    for (const s of surfaces) expect(wcag(c[tk] as string, s)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(textTokens)("el texto «%s» cumple APCA mínimo sobre fondo y tarjeta", (tk) => {
    for (const s of surfaces) expect(apca(c[tk] as string, s)).toBeGreaterThanOrEqual(minLc);
  });

  it("los rellenos e íconos (income, expense, warning) cumplen 3:1 sobre tarjeta y fondo", () => {
    for (const k of ["income", "expense", "warning"] as const) for (const s of surfaces) expect(wcag(c[k], s)).toBeGreaterThanOrEqual(3);
  });

  it("el texto sobre rellenos de marca cumple 4.5:1", () => {
    expect(wcag(c.onPrimary, c.primarySurface)).toBeGreaterThanOrEqual(4.5);
    expect(wcag(c.onPrimaryMuted, c.primarySurface)).toBeGreaterThanOrEqual(4.5);
    expect(wcag("#FFFFFF", c.dangerSurface)).toBeGreaterThanOrEqual(4.5);
    expect(wcag(c.onPrimaryTint, c.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("los íconos de la barra y los bordes fuertes cumplen 3:1", () => {
    expect(wcag(c.tabIconDefault, c.card)).toBeGreaterThanOrEqual(3);
    expect(wcag(c.tabIconSelected, c.card)).toBeGreaterThanOrEqual(3);
    expect(wcag(c.borderStrong, c.background)).toBeGreaterThanOrEqual(3);
  });

  it("los íconos de aviso se distinguen de su fondo (3:1)", () => {
    const over = (rgba: string, base: string) => {
      const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(rgba)!;
      const b = hex(base);
      return "#" + [0, 1, 2].map((i) => Math.round(+m[i + 1]! * +m[4]! + b[i]! * (1 - +m[4]!)).toString(16).padStart(2, "0")).join("");
    };
    for (const k of ["success", "error", "warning", "info"] as const) expect(wcag(c.alert[k].icon, over(c.alert[k].bg, c.background))).toBeGreaterThanOrEqual(3);
  });

it("los acentos de sección se leen sobre su ficha (4.5:1) y sobre la tarjeta (3:1)", () => {
    for (const k of Object.keys(c.sections) as Array<keyof typeof c.sections>) {
      expect(wcag(c.sections[k].ink, c.sections[k].tint)).toBeGreaterThanOrEqual(4.5);
      expect(wcag(c.sections[k].ink, c.card)).toBeGreaterThanOrEqual(3);
    }
  });

  it("los acentos de sección son todos distintos", () => {
    const inks = Object.values(c.sections).map((x) => x.ink);
    expect(new Set(inks).size).toBe(inks.length);
  });

  it("income/expense/warning se distinguen de sus variantes «Strong»", () => {
    expect(c.income).not.toBe(c.incomeStrong);
    expect(c.expense).not.toBe(c.expenseStrong);
  });
});

describe("Estructura de tokens", () => {
  it("claro y oscuro definen exactamente los mismos tokens", () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });
});
