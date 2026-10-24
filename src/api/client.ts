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

  createOperation: (body: { kind: "income" | "expense" | "transfer"; accountId: string; toAccountId?: string; amount: string; date?: string; description?: string; contactId?: string | null; categoryId?: string | null; goalDeductions?: Array<{ goalId: string; amount: string }>; acceptReserveShortfall?: boolean }, key: string) => post<T.OperationDetail & { classification?: Record<string, unknown> | null; budgetImpact?: Array<Record<string, unknown>> }>("/operations", body, key),
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

  // ---- Entrega 3 ----
  categories: async (status?: string) => (await get<{ items: T.Category[] }>("/categories", { status })).items,
  createCategory: (body: { name: string; parentId?: string | null; icon?: string | null; color?: string | null }) => post<T.Category>("/categories", body),
  patchCategory: (id: string, body: { name?: string; icon?: string | null; color?: string | null }, version: number) => patch<T.Category>(`/categories/${id}`, body, version),
  archiveCategory: (id: string) => post<T.Category>(`/categories/${id}/archive`),
  restoreCategory: (id: string) => post<T.Category>(`/categories/${id}/restore`),
  rules: async (status?: string) => (await get<{ items: T.Rule[] }>("/classification-rules", { status })).items,
  createRule: (body: RuleBody) => post<T.Rule>("/classification-rules", body),
  archiveRule: (id: string) => post<T.Rule>(`/classification-rules/${id}/archive`),
  restoreRule: (id: string) => post<T.Rule>(`/classification-rules/${id}/restore`),
  suggestCategory: (body: { accountId: string; direction: "income" | "expense"; amount: string; text?: string }) => post<T.Preview>("/classification/suggest", body),
  previewClassify: (body: { from?: string; to?: string }) => post<T.Preview>("/classification/apply/preview", body),
  applyClassify: (body: { from?: string; to?: string; previewToken: string }, key: string) => post<{ classified: number }>("/classification/apply", body, key),
  operations: async (q: Record<string, string | number | undefined>) => get<{ items: T.OperationItem[]; nextCursor: string | null }>("/operations", q),

  creditDetails: (accountId: string) => get<T.CreditDetails | { configured: false }>(`/accounts/${accountId}/credit-details`),
  setCreditDetails: (accountId: string, body: { creditLine?: string | null; cutoffDay: number; dueDay: number }) => post<T.CreditDetails>(`/accounts/${accountId}/credit-details`, body),
  statements: async (accountId: string) => (await get<{ items: T.CardStatement[] }>(`/accounts/${accountId}/statements`)).items,
  createStatement: (accountId: string, body: StatementBody, key: string) => post<T.CardStatement>(`/accounts/${accountId}/statements`, body, key),
  cardStatement: (id: string) => get<T.CardStatement>(`/card-statements/${id}`),
  voidStatement: (id: string, reason: string) => post<T.CardStatement>(`/card-statements/${id}/void`, { reason }),
  linkCardPayment: (statementId: string, operationId: string, key: string) => post<T.CardStatement>(`/card-statements/${statementId}/payments`, { operationId }, key),
  unlinkCardPayment: (paymentId: string) => post<T.CardStatement>(`/card-statement-payments/${paymentId}/remove`),
  installmentPurchase: (accountId: string, body: InstallmentBody, key: string) => post<T.InstallmentPlan>(`/accounts/${accountId}/installment-purchases`, body, key),
  installmentPlans: async (accountId: string) => (await get<{ items: T.InstallmentPlan[] }>(`/accounts/${accountId}/installment-plans`)).items,
  cancelInstallmentPlan: (id: string) => post<T.InstallmentPlan>(`/installment-plans/${id}/cancel`),
  cardAdvisor: (date?: string) => get<T.Preview>("/cards/advisor", { date }),

  previewLoan: (body: LoanBody) => post<T.Preview>("/loans/preview", body),
  createLoan: (body: LoanBody & { previewToken: string }, key: string) => post<T.Preview>("/loans", body, key),
  previewLoanPayment: (id: string, body: LoanPaymentBody) => post<T.Preview>(`/loans/${id}/payments/preview`, body),
  payLoan: (id: string, body: LoanPaymentBody & { previewToken: string }, key: string) => post<T.Preview>(`/loans/${id}/payments`, body, key),
  reverseLoanPayment: (paymentId: string, reason: string, key: string) => post<T.Preview>(`/loan-payments/${paymentId}/reverse`, { reason }, key),
  previewPayoff: (id: string, body: { accountId: string; paidOn?: string }) => post<T.Preview>(`/loans/${id}/payoff/preview`, body),
  payoffLoan: (id: string, body: { accountId: string; paidOn?: string; previewToken: string }, key: string) => post<T.Preview>(`/loans/${id}/payoff`, body, key),
  previewLateFees: (id: string, body: LateFeeBody) => post<T.Preview>(`/loans/${id}/late-fees/preview`, body),
  applyLateFees: (id: string, body: LateFeeBody & { previewToken: string }, key: string) => post<T.Preview>(`/loans/${id}/late-fees`, body, key),
  previewCapitalize: (id: string) => post<T.Preview>(`/loans/${id}/capitalize/preview`),
  capitalizeLoan: (id: string, previewToken: string, key: string) => post<T.Preview>(`/loans/${id}/capitalize`, { previewToken }, key),
  cancelLoan: (id: string, reason: string, key: string) => post<T.Preview>(`/loans/${id}/cancel`, { reason }, key),

  budgets: async (date?: string, status?: string) => (await get<{ items: T.Budget[] }>("/budgets", { date, status })).items,
  budget: (id: string, date?: string) => get<T.Budget>(`/budgets/${id}`, { date }),
  budgetHistory: async (id: string, count = 6) => (await get<{ items: T.BudgetStatus[] }>(`/budgets/${id}/history`, { count })).items,
  createBudget: (body: BudgetBody) => post<T.Budget>("/budgets", body),
  patchBudget: (id: string, body: Partial<Omit<BudgetBody, "categoryId" | "period" | "startsOn">>, version: number) => patch<T.Budget>(`/budgets/${id}`, body, version),
  archiveBudget: (id: string) => post<T.Budget>(`/budgets/${id}/archive`),
  restoreBudget: (id: string) => post<T.Budget>(`/budgets/${id}/restore`),

  goals: async (status?: string) => (await get<{ items: T.Goal[] }>("/goals", { status })).items,
  goalsOverview: () => get<T.GoalOverview>("/goals/overview"),
  goal: (id: string) => get<T.Goal>(`/goals/${id}`),
  createGoal: (body: GoalBody) => post<T.Goal>("/goals", body),
  patchGoal: (id: string, body: Partial<GoalBody>, version: number) => patch<T.Goal>(`/goals/${id}`, body, version),
  archiveGoal: (id: string) => post<T.Goal>(`/goals/${id}/archive`),
  restoreGoal: (id: string) => post<T.Goal>(`/goals/${id}/restore`),
  reserveGoal: (id: string, body: { accountId: string; amount: string; note?: string }, key: string) => post<T.Goal>(`/goals/${id}/reserve`, body, key),
  releaseGoal: (id: string, body: { accountId: string; amount: string; note?: string }, key: string) => post<T.Goal>(`/goals/${id}/release`, body, key),
  linkGoalTransfer: (id: string, operationId: string, key: string) => post<T.Goal>(`/goals/${id}/link-transfer`, { operationId }, key),

  recurringTemplates: async (status?: string) => (await get<{ items: T.RecurringTemplate[] }>("/recurring/templates", { status })).items,
  recurringTemplate: (id: string) => get<T.RecurringTemplate>(`/recurring/templates/${id}`),
  createRecurring: (body: RecurringBody) => post<T.RecurringTemplate>("/recurring/templates", body),
  patchRecurring: (id: string, body: Partial<Omit<RecurringBody, "kind">>, version: number) => patch<T.RecurringTemplate>(`/recurring/templates/${id}`, body, version),
  setRecurringStatus: (id: string, action: "pause" | "resume" | "archive") => post<T.RecurringTemplate>(`/recurring/templates/${id}/${action}`),
  recurringPending: (within = 7) => get<{ due: T.Occurrence[]; upcoming: Array<{ templateId: string; name: string; kind: string; dueDate: string; amount: string }> }>("/recurring/pending", { within }),
  confirmOccurrence: (id: string, body: OccurrenceConfirmBody, key: string) => post<{ occurrence: T.Occurrence; operation: T.OperationDetail }>(`/recurring/occurrences/${id}/confirm`, body, key),
  skipOccurrence: (id: string, note?: string) => post<T.Occurrence>(`/recurring/occurrences/${id}/skip`, { note }),
  linkOccurrence: (id: string, operationId: string) => post<T.Preview>(`/recurring/occurrences/${id}/link`, { operationId }),
  reopenOccurrence: (id: string) => post<T.Occurrence>(`/recurring/occurrences/${id}/reopen`),

  previewReconcile: (accountId: string, body: { realBalance: string; asOf?: string }) => post<T.Preview>(`/accounts/${accountId}/reconciliation/preview`, body),
  reconcile: (accountId: string, body: { realBalance: string; asOf?: string; reason?: string; previewToken: string }, key: string) => post<T.Reconciliation>(`/accounts/${accountId}/reconciliation`, body, key),
  reconciliations: async (accountId: string) => (await get<{ items: T.Reconciliation[] }>(`/accounts/${accountId}/reconciliations`)).items,

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

