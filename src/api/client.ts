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

  patchAccount: (id: string, body: { name?: string; color?: string | null; icon?: string | null; isDefault?: boolean; excludeFromTotal?: boolean }, version: number) => patch<T.Account>(`/accounts/${id}`, body, version),
  archiveAccount: (id: string) => post<T.Account>(`/accounts/${id}/archive`),

  accounts: async () => (await get<{ items: T.Account[] }>("/accounts")).items,
  account: (id: string) => get<T.Account>(`/accounts/${id}`),
  createAccount: (body: { name: string; type: T.AccountType; institution?: string; color?: string; icon?: string; excludeFromTotal?: boolean; openingBalance?: { amount: string; date?: string }; isDefault?: boolean }, key: string) => post<T.Account>("/accounts", body, key),
  accountEntries: (id: string, cursor?: string) => get<{ items: T.AccountEntry[]; nextCursor: string | null }>(`/accounts/${id}/entries`, { cursor }),

  createOperation: (body: { kind: "income" | "expense" | "transfer"; accountId: string; toAccountId?: string; amount: string; date?: string; description?: string; contactId?: string | null }, key: string) => post<T.OperationDetail>("/operations", body, key),
  operation: (id: string) => get<T.OperationDetail>(`/operations/${id}`),
  patchOperation: (id: string, body: { description?: string; contactId?: string | null; categoryId?: string | null }, version: number) => patch<T.OperationDetail>(`/operations/${id}`, body, version),
  reverseOperation: (id: string, body: { reason: string; date?: string }, key: string) => post<T.OperationDetail>(`/operations/${id}/reverse`, body, key),
  previewOperationCorrection: (id: string, body: OperationCorrectionBody) => post<T.Preview>(`/operations/${id}/correct/preview`, body),
  correctOperation: (id: string, body: OperationCorrectionBody & { reason: string; previewToken: string }, key: string) => post<T.Preview>(`/operations/${id}/correct`, body, key),

  contacts: async () => (await get<{ items: T.Contact[] }>("/contacts")).items,
  contact: (id: string) => get<T.Contact>(`/contacts/${id}`),
  createContact: (body: { name: string; phone?: string | null; email?: string | null; color?: string | null; notes?: string | null }) => post<T.Contact>("/contacts", body),
  patchContact: (id: string, body: { name?: string; phone?: string | null; email?: string | null; color?: string | null; notes?: string | null }, version: number) => patch<T.Contact>(`/contacts/${id}`, body, version),
  archiveContact: (id: string) => post<T.Contact>(`/contacts/${id}/archive`),
  contactStatement: (id: string) => get<T.Statement>(`/contacts/${id}/statement`),
  contactCredit: (id: string) => get<T.ContactCredit>(`/contacts/${id}/credit`),
  contactReceipts: async (id: string) => (await get<{ items: T.ContactReceipt[] }>(`/contacts/${id}/receipts`)).items,
  previewDebtConversion: (contactId: string, obligationIds: string[]) => post<T.Preview>(`/contacts/${contactId}/debt-conversion/preview`, { obligationIds }),
  convertDebt: (contactId: string, body: { obligationIds: string[]; reason: string; previewToken: string }, key: string) => post<T.Loan>(`/contacts/${contactId}/debt-conversion`, body, key),

  loans: async (contactId?: string) => (await get<{ items: T.Loan[] }>("/loans", { contactId })).items,
  loan: (id: string) => get<T.Loan>(`/loans/${id}`),

  refunds: async (status?: string, contactId?: string) => (await get<{ items: T.Refund[] }>("/refunds", { status, contactId })).items,
  createRefund: (body: { receiptId: string; amount: string; reason: string }, key: string) => post<T.Refund>("/refunds", body, key),
  payRefund: (id: string, body: { accountId: string; paidOn?: string; note?: string }, key: string) => post<T.Refund>(`/refunds/${id}/pay`, body, key),
  cancelRefund: (id: string, reason: string, key: string) => post<T.Refund>(`/refunds/${id}/cancel`, { reason }, key),

  subscriptions: async () => (await get<{ items: T.Subscription[] }>("/subscriptions")).items,
  subscription: (id: string) => get<T.Subscription>(`/subscriptions/${id}`),
  previewSubscription: (body: SubscriptionBody & { occupiedSeats?: number }) => post<T.SubscriptionPreview>("/subscriptions/preview", body),
  createSubscription: (body: SubscriptionBody & { previewToken: string; confirmCalendarMismatch?: boolean }, key: string) => post<T.Subscription>("/subscriptions", body, key),
  patchSubscription: (id: string, body: { name?: string; provider?: string | null; color?: string | null; icon?: string | null; preferredAccountId?: string | null }, version: number) => patch<T.Subscription>(`/subscriptions/${id}`, body, version),
  archiveSubscription: (id: string) => post<T.Subscription>(`/subscriptions/${id}/archive`),
  terms: async (id: string) => (await get<{ items: T.TermsVersion[] }>(`/subscriptions/${id}/terms`)).items,
  previewPriceChange: (id: string, body: PriceChangeBody) => post<T.Preview>(`/subscriptions/${id}/price-change/preview`, body),
  changePrice: (id: string, body: PriceChangeBody & { previewToken: string }, key: string) => post<T.Preview>(`/subscriptions/${id}/price-change`, body, key),
  calendarChanges: async (id: string) => (await get<{ items: T.CalendarChange[] }>(`/subscriptions/${id}/calendar-changes`)).items,
  previewCalendarChange: (id: string, body: CalendarChangeBody) => post<T.Preview>(`/subscriptions/${id}/calendar-changes/preview`, body),
  changeCalendar: (id: string, body: CalendarChangeBody & { previewToken: string }, key: string) => post<T.Preview>(`/subscriptions/${id}/calendar-changes`, body, key),
  previewSwitchToIndividual: (id: string) => post<T.Preview>(`/subscriptions/${id}/switch-to-individual/preview`, {}),
  switchToIndividual: (id: string, body: { reason: string; previewToken: string }, key: string) => post<T.Preview>(`/subscriptions/${id}/switch-to-individual`, body, key),

  seats: async (subscriptionId: string) => (await get<{ items: T.SeatSummary[] }>(`/subscriptions/${subscriptionId}/seats`)).items,
  cycles: async (subscriptionId: string) => (await get<{ items: T.CycleRef[] }>(`/subscriptions/${subscriptionId}/cycles`)).items,
  generateAhead: (subscriptionId: string, ahead: number, key: string) => post(`/subscriptions/${subscriptionId}/cycles/generate`, { ahead }, key),
  costSummary: (subscriptionId: string, cycleId?: string) => get<T.CostSummary>(`/subscriptions/${subscriptionId}/cost-summary`, { cycleId }),

  previewSeat: (subscriptionId: string, body: SeatBody) => post<T.SeatPreview>(`/subscriptions/${subscriptionId}/seats/preview`, body),
  createSeat: (subscriptionId: string, body: SeatBody & { previewToken: string }, key: string) => post<T.Seat>(`/subscriptions/${subscriptionId}/seats`, body, key),
  seat: (id: string) => get<T.Seat>(`/seats/${id}`),
  previewQuotaChange: (seatId: string, body: QuotaChangeBody) => post<T.Preview>(`/seats/${seatId}/quota-change/preview`, body),
  changeQuota: (seatId: string, body: QuotaChangeBody & { previewToken: string }, key: string) => post<T.Preview>(`/seats/${seatId}/quota-change`, body, key),
  courtesies: async (seatId: string) => (await get<{ items: T.Courtesy[] }>(`/seats/${seatId}/courtesies`)).items,
  previewCourtesy: (seatId: string, body: CourtesyBody) => post<T.Preview>(`/seats/${seatId}/courtesies/preview`, body),
  createCourtesy: (seatId: string, body: CourtesyBody, key: string) => post<T.Preview>(`/seats/${seatId}/courtesies`, body, key),
  endCourtesy: (id: string, key: string) => post<T.Courtesy>(`/courtesies/${id}/end`, {}, key),
  previewExit: (seatId: string) => post<T.Preview>(`/seats/${seatId}/exit/preview`, {}),
  exitSeat: (seatId: string, body: { reason: string; previewToken: string }, key: string) => post<T.Preview>(`/seats/${seatId}/exit`, body, key),

  cycle: (id: string) => get<T.CycleDetail>(`/billing-cycles/${id}`),
  paySupplier: (cycleId: string, body: { accountId: string; amount: string; paidOn?: string; note?: string }, key: string) => post(`/billing-cycles/${cycleId}/supplier-payment`, body, key),

  reverseSupplierPayment: (id: string, reason: string, key: string) => post(`/supplier-payments/${id}/reverse`, { reason }, key),

  receipt: (id: string) => get<T.ReceiptDetail>(`/receipts/${id}`),
  patchReceipt: (id: string, body: { note?: string | null }, version: number) => patch<T.ReceiptDetail>(`/receipts/${id}`, body, version),
  previewReceiptCorrection: (id: string, body: ReceiptCorrectionBody) => post<T.Preview>(`/receipts/${id}/correct/preview`, body),
  correctReceipt: (id: string, body: ReceiptCorrectionBody & { reason: string; previewToken: string }, key: string) => post<T.Preview>(`/receipts/${id}/correct`, body, key),
  previewReceiptReversal: (id: string) => post<T.Preview>(`/receipts/${id}/reverse/preview`, {}),
  reverseReceipt: (id: string, body: { reason: string; previewToken: string }, key: string) => post<T.Preview>(`/receipts/${id}/reverse`, body, key),

  previewReceipt: (body: ReceiptBody) => post<T.ReceiptPreview>("/receipts/preview", body),
  createReceipt: (body: ReceiptBody & { previewToken: string }, key: string) => post<T.ReceiptCreated>("/receipts", body, key),
};

