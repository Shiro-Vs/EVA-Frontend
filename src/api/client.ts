import { request } from "./http";
import type * as T from "./types";

const get = async <R,>(path: string, query?: Record<string, string | number | undefined>) => (await request<R>("GET", path, { query })).data;
const post = async <R,>(path: string, body?: unknown, idempotencyKey?: string) => (await request<R>("POST", path, { body: body ?? {}, idempotencyKey })).data;
const patch = async <R,>(path: string, body: unknown, version: number) => (await request<R>("PATCH", path, { body, version })).data;

/**
 * Cliente de la API. Las operaciones con efectos financieros reciben una `idempotencyKey`:
 * se genera UNA vez por intento del usuario y se reutiliza en cada reenvío (docs 13 §1.1).
 */
export const api = {
  me: () => get<T.Profile>("/me"),
  summary: () => get<T.Summary>("/summary"),
  patchMe: (body: { displayName?: string; defaultFreeDays?: number; exitDaysLimit?: number | null }, version: number) => patch<T.Profile>("/me", body, version),

  accounts: async () => (await get<{ items: T.Account[] }>("/accounts")).items,
  account: (id: string) => get<T.Account>(`/accounts/${id}`),
  createAccount: (body: { name: string; type: T.AccountType; openingBalance?: { amount: string; date?: string }; isDefault?: boolean }, key: string) => post<T.Account>("/accounts", body, key),
  accountEntries: (id: string, cursor?: string) => get<{ items: T.AccountEntry[]; nextCursor: string | null }>(`/accounts/${id}/entries`, { cursor }),

  createOperation: (body: { kind: "income" | "expense" | "transfer"; accountId: string; toAccountId?: string; amount: string; date?: string; description?: string }, key: string) => post("/operations", body, key),

  contacts: async () => (await get<{ items: T.Contact[] }>("/contacts")).items,
  contact: (id: string) => get<T.Contact>(`/contacts/${id}`),
  createContact: (body: { name: string; phone?: string | null; color?: string | null }) => post<T.Contact>("/contacts", body),
  patchContact: (id: string, body: { name?: string; phone?: string | null; color?: string | null }, version: number) => patch<T.Contact>(`/contacts/${id}`, body, version),
  archiveContact: (id: string) => post<T.Contact>(`/contacts/${id}/archive`),
  contactStatement: (id: string) => get<T.Statement>(`/contacts/${id}/statement`),
  contactCredit: (id: string) => get<T.ContactCredit>(`/contacts/${id}/credit`),

  subscriptions: async () => (await get<{ items: T.Subscription[] }>("/subscriptions")).items,
  subscription: (id: string) => get<T.Subscription>(`/subscriptions/${id}`),
  previewSubscription: (body: SubscriptionBody & { occupiedSeats?: number }) => post<T.SubscriptionPreview>("/subscriptions/preview", body),
  createSubscription: (body: SubscriptionBody & { previewToken: string; confirmCalendarMismatch?: boolean }, key: string) => post<T.Subscription>("/subscriptions", body, key),
  patchSubscription: (id: string, body: { name?: string; color?: string | null; icon?: string | null; preferredAccountId?: string | null }, version: number) => patch<T.Subscription>(`/subscriptions/${id}`, body, version),
  seats: async (subscriptionId: string) => (await get<{ items: T.SeatSummary[] }>(`/subscriptions/${subscriptionId}/seats`)).items,
  cycles: async (subscriptionId: string) => (await get<{ items: T.CycleRef[] }>(`/subscriptions/${subscriptionId}/cycles`)).items,
  generateAhead: (subscriptionId: string, ahead: number, key: string) => post(`/subscriptions/${subscriptionId}/cycles/generate`, { ahead }, key),
  costSummary: (subscriptionId: string, cycleId?: string) => get<T.CostSummary>(`/subscriptions/${subscriptionId}/cost-summary`, { cycleId }),

  previewSeat: (subscriptionId: string, body: SeatBody) => post<T.SeatPreview>(`/subscriptions/${subscriptionId}/seats/preview`, body),
  createSeat: (subscriptionId: string, body: SeatBody & { previewToken: string }, key: string) => post<T.Seat>(`/subscriptions/${subscriptionId}/seats`, body, key),
  seat: (id: string) => get<T.Seat>(`/seats/${id}`),

  cycle: (id: string) => get<T.CycleDetail>(`/billing-cycles/${id}`),
  paySupplier: (cycleId: string, body: { accountId: string; amount: string; paidOn?: string; note?: string }, key: string) => post(`/billing-cycles/${cycleId}/supplier-payment`, body, key),

  reverseSupplierPayment: (id: string, reason: string, key: string) => post(`/supplier-payments/${id}/reverse`, { reason }, key),

  previewReceipt: (body: ReceiptBody) => post<T.ReceiptPreview>("/receipts/preview", body),
  createReceipt: (body: ReceiptBody & { previewToken: string }, key: string) => post<T.ReceiptCreated>("/receipts", body, key),
};