export interface RuleBody { name: string; priority?: number; accountId?: string | null; direction?: "income" | "expense" | null; amountMin?: string | null; amountMax?: string | null; textContains?: string | null; action: "assign" | "suggest"; categoryId: string }
export interface StatementBody { cutoffDate: string; dueDate: string; periodTotal: string; minimumPayment: string; totalBalance?: string | null; note?: string | null }
export interface InstallmentBody { amount: string; installments: number; firstDueDate: string; description?: string; categoryId?: string | null; date?: string }
export interface LoanBody {
  direction: "lent" | "borrowed"; contactId?: string | null; counterpartyName?: string | null; principal: string; openedOn?: string; accountId?: string | null;
  interest: { mode: "none" | "fixed" | "percent"; amount?: string | null; ratePercent?: string | null; base?: "original" | "pending" };
  repayment: { kind: "installments" | "final_date" | "open"; installments?: number; firstDueDate?: string; finalDate?: string };
  paymentOrder?: "capital_first" | "interest_first"; earlyPayoff?: "keep" | "accrued"; note?: string | null;
}
export interface LoanPaymentBody { amount: string; accountId: string; paidOn?: string; allocations?: Array<{ chargeId: string; amount: string }>; onRemainder?: "keep" }
export interface LateFeeBody { mode: "fixed" | "percent"; amount?: string | null; ratePercent?: string | null }
export interface BudgetBody {
  name: string; categoryId?: string | null; includeSubcategories?: boolean; period: "weekly" | "monthly" | "yearly"; limit: string; thresholds?: number[];
  rollover?: boolean; rolloverCap?: string | null; sharedView?: "origin_cycle" | "receipt_date"; startsOn?: string;
}
export interface GoalBody { name: string; targetAmount: string; targetDate?: string | null; note?: string | null }
export interface RecurringBody {
  name: string; kind: "income" | "expense"; accountId: string; amount: string; categoryId?: string | null; contactId?: string | null; description?: string;
  interval: T.Interval; startDate: string; endDate?: string | null;
}
export interface OccurrenceConfirmBody { amount?: string; accountId?: string; date?: string; description?: string; categoryId?: string | null; goalDeductions?: Array<{ goalId: string; amount: string }>; acceptReserveShortfall?: boolean }

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
  GOAL_RESERVE_CONFLICT: "Este gasto usa dinero reservado para una meta: elige de qué meta se descuenta o acepta el faltante.",
  GOAL_DEDUCTION_INSUFFICIENT: "Lo descontado de las metas no cubre el dinero reservado que usa este gasto.",
  GOAL_DEDUCTION_EXCEEDS: "Una meta no tiene tanto reservado en esa cuenta.",
  INSUFFICIENT_FREE_BALANCE: "La cuenta no tiene tanto dinero libre para reservar.",
  RELEASE_EXCEEDS_RESERVED: "No hay tanto reservado en esa cuenta para esta meta.",
  GOAL_ACCOUNT_TYPE: "Una tarjeta de crédito no tiene dinero propio que reservar.",
  GOAL_DATE_PAST: "La fecha de la meta debe ser posterior a hoy.",
  TRANSFER_ALREADY_LINKED: "Esa transferencia ya está vinculada a una meta.",
  NOT_A_TRANSFER: "Solo una transferencia confirmada se puede vincular.",
  CATEGORY_ARCHIVED: "La categoría está archivada.",
  CATEGORY_NAME_EXISTS: "Ya existe una categoría con ese nombre en este nivel.",
  CATEGORY_DEPTH_EXCEEDED: "Solo hay dos niveles: categoría y subcategoría.",
  RULE_WITHOUT_CONDITION: "La regla necesita al menos una condición.",
  RULE_AMOUNT_RANGE: "El importe mínimo no puede superar al máximo.",
  BUDGET_EXISTS: "Ya tienes un presupuesto activo para esa categoría y ese período.",
  ROLLOVER_REQUIRED: "El tope de arrastre solo aplica si el presupuesto arrastra el saldo.",
  STATEMENT_EXISTS: "Ya registraste el estado de cuenta de ese corte.",
  STATEMENT_DATES: "La fecha de pago no puede ser anterior al corte.",
  NOT_CREDIT_ACCOUNT: "Esa cuenta no es una tarjeta de crédito.",
  NOT_A_CARD_PAYMENT: "Solo una transferencia confirmada hacia esta tarjeta cuenta como su pago.",
  PAYMENT_ALREADY_LINKED: "Ese pago ya está vinculado a un estado de cuenta.",
  INTEREST_REQUIRED: "Indica el interés o la mora que quieres aplicar.",
  REPAYMENT_REQUIRED: "Indica cómo se devuelve el préstamo.",
  REPAYMENT_DATES: "Las fechas de devolución deben ser posteriores al inicio.",
  PAYMENT_REMAINDER: "Sobra dinero: aplícalo a más cargos o conserva el sobrante como saldo a favor.",
  LOAN_HAS_PAYMENTS: "El préstamo ya tiene pagos: revierte primero esos pagos.",
  LOAN_NOT_OPEN: "El préstamo no está abierto.",
  NOTHING_TO_CAPITALIZE: "No hay interés vencido y sin pagar para capitalizar.",
  OCCURRENCE_DECIDED: "Esta ocurrencia ya se decidió.",
  OCCURRENCE_NOT_REOPENABLE: "Solo se reabre una ocurrencia omitida o cuyo movimiento fue revertido.",
  OPERATION_MISMATCH: "Ese movimiento no corresponde al tipo de la ocurrencia.",
  OPERATION_ALREADY_LINKED: "Ese movimiento ya cumple otra ocurrencia.",
  RECURRING_DATES: "La fecha final no puede ser anterior al inicio.",
  IDEMPOTENCY_KEY_REUSED: "Esta acción ya se envió con otros datos.",
};

export function errorMessage(e: unknown): string {
  const anyE = e as { code?: string; message?: string };
  return (anyE.code && ERROR_TEXT[anyE.code]) || anyE.message || "Ocurrió un error inesperado.";
}
