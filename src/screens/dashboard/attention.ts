// Qué merece tu atención hoy: se arma a partir de las tarjetas del panel y del resumen, ordenado por urgencia.
// Lógica pura (sin pantalla) para poder probarla.

export type Tone = "danger" | "warn" | "info";
export interface AttentionItem { id: string; icon: string; tone: Tone; title: string; text?: string; route: string; urgency: number }

type Card = { id: string; data: any };
export interface AttentionInput { cards: Card[]; recurringPending?: number; today: string }

const DAY = 86_400_000;
/** Días de `today` a `iso` (negativo si ya pasó). Ambos AAAA-MM-DD, sin zonas horarias. */
export const daysUntil = (iso: string, today: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

export function whenText(days: number): string {
  if (days < 0) return days === -1 ? "venció ayer" : `venció hace ${-days} días`;
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

/** «vence mañana», «vence en 4 días», «venció hace 18 días». */
export const dueText = (days: number) => (days < 0 ? whenText(days) : `vence ${whenText(days)}`);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildAttention({ cards, recurringPending = 0, today }: AttentionInput): AttentionItem[] {
  const by = (id: string) => cards.find((c) => c.id === id)?.data;
  const out: AttentionItem[] = [];

  const col = by("pending_collections");
  if (col) {
    const overdue = Number(col.overdue), pending = Number(col.pending);
    if (overdue > 0) out.push({ id: "col-overdue", icon: "alert-circle-outline", tone: "danger", title: "Cobros vencidos", text: `S/ ${col.overdue} de ${plural(col.debtors, "persona", "personas")} · te deben S/ ${col.pending} en total`, route: "/people", urgency: 100 });
    else if (pending > 0) out.push({ id: "col-pending", icon: "people-outline", tone: "info", title: `Te deben S/ ${col.pending}`, text: plural(col.debtors, "persona", "personas"), route: "/people", urgency: 40 });
  }

  const bud = by("budgets");
  for (const b of (bud?.budgets ?? []) as Array<{ id: string; name: string; percent: number | null; exceeded: boolean; level: number | null }>) {
    if (b.exceeded) out.push({ id: `bud-${b.id}`, icon: "speedometer-outline", tone: "danger", title: `${b.name}: excedido`, text: `${Math.round(b.percent ?? 0)}% del límite`, route: `/budgets/${b.id}`, urgency: 80 });
    else if ((b.percent ?? 0) >= 85) out.push({ id: `bud-${b.id}`, icon: "speedometer-outline", tone: "warn", title: `${b.name}: casi al límite`, text: `${Math.round(b.percent ?? 0)}% usado`, route: `/budgets/${b.id}`, urgency: 55 });
  }

  const cap = by("capture_pending");
  if (cap) {
    if (cap.failedDocuments > 0) out.push({ id: "cap-failed", icon: "document-text-outline", tone: "danger", title: plural(cap.failedDocuments, "documento no se pudo leer", "documentos no se pudieron leer"), route: "/capture", urgency: 90 });
    if (cap.pendingProposals > 0) out.push({ id: "cap-pending", icon: "scan-outline", tone: "info", title: plural(cap.pendingProposals, "propuesta por revisar", "propuestas por revisar"), text: "Comprobantes que aún no son tus datos", route: "/capture", urgency: 60 });
    if (cap.acceptedToClassify > 0) out.push({ id: "cap-classify", icon: "pricetags-outline", tone: "info", title: plural(cap.acceptedToClassify, "movimiento sin categoría", "movimientos sin categoría"), route: "/classify", urgency: 30 });
  }

  if (recurringPending > 0) out.push({ id: "rec", icon: "repeat-outline", tone: "warn", title: plural(recurringPending, "recurrente por decidir", "recurrentes por decidir"), text: "Confírmalos u omítelos", route: "/recurring", urgency: 60 });

  for (const r of ((by("renewals")?.items ?? []) as Array<{ subscriptionId: string; name: string; renewsOn: string; price: string }>).slice(0, 3)) {
    const d = daysUntil(r.renewsOn, today);
    if (d <= 7) out.push({ id: `ren-${r.subscriptionId}`, icon: "calendar-outline", tone: d <= 1 ? "warn" : "info", title: `${r.name} renueva ${whenText(d)}`, text: `S/ ${r.price}`, route: `/service/${r.subscriptionId}`, urgency: d <= 1 ? 85 : d <= 3 ? 70 : 50 });
  }

  for (const p of ((by("upcoming_payments")?.items ?? []) as Array<{ type: string; id: string; name: string; dueDate: string; amount: string }>)) {
    const d = daysUntil(p.dueDate, today);
    if (d <= 7) out.push({ id: `pay-${p.type}-${p.id}`, icon: "card-outline", tone: d < 0 ? "danger" : d <= 1 ? "warn" : "info", title: `${p.name} ${dueText(d)}`, text: `S/ ${p.amount}`, route: p.type === "bank_loan" ? `/bank-loan/${p.id}` : `/recurring/occurrence/${p.id}`, urgency: d < 0 ? 95 : d <= 1 ? 85 : 55 });
  }

  return out.sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));
}