export interface SubscriptionBody {
  name: string; provider?: string | null; mode: "personal" | "shared"; capacity: number; announcedPrice: string; interval: T.Interval;
  startDate: string; nextPaymentDate: string; preferredAccountId?: string | null; color?: string | null; icon?: string | null;
}
export interface SeatBody { contactId: string; label: string; quota: string; joinDate?: string; freeDaysThreshold?: number | null }
export interface ReceiptBody {
  contactId: string; accountId: string; amount: string; receivedOn?: string; note?: string;
  allocations: Array<{ obligationId: string; amount: string }>; reserveRemainder?: { subscriptionId: string } | null;
}

/** Mensajes en español para los códigos de error de la API (docs 13 §3). El servidor devuelve códigos estables; el texto vive aquí. */
export const ERROR_TEXT: Record<string, string> = {
  UNAUTHENTICATED: "Tu sesión expiró. Vuelve a entrar.",
  NETWORK_ERROR: "No se pudo conectar con el servidor. Revisa tu conexión.",
  NOT_FOUND: "No se encontró lo que buscas.",
  CONFLICT_VERSION: "Otro cambio se guardó antes. Actualiza y vuelve a intentar.",
  VALIDATION_ERROR: "Revisa los datos: alguno no es válido.",
  OVER_ALLOCATION: "Estás aplicando más dinero del que corresponde.",
  CAPACITY_EXCEEDED: "No hay plazas libres en el servicio.",
  CALENDAR_MISMATCH_UNCONFIRMED: "La fecha del proveedor difiere de la calculada. Confírmala para continuar.",
  FUTURE_DATE_NOT_ALLOWED: "La fecha no puede ser posterior a hoy.",
  JOIN_OUT_OF_CYCLE: "La fecha de ingreso debe estar dentro del ciclo en curso.",
  SUPPLIER_PAYMENT_EXISTS: "Este ciclo ya tiene un pago registrado.",
  ACCOUNT_ARCHIVED: "La cuenta está archivada.",
  PREVIEW_STALE: "Los datos cambiaron mientras revisabas. Revisa el nuevo cálculo.",
  PREVIEW_MISMATCH: "Los datos no coinciden con la vista previa. Vuelve a revisarla.",
  PREVIEW_INVALID: "La vista previa no es válida. Vuelve a generarla.",
  PREVIEW_REQUIRED: "Primero revisa la vista previa.",
  SUBSCRIPTION_PERSONAL: "Un servicio personal no admite plazas de otras personas.",
  ALLOCATION_CONTACT_MISMATCH: "El cobro y el cargo son de personas distintas.",
  DEV_LOGIN_DISABLED: "Este servidor no tiene el acceso de desarrollo activado. Usa un token.",
  IDEMPOTENCY_KEY_REUSED: "Esta acción ya se envió con otros datos.",
};

export function errorMessage(e: unknown): string {
  const anyE = e as { code?: string; message?: string };
  return (anyE.code && ERROR_TEXT[anyE.code]) || anyE.message || "Ocurrió un error inesperado.";
}
