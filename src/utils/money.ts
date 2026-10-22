// El dinero viaja como cadena decimal ("20.00"). La app NUNCA calcula dinero: solo lo formatea y valida lo escrito.
// (Los cálculos viven en el servidor; docs/especificacion/10 T-05.)

/** "20.00" → "S/ 20.00"; "-100.00" → "-S/ 100.00". */
export function formatSoles(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "S/ —";
  const neg = amount.startsWith("-");
  const abs = neg ? amount.slice(1) : amount;
  const [whole, frac = ""] = abs.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}S/ ${withSep}.${frac.padEnd(2, "0").slice(0, 2)}`;
}

/**
 * Normaliza lo que el usuario escribe a una cadena decimal válida para la API, o null si no lo es.
 * "12,5" → "12.50"; "12" → "12.00"; "1.234" → null (más de 2 decimales); "" → null.
 */
export function normalizeMoneyInput(text: string, opts: { allowNegative?: boolean } = {}): string | null {
  const t = text.trim().replace(",", ".");
  const m = (opts.allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).exec(t);
  if (!m) return null;
  const neg = t.startsWith("-");
  const [whole, frac = ""] = (neg ? t.slice(1) : t).split(".");
  return `${neg ? "-" : ""}${whole.replace(/^0+(?=\d)/, "")}.${frac.padEnd(2, "0")}`;
}

/** Compara dos cadenas decimales sin usar coma flotante. */
export function cmpMoney(a: string, b: string): number {
  const toCents = (s: string) => {
    const neg = s.startsWith("-");
    const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
    const c = BigInt(w || "0") * 100n + BigInt(f.padEnd(2, "0").slice(0, 2) || "0");
    return neg ? -c : c;
  };
  const x = toCents(a), y = toCents(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

const toCents = (s: string): bigint => {
  const neg = s.startsWith("-");
  const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
  const c = BigInt(w || "0") * 100n + BigInt(f.padEnd(2, "0").slice(0, 2) || "0");
  return neg ? -c : c;
};
const fromCents = (c: bigint): string => {
  const neg = c < 0n;
  const a = neg ? -c : c;
  return `${neg ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
};

/**
 * Propone un reparto: vence primero lo más antiguo, hasta agotar el importe. Es solo una SUGERENCIA editable (D-10);
 * el servidor valida y calcula todo lo que se confirma.
 */
export function suggestAllocation(amount: string, items: Array<{ id: string; pending: string; dueDate: string }>): Record<string, string> {
  let left = toCents(amount);
  const out: Record<string, string> = {};
  for (const it of [...items].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))) {
    if (left <= 0n) break;
    const p = toCents(it.pending);
    if (p <= 0n) continue;
    const take = left < p ? left : p;
    out[it.id] = fromCents(take);
    left -= take;
  }
  return out;
}

/** Porcentaje (0–100) de `part` sobre `whole`, solo para dibujar barras de progreso. */
export function pctOf(part: string, whole: string): number {
  const w = toCents(whole);
  if (w <= 0n) return 0;
  const p = toCents(part);
  if (p <= 0n) return 0;
  const v = Number((p * 10000n) / w) / 100;
  return v > 100 ? 100 : v;
}
