// Lógica pura del calendario y de la escritura de fechas (AAAA-MM-DD). Sin zonas horarias: todo es «fecha civil».

export const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] as const;
/** La semana empieza el lunes. */
export const WEEKDAYS_ES = ["L", "M", "X", "J", "V", "S", "D"] as const;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate(); // month: 1–12

export const toIso = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Partes de una fecha ISO válida (el 31 de febrero NO lo es), o null. */
export function parseIso(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Cuadrícula del mes: semanas de 7 celdas (lunes a domingo); null = hueco fuera del mes. */
export function monthGrid(year: number, month: number): Array<Array<number | null>> {
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 0 = lunes
  const cells: Array<number | null> = [...Array(first).fill(null), ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Mes anterior/siguiente (con cambio de año). */
export const shiftMonth = (year: number, month: number, delta: number) => {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

/**
 * Lo que se escribe a mano: solo dígitos, con los guiones puestos solos → AAAA-MM-DD.
 * «20261105» → «2026-11-05»; las letras y símbolos se descartan; máximo 8 dígitos.
 */
export function formatDateTyping(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}
