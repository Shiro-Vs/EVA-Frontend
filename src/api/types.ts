// Tipos de las respuestas de la API v1 (docs/especificacion/13 y EVA-Backend/openapi.json).
// Dinero = cadena decimal ("20.00"); fechas locales = "YYYY-MM-DD".

export type Money = string;
export type IsoDate = string;

export interface Profile {
  id: string; displayName: string; email: string | null; timezone: string; currency: string;
  defaultFreeDays: number; exitDaysLimit: number | null; preferences: Record<string, unknown>; version: number; createdAt: string;
}

export type AccountType = "bank" | "savings" | "cash" | "wallet" | "credit";
export interface Account {
  id: string; name: string; type: AccountType; currency: string; institution: string | null; color: string | null; icon: string | null;
  isDefault: boolean; excludeFromTotal: boolean; status: "active" | "archived"; balance: Money; version: number; createdAt: string;
}
export interface AccountEntry { id: string; operationId: string; kind: string; occurredOn: IsoDate; description: string; operationStatus: string; amount: Money; balanceAfter: Money }

export interface ContactTotals { pending: Money; overdue: Money; creditFree: Money; creditReserved: Money }
export interface Contact {
  id: string; name: string; phone: string | null; email: string | null; color: string | null; notes: string | null;
  status: "active" | "archived"; version: number; createdAt: string; totals: ContactTotals; activeSeats: number; services: number;
}

export interface Interval { unit: "day" | "week" | "month" | "year"; count: number }
export interface CycleRef { id: string; seq: number; startDate: IsoDate; endDate: IsoDate; announcedPrice: Money; baseDays: number }
export interface Subscription {
  id: string; name: string; provider: string | null; mode: "personal" | "shared"; capacity: number; preferredAccountId: string | null;
  color: string | null; icon: string | null; status: string; currency: string; version: number; createdAt: string; occupiedSeats: number;
  terms: { announcedPrice: Money; interval: Interval; anchor: IsoDate; validFrom: IsoDate } | null;
  currentCycle: CycleRef | null; nextCycle: CycleRef | null; baseDays: number | null;
}

export type PaymentStatus = "exempt" | "unpaid" | "partial" | "paid" | "converted";
export interface Charge {
  obligationId: string; subscriptionId: string; subscriptionName: string; seatId: string; seatLabel: string; contactId: string; contactName: string;
  cycle: { id: string; start: IsoDate; end: IsoDate }; dueDate: IsoDate; mode: string;
  gross: Money; exemption: Money; net: Money; adjustments: Money; applied: Money; converted: Money; pending: Money;
  paymentStatus: PaymentStatus; overdue: boolean; calcSnapshot: unknown;
}
export interface SeatSummary {
  id: string; label: string; subscriptionId: string; isOwner: boolean; contact: { id: string; name: string } | null;
  startDate: IsoDate; endDate: IsoDate | null; quota: Money; pending: Money; overdue: boolean;
}
export interface Seat extends Omit<SeatSummary, "pending" | "overdue"> {
  charges: Charge[];
  scheduledQuota: { quota: Money; from: IsoDate } | null;
  voidedCharges: Array<{ obligationId: string; cycle: { start: IsoDate; end: IsoDate }; gross: Money; reason: string; voidedAt: string }>;
}

export interface CostSummary {
  cycleId: string; announcedPrice: Money; actualPaid: Money | null; expectedFromOthers: Money; receivedFromOthers: Money;
  pendingFromOthers: Money; projectedCost: Money; costByCollections: Money; surplus: Money; estimated: boolean;
}
export interface SupplierPayment { id: string; operationId: string; amount: Money; announcedPrice: Money; paidOn: IsoDate; account: { id: string; name: string } | null }
export interface CycleDetail {
  id: string; subscriptionId: string; subscriptionName: string; seq: number; startDate: IsoDate; endDate: IsoDate; announcedPrice: Money; baseDays: number;
  charges: Charge[]; supplierPayment: SupplierPayment | null; costSummary: CostSummary;
}

