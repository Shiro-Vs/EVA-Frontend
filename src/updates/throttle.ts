/** Cada cuánto como máximo se busca una actualización al volver a la app (para no pedirla en cada cambio de pantalla). */
export const UPDATE_CHECK_GAP_MS = 10 * 60 * 1000;

export function shouldCheckForUpdate(lastCheckMs: number | null, nowMs: number, gapMs = UPDATE_CHECK_GAP_MS): boolean {
  return lastCheckMs === null || nowMs - lastCheckMs >= gapMs;
}
