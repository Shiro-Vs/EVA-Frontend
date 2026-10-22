import type { Interval } from "../api/types";

/** Texto corto de la frecuencia: "mensual", "cada 3 meses", "anual"… */
export function intervalLabel(iv: Interval | null | undefined): string {
  if (!iv) return "";
  const { unit, count } = iv;
  if (count === 1) return { day: "diario", week: "semanal", month: "mensual", year: "anual" }[unit];
  const plural = { day: "días", week: "semanas", month: "meses", year: "años" }[unit];
  return `cada ${count} ${plural}`;
}

/** Texto del chip del ciclo: "Ciclo mensual", "Ciclo anual"… */
export const cycleLabel = (iv: Interval | null | undefined) => (iv ? (iv.count === 1 ? `Ciclo ${intervalLabel(iv)}` : `Ciclo ${intervalLabel(iv)}`) : "Ciclo");