// ---- Vistas previas ----
export interface SubscriptionPreview {
  calendar: { ok: boolean; expectedNextPayment: IsoDate; diffDays: number };
  suggestedQuota: { amount: Money; occupiedSeats: number; formula: string };
  cycles: Array<{ seq: number; startDate: IsoDate; endDate: IsoDate }>;
  baseDays: number; previewToken: string;
}
export interface SeatPreview {
  cycle: { id: string; startDate: IsoDate; endDate: IsoDate }; contact: { id: string; name: string };
  calculation: {
    mode: "full_cycle" | "trial_free" | "partial_charged"; remainingDays: number; baseDays: number; freeDaysThreshold: number; quota: Money;
    prorated: Money; gross: Money; exemption: Money; net: Money; rule: string; formula: string; gSource: "plaza" | "usuario";
  };
  dueDate: IsoDate; next: { cycleStart: IsoDate; dueDate: IsoDate; amount: Money };
  occupancy: { occupied: number; capacity: number }; warnings: string[]; previewToken: string;
}
export type AllocationIssue =
  | { code: "EXCEEDS_RECEIPT"; available: Money; requested: Money }
  | { code: "EXCEEDS_OBLIGATION"; obligationId: string; pending: Money; requested: Money }
  | { code: "NON_POSITIVE" | "DUPLICATE_OBLIGATION"; obligationId: string };
export interface ReceiptPreview {
  valid: boolean; issues: AllocationIssue[];
  summary: { received: Money; applied: Money; remainder: Money; reservedTo: string | null };
  allocations: Array<{ obligationId: string; amount: Money; pendingBefore: Money; pendingAfter: Money }>;
  account: { id: string; balanceAfter: Money }; singleIncome: true; previewToken?: string;
}
export interface ReceiptAvailability { received: Money; applied: Money; refunded: Money; reserved: Money; unapplied: Money; free: Money }
export interface ReceiptCreated {
  receipt: { id: string; amount: Money; operationId: string; status: string; version: number };
  allocations: Array<{ id: string; obligationId: string; amount: Money }>; availability: ReceiptAvailability; account: { id: string; balanceAfter: Money };
}
export interface ContactCredit {
  contactId: string; total: Money; reserved: Money; free: Money;
  reservations: Array<{ id: string; receiptId: string; subscriptionId: string; subscriptionName: string; amount: Money }>;
}
export interface Statement {
  contact: { id: string; name: string }; totals: ContactTotals;
  services: Array<{ subscriptionId: string; name: string; seats: Array<{ seatId: string; label: string; quota: Money; pending: Money }>; charges: Charge[] }>;
  loans: Loan[]; shareText: string; asOf: IsoDate;
}

export interface Summary {
  asOf: IsoDate;
  balance: { net: Money; accounts: number };
  receivable: { pending: Money; overdue: Money; debtors: number; creditFree: Money; creditReserved: Money };
  subscriptions: { active: number; currentCycleTotal: Money };
  recent: Array<{ id: string; operationId: string; kind: "income" | "expense" | "transfer" | "adjustment" | "reversal"; status: string; occurredOn: IsoDate; description: string; account: { id: string; name: string }; amount: Money }>;
}

// ---- Entrega 2 ----
/** Vista previa devuelta por la API: la forma exacta depende de la operación (docs 13); `previewToken` autoriza aplicarla. */
export type Preview = Record<string, any> & { previewToken?: string };

