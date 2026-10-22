import type { Contact as ApiContact } from "../../api/types";
import type { Contact } from "../../interfaces/Contact";

export const FALLBACK_CONTACT_COLOR = "#3B82F6";

/** Convierte un contacto de la API al formato que usan las pantallas originales. */
export function toUiContact(c: ApiContact): Contact {
  return {
    id: c.id,
    nombre: c.name,
    color: c.color ?? FALLBACK_CONTACT_COLOR,
    telefono: c.phone ?? undefined,
    total_servicios: c.services,
    deuda: c.totals.pending,
    vencido: c.totals.overdue,
    version: c.version,
  };
}
