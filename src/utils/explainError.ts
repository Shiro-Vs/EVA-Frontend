// Convierte un error de la API en un diálogo comprensible: qué pasó y, cuando se sabe, POR QUÉ.
import { errorMessage } from "../api/client";

export interface Explained { kind: "error" | "blocked"; title: string; message: string; details?: string[] }

/** Errores que no son un fallo sino una regla: la acción no se puede hacer por una razón concreta. */
const BLOCKED = new Set([
  "CATEGORY_IN_USE", "CATEGORY_HAS_CHILDREN", "CATEGORY_NAME_EXISTS", "CATEGORY_DEPTH_EXCEEDED", "CATEGORY_ARCHIVED",
  "SUBSCRIPTION_IN_USE", "SUBSCRIPTION_HAS_ACTIVE_SEATS", "SUBSCRIPTION_HAS_RESERVATIONS", "UNPAID_HANDLING_REQUIRED",
  "ACCOUNT_IN_USE", "CONTACT_IN_USE", "CONTACT_HAS_ACTIVE_SEATS", "GOAL_IN_USE", "BANK_LOAN_IN_USE",
  "VERSION_CONFLICT", "ACCOUNT_DELETED",
]);

export function explainError(e: unknown, title?: string): Explained {
  const x = e as { status?: number; code?: string; message?: string; details?: unknown };
  const message = errorMessage(e);
  const details: string[] = [];
  const d = x.details as { usage?: Record<string, number>; children?: number } | undefined;
  if (d?.usage) for (const [k, n] of Object.entries(d.usage)) details.push(`${n} ${k}`);
  if (typeof d?.children === "number") details.push(`${d.children} ${d.children === 1 ? "subcategoría" : "subcategorías"}`);

  if (x.code && BLOCKED.has(x.code)) return { kind: "blocked", title: title ?? "No se pudo", message, details: details.length ? details : undefined };
  if (x.status === 0 || x.code === "NETWORK_ERROR") return { kind: "error", title: "Sin conexión", message: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." };
  return { kind: "error", title: title ?? "Algo salió mal", message, details: details.length ? details : undefined };
}