export interface Refund {
  id: string; receiptId: string; contact: { id: string; name: string }; amount: Money; status: "planned" | "paid" | "cancelled";
  plannedOn: IsoDate | null; operationId: string | null; reason: string; createdAt: string;
}
export interface LoanComponent {
  obligationId: string; concept: string; periodLabel: string | null; originObligationId: string | null; amount: Money; pending: Money; dueDate: IsoDate | null;
}
export interface Loan {
  id: string; contactId: string; contactName: string; principal: Money; openedOn: IsoDate; origin: string; status: "open" | "closed"; pending: Money;
  conversion: { trigger: string; reason: string } | null; createdAt: string; components: LoanComponent[];
}
export interface Courtesy {
  id: string; seatId: string; kind: "cycles" | "until_date" | "permanent"; startsOn: IsoDate; untilDate: IsoDate | null; cyclesTotal: number | null; cyclesUsed: number;
  reason: string; status: "active" | "ended"; createdAt: string; endedAt: string | null;
}
export interface CalendarChange {
  id: string; kind: string; effectiveOn: IsoDate; oldCurrentEnd: IsoDate | null; newCurrentEnd: IsoDate | null; reason: string; createdAt: string;
}
export interface TermsVersion {
  id: string; validFrom: IsoDate; validTo: IsoDate | null; announcedPrice: Money; interval: Interval; anchor: IsoDate; reason: string | null;
}
export interface ReceiptDetail {
  id: string; contactId: string; operationId: string; amount: Money; receivedOn: IsoDate; note: string | null; status: "active" | "reversed"; version: number; createdAt: string;
  allocations: Array<{ id: string; obligationId: string; amount: Money; origin: string; status: string; releasedReason: string | null }>;
  reservations: Array<{ id: string; subscriptionId: string; amount: Money; status: string }>;
  availability: ReceiptAvailability | null;
}
export interface ContactReceipt {
  id: string; operationId: string; amount: Money; receivedOn: IsoDate; note: string | null; status: "active" | "reversed"; version: number; unapplied: Money | null; free: Money | null;
}
export interface OperationDetail {
  id: string; kind: string; occurredOn: IsoDate; description: string; status: "confirmed" | "reversed"; reversalOfId: string | null; reason: string | null; version: number; createdAt: string;
  entries: Array<{ accountId: string; amount: Money }>;
  links: { receiptId: string | null; supplierPaymentId: string | null; refundId: string | null };
}

// ---- Entrega 3 ----
export interface Category { id: string; parentId: string | null; name: string; icon: string | null; color: string | null; status: "active" | "archived"; version: number; children?: Category[] }
export interface Rule {
  id: string; name: string; priority: number; status: string; accountId: string | null; direction: "income" | "expense" | null; amountMin: Money | null; amountMax: Money | null;
  textContains: string | null; action: "assign" | "suggest"; category: { id: string; name: string }; version: number;
}
export interface OperationItem {
  id: string; kind: string; concept: string; occurredOn: IsoDate; description: string; status: string; category: { id: string; name: string } | null; contactId: string | null;
  accountId: string | null; toAccountId: string | null; amount: Money; links: { receipt: boolean; refund: boolean; supplierPayment: boolean };
}
export interface CreditDetails { creditLine: Money | null; cutoffDay: number; dueDay: number; version: number }
export interface CardStatement {
  id: string; accountId: string; cutoffDate: IsoDate; dueDate: IsoDate; periodTotal: Money; minimumPayment: Money; totalBalance: Money | null; note: string | null;
  status: "unpaid" | "partial" | "paid" | "void"; paid: Money; remaining: Money; minimumCovered: boolean; overdue: boolean; payments: Array<{ id: string; operationId: string; occurredOn: IsoDate; amount: Money }>;
}
export interface InstallmentPlan { id: string; description: string; principal: Money; installments: number; status: string; upcomingTotal: Money; schedule: Array<{ number: number; dueDate: IsoDate; amount: Money }> }
export interface BudgetStatus {
  period: { start: IsoDate; end: IsoDate; kind: string }; limit: Money; carry: Money; available: Money; spent: Money; remaining: Money; overBy: Money; percent: number | null;
  thresholdsReached: number[]; level: number | null; exceeded: boolean; breakdown: { gross: Money; collectionsOffset: Money };
}
export interface Budget {
  id: string; name: string; category: { id: string; name: string } | null; includeSubcategories: boolean; period: "weekly" | "monthly" | "yearly"; thresholds: number[];
  rollover: boolean; rolloverCap: Money | null; sharedView: string; status: string; version: number; current: BudgetStatus;
  items?: Array<{ operationId: string; date: IsoDate; description: string; amount: Money; sharedService: boolean }>; shared?: Array<Record<string, string>>;
}
export interface Goal {
  id: string; name: string; targetAmount: Money; targetDate: IsoDate | null; status: string; version: number; saved: Money; remaining: Money; percent: number; achieved: boolean;
  daysLeft: number | null; accounts: Array<{ accountId: string; name: string; reserved: Money; accountBalance: Money; overReserved: boolean }>;
  contributions?: Array<{ id: string; accountName: string; amount: Money; kind: string; at: string }>;
}
export interface GoalOverview { accounts: Array<{ accountId: string; name: string; total: Money; reserved: Money; free: Money; overReserved: boolean }>; totals: { total: Money; reserved: Money; free: Money } }
export interface RecurringTemplate {
  id: string; name: string; kind: "income" | "expense"; account: { id: string; name: string }; amount: Money; categoryId: string | null; description: string; interval: Interval;
  startDate: IsoDate; endDate: IsoDate | null; status: string; nextDue: IsoDate | null; version: number; pendingCount?: number;
  occurrences?: Array<{ id: string; dueDate: IsoDate; amount: Money; status: string; operationId: string | null; operationReversed: boolean }>;
}
export interface Occurrence { id: string; templateId: string; templateName: string; kind: string; dueDate: IsoDate; amount: Money; status: string; operationId: string | null }
export interface Reconciliation { id: string; asOf: IsoDate; registeredBefore: Money; realBalance: Money; difference: Money; balanceAfter: Money; adjusted: boolean; reason: string | null }
export interface LedgerCharge {
  id: string; concept: "principal" | "interest" | "late_fee"; installmentNo: number | null; periodNo: number | null; dueDate: IsoDate | null; amount: Money; paid: Money; pending: Money; status: string; overdue: boolean;
}

