// Qué notificaciones programar en el teléfono a partir de la lista que calcula el servidor (GET /reminders, 09 §7).
// Es lógica pura: no toca el teléfono, así se prueba sin dispositivo.

export interface ReminderItem { id: string; title: string; detail: string | null; route: string; fireAt: string[] }
export interface Planned { identifier: string; at: Date; title: string; body: string; route: string }
export interface Plan { schedule: Planned[]; cancel: string[]; desired: number }

const PREFIX = "eva:";
/** iOS admite 64 notificaciones programadas: se dejan 60 y el resto se programa en la siguiente sincronización. */
export const MAX_SCHEDULED = 60;

/** «2026-11-04T09:00» es hora LOCAL del teléfono (el servidor ya aplicó la zona horaria y el horario silencioso). */
export function parseLocal(stamp: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(stamp);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  // Date «corrige» fechas imposibles (mes 13 → enero): si no coincide con lo recibido, se descarta.
  const ok = d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) && d.getHours() === Number(m[4]) && d.getMinutes() === Number(m[5]);
  return ok ? d : null;
}

export const identifierOf = (id: string, fireAt: string) => `${PREFIX}${id}@${fireAt}`;

export function planNotifications(items: ReminderItem[], existing: string[], now: Date): Plan {
  const want = new Map<string, Planned>();
  for (const it of items) {
    for (const f of it.fireAt) {
      const at = parseLocal(f);
      if (!at || at.getTime() <= now.getTime()) continue; // solo lo futuro
      const identifier = identifierOf(it.id, f);
      // El texto es discreto por defecto: el servidor solo manda el detalle si el usuario lo habilitó.
      want.set(identifier, { identifier, at, title: "EVA", body: it.detail ?? it.title, route: it.route });
    }
  }
  const ordered = [...want.values()].sort((a, b) => a.at.getTime() - b.at.getTime() || a.identifier.localeCompare(b.identifier)).slice(0, MAX_SCHEDULED);
  const keep = new Set(ordered.map((p) => p.identifier));
  const have = new Set(existing);
  return {
    // Solo se tocan las nuestras (prefijo «eva:»): cualquier otra notificación del teléfono se respeta.
    cancel: existing.filter((id) => id.startsWith(PREFIX) && !keep.has(id)),
    schedule: ordered.filter((p) => !have.has(p.identifier)),
    desired: ordered.length,
  };
}
