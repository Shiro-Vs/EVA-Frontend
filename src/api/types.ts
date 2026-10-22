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
export interface Seat extends Omit<SeatSummary, "pending" | "overdue"> { charges: Charge[] }

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
  loans: unknown[]; shareText: string; asOf: IsoDate;
}

export interface Summary {
  asOf: IsoDate;
  balance: { net: Money; accounts: number };
  receivable: { pending: Money; overdue: Money; debtors: number; creditFree: Money; creditReserved: Money };
  subscriptions: { active: number; currentCycleTotal: Money };
  recent: Array<{ id: string; operationId: string; kind: "income" | "expense" | "transfer" | "adjustment" | "reversal"; status: string; occurredOn: IsoDate; description: string; account: { id: string; name: string }; amount: Money }>;
}