export interface QuotaChangeBody { newQuota: string; effectiveFrom: string; mode: "per_renewal" | "lump"; reason: string }
export interface CourtesyBody { kind: "cycles" | "until_date" | "permanent"; cycles?: number; untilDate?: string; reason: string; debtHandling?: "keep" | "convert" }
export type CalendarChangeBody =
  | { kind: "shift_renewal" | "advance_renewal"; newDate: string; reason: string }
  | { kind: "change_interval"; interval: T.Interval; reason: string }
  | { kind: "suspend"; reason: string }
  | { kind: "reactivate"; renewalDate: string; reason: string };
export interface PriceChangeBody { newPrice: string; effectiveFrom: string; mode: "per_renewal" | "lump"; reason: string; quotas?: Array<{ seatId: string; quota: string }> }
export interface OperationCorrectionBody { amount?: string; accountId?: string; toAccountId?: string; date?: string }
export interface ReceiptCorrectionBody { amount?: string; accountId?: string; receivedOn?: string; allocations?: Array<{ obligationId: string; amount: string }>; reserveRemainder?: { subscriptionId: string } | null }

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
  DEBT_HANDLING_REQUIRED: "Esta persona ya debe dinero: elige si la deuda se queda en el servicio o se convierte en préstamo.",
  EFFECTIVE_DATE_PAST: "La fecha debe ser el inicio de un ciclo futuro.",
  EFFECTIVE_DATE_NOT_CYCLE_START: "La fecha debe coincidir con el inicio de un ciclo.",
  QUOTA_UNCHANGED: "La cuota nueva es igual a la actual.",
  QUOTA_CHANGE_EXISTS: "Ya hay un cambio de cuota programado en o después de esa fecha.",
  PRICE_UNCHANGED: "El precio nuevo es igual al actual.",
  PRICE_CHANGE_BLOCKED: "Un ciclo desde esa fecha ya está pagado al proveedor con el precio anterior. Elige una fecha posterior.",
  PRICE_CHANGE_EXISTS: "Ya hay un cambio programado después de esa fecha.",
  SEAT_NOT_IN_PROPOSAL: "Esa plaza no está activa en la fecha elegida.",
  COURTESY_ALREADY_ACTIVE: "La plaza ya tiene una cortesía vigente. Termínala primero.",
  COURTESY_CHARGE_ALREADY_APPLIED: "Un cargo del periodo ya tiene pagos o ajustes y no se puede eximir solo.",
  COURTESY_UNTIL_BEFORE_START: "La fecha final debe ser posterior al inicio del siguiente ciclo.",
  NEW_DATE_NOT_FUTURE: "La nueva fecha debe ser posterior a hoy.",
  NEW_DATE_UNCHANGED: "La renovación ya cae en esa fecha.",
  ADVANCE_NOT_EARLIER: "Para adelantar, la nueva fecha debe ser anterior a la actual.",
  INTERVAL_UNCHANGED: "La frecuencia ya es esa.",
  SUBSCRIPTION_SUSPENDED: "El servicio está suspendido.",
  SUBSCRIPTION_NOT_SUSPENDED: "El servicio no está suspendido.",
  REACTIVATE_DATE_INVALID: "La fecha de renovación debe ser posterior al inicio del último ciclo.",
  CALENDAR_CHANGE_BLOCKED: "Hay ciclos futuros con cargos o pago. Deshazlos antes de este cambio.",
  CALENDAR_CHANGE_UNSUPPORTED: "Hay un cambio de precio programado alrededor de este ciclo. Resuélvelo primero.",
  SEAT_ALREADY_ENDING: "La plaza ya tiene una fecha de baja.",
  EXIT_OWNER_SEAT: "Tu propia plaza no se puede dar de baja.",
  NO_CURRENT_CYCLE: "No hay un ciclo en curso (¿el servicio está suspendido?).",
  REFUND_EXCEEDS_FREE_CREDIT: "El importe supera el crédito libre de ese cobro.",
  REFUND_NOT_PLANNED: "Solo una devolución programada se puede pagar o cancelar.",
  NOTHING_TO_CONVERT: "No hay deuda pendiente para convertir.",
  NOT_CONVERTIBLE: "Ese concepto no se puede convertir en préstamo.",
  OBLIGATION_CONTACT_MISMATCH: "Uno de los conceptos es de otra persona.",
  ALREADY_REVERSED: "Ya está revertido.",
  RECEIPT_HAS_REFUNDS: "Este cobro tiene devoluciones: cancela las programadas primero.",
  OPERATION_LINKED: "Este movimiento pertenece a un cobro, devolución o pago: corrígelo desde ese registro.",
  OPERATION_NOT_EDITABLE: "Un movimiento revertido no se puede editar.",
  NO_CHANGES: "No hay cambios: los datos son iguales a los actuales.",
  SUBSCRIPTION_ARCHIVED: "El servicio está archivado.",
  IDEMPOTENCY_KEY_REUSED: "Esta acción ya se envió con otros datos.",
};

export function errorMessage(e: unknown): string {
  const anyE = e as { code?: string; message?: string };
  return (anyE.code && ERROR_TEXT[anyE.code]) || anyE.message || "Ocurrió un error inesperado.";
}