// ---- Entrega 4: captura, análisis y préstamos bancarios ----
export interface InboxAddress { address: string; createdAt: string }
export interface CaptureDoc {
  id: string; origin: "email" | "photo" | "pdf" | "text"; sender: string | null; subject: string | null; mime: string; filename: string | null; sizeBytes: number; hasFile: boolean;
  receivedAt: string; status: "received" | "proposed" | "failed" | "discarded" | "no_transaction" | "loan_document"; error: { code: string; detail: string | null } | null; attempts: number; version: number;
}
export interface Proposal {
  id: string; documentId: string; status: "pending" | "accepted" | "linked" | "discarded"; direction: "income" | "expense" | "transfer"; amount: Money | null; currency: string;
  occurredOn: IsoDate | null; occurredTime: string | null; counterparty: string | null; channel: string | null; operationRef: string | null; concept: string | null; suggestedCategory: string | null;
  items: Array<{ concept: string; amount: Money | null }>; accountId: string | null; toAccountId: string | null; categoryId: string | null; contactId: string | null; description: string | null;
  missing: string[]; warnings: string[]; confidence: number | null; canAccept: boolean; duplicates: Array<{ type: "operation" | "proposal"; id: string; reason: string }>;
  operationId: string | null; source: { origin: string; sender: string | null; subject: string | null }; version: number; createdAt: string;
}
export interface CaptureDocDetail extends CaptureDoc {
  duplicate?: boolean; proposals: Proposal[];
  runs: Array<{ status: string; provider: string; model: string; tokensIn: number; tokensOut: number; errorCode: string | null; at: string }>;
}
export interface SenderRule { id: string; sender: string; accountId: string | null; categoryId: string | null; contactId: string | null; status: string; createdAt: string }
export interface CaptureUsage { today: { used: number; limit: number }; month: { tasks: number; tokensIn: number; tokensOut: number; costEstimate: string }; provider: { name: string; model: string } }
export interface AcceptPreview { valid: boolean; missing: string[]; effects: Array<{ accountId: string; before: Money; after: Money }>; duplicates: Proposal["duplicates"]; proposal: Proposal; previewToken: string }

