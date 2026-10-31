import { parseIso } from "./calendar";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-07" → "7 oct" (con año si no es el actual). Sin Date: no hay zonas horarias que torcer. */
export function humanDate(iso: string | null | undefined, currentYear = new Date().getFullYear()): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  return `${Number(m[3])} ${MES[Number(m[2]) - 1]}${y !== currentYear ? ` ${y}` : ""}`;
}

export const humanRange = (start: string, end: string, year?: number) => `${humanDate(start, year)} → ${humanDate(end, year)}`;

/** Fecha local del dispositivo como YYYY-MM-DD (solo para valores por defecto de formularios; el servidor decide "hoy"). */
export function todayLocalIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const isIsoDate = (s: string) => parseIso(s) !== null;

const dim = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();

/**
 * Suma meses a una fecha ISO usando el último día disponible (31 ene + 1 mes = 28 feb).
 * Solo sirve para PROPONER la fecha del siguiente pago en el formulario; el servidor verifica el calendario (RN-C03).
 */
export function addMonthsIso(iso: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const idx = Number(m[2]) - 1 + months;
  const y = Number(m[1]) + Math.floor(idx / 12);
  const mo = ((idx % 12) + 12) % 12 + 1;
  const d = Math.min(Number(m[3]), dim(y, mo));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}`;
}