export interface AnalysisScope { from: IsoDate; to: IsoDate; accountIds?: string[]; categoryIds?: string[]; subscriptionIds?: string[] }
export interface AnalysisCoverage { movements: number; uncategorizedExpenses: number; period: { from: IsoDate; to: IsoDate; days: number }; filters: { accounts: string[]; categories: string[]; services: string[] }; notes: string[] }
export interface AnalysisResult {
  id: string | null; saved: boolean; question?: string; answer: string; scope: AnalysisScope; coverage: AnalysisCoverage; generatedAt: string; provider: string; model: string; disclaimer: string;
}
export interface AnalysisContext { context: Record<string, any>; coverage: AnalysisCoverage }
export interface ChatSession { id: string; title: string; scope: AnalysisScope; saveHistory: boolean; createdAt: string; updatedAt: string }
export interface ChatDetail extends ChatSession { messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }> }
export interface ChatReply extends AnalysisResult { chatId: string; savedHistory: boolean }

export type LoanFactKey = "principal" | "tea" | "tcea" | "term_months" | "installments_count" | "disbursed_on" | "first_due_date" | "monthly_payment" | "outstanding_balance" | "loan_number";
export interface BankInstallment {
  id: string; number: number; dueDate: IsoDate; principal: Money | null; interest: Money | null; insurance: Money | null; fees: Money | null; total: Money; paidAmount: Money; remaining: Money;
  paidOn: IsoDate | null; late: boolean; state: "paid" | "partial" | "partial_overdue" | "overdue" | "upcoming"; origin: "document" | "user"; documentId: string | null;
}
export interface BankLoanListItem { id: string; name: string; entity: string | null; status: "active" | "closed"; nextDue: { number: number; dueDate: IsoDate; remaining: Money } | null; remainingScheduled: Money; overdue: number; pending: LoanFactKey[] }
export interface BankLoan {
  id: string; name: string; entity: string | null; accountId: string | null; note: string | null; status: "active" | "closed"; version: number; createdAt: string;
  facts: Array<{ key: LoanFactKey; value: string; asOf: IsoDate | null; origin: "document" | "user"; documentId: string | null; confirmedAt: string }>;
  pending: LoanFactKey[]; installments: BankInstallment[]; nextDue: BankLoanListItem["nextDue"];
  totals: { scheduled: Money; paid: Money; remainingScheduled: Money; overdue: number };
  payments: Array<{ id: string; installmentId: string | null; operationId: string; amount: Money; paidOn: IsoDate; principal: Money | null; interest: Money | null; insurance: Money | null; fees: Money | null; note: string | null; status: "active" | "reversed" }>;
  documents: Array<{ id: string; kind: "summary" | "schedule" | "statement"; documentId: string | null; summary: { facts: Array<{ key: string; change: string }>; installments: Array<{ number: number; change: string }>; warnings: string[] }; confirmedAt: string }>;
  warnings: Array<{ code: string; message: string; installmentNo?: number }>;
}
export type ChangeKind = "new" | "changed" | "same" | "locked" | "removed";
export interface BankChangePreview {
  kind: "summary" | "schedule" | "statement"; documentId: string | null; hasChanges: boolean; requiresAcknowledge: boolean; previewToken: string;
  facts: Array<{ key: LoanFactKey; current: string | null; incoming: string; asOf: IsoDate | null; origin: "document" | "user"; change: ChangeKind }>;
  installments: Array<{ number: number; current: BankInstallment | null; incoming: { dueDate: IsoDate; principal: Money | null; interest: Money | null; insurance: Money | null; fees: Money | null; total: Money } | null; origin: "document" | "user"; change: ChangeKind }>;
  warnings: Array<{ code: string; message: string; installmentNo?: number }>;
}
export interface BankPaymentPreview {
  amount: Money; paidOn: IsoDate; account: { id: string; before: Money; after: Money };
  installment: { number: number; dueDate: IsoDate; total: Money; paidBefore: Money; paidAfter: Money; settles: boolean; late: boolean } | null; unallocated: Money; note: string; previewToken: string;
}
