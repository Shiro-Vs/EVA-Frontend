// Próximos vencimientos para el carrusel compacto de Inicio + estado «visto» de la campanita.
// Lógica pura para poder probarla sin pantalla.

import { daysUntil, type AttentionItem } from "./attention";

export type UpcomingKind = "card" | "service" | "loan" | "recurring";
export type UpcomingTone = "danger" | "warn" | "info";

export interface UpcomingCardItem {
  id: string;
  kind: UpcomingKind;
  kindLabel: string;
  icon: string;
  title: string;
  amount: string;
  dueDate: string;
  days: number;
  badgeText: string;
  tone: UpcomingTone;
  route: string;
}

type Card = { id: string; data: any };

export function shortWhenBadge(days: number): string {
  if (days < 0) return days === -1 ? "Venció ayer" : `Hace ${-days} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

export function toneForDays(days: number): UpcomingTone {
  if (days < 0) return "danger";
  if (days <= 1) return "warn";
  return "info";
}

/** Construye los vencimientos de los próximos 14 días (y vencidos) en orden de urgencia para el carrusel de Inicio. */
export function buildUpcoming(cards: Card[], today: string, maxDays = 14): UpcomingCardItem[] {
  const by = (id: string) => cards.find((c) => c.id === id)?.data;
  const out: UpcomingCardItem[] = [];

  const renewals = (by("renewals")?.items ?? []) as Array<{ subscriptionId: string; name: string; renewsOn: string; price: string }>;
  for (const r of renewals) {
    const days = daysUntil(r.renewsOn, today);
    if (days > maxDays) continue;
    out.push({
      id: `ren-${r.subscriptionId}-${r.renewsOn}`,
      kind: "service",
      kindLabel: "Servicio",
      icon: "calendar-outline",
      title: r.name,
      amount: r.price,
      dueDate: r.renewsOn,
      days,
      badgeText: shortWhenBadge(days),
      tone: toneForDays(days),
      route: `/service/${r.subscriptionId}`,
    });
  }

  const upcoming = (by("upcoming_payments")?.items ?? []) as Array<{ type: string; id: string; name: string; dueDate: string; amount: string }>;
  for (const p of upcoming) {
    const days = daysUntil(p.dueDate, today);
    if (days > maxDays) continue;

    if (p.type === "card_statement" || p.type === "card_debt") {
      const cleanName = p.name.replace(/^Pago tarjeta\s+/i, "").trim() || p.name;
      out.push({
        id: `pay-${p.type}-${p.id}-${p.dueDate}`,
        kind: "card",
        kindLabel: "Tarjeta",
        icon: "card-outline",
        title: cleanName,
        amount: p.amount,
        dueDate: p.dueDate,
        days,
        badgeText: shortWhenBadge(days),
        tone: toneForDays(days),
        route: p.type === "card_statement" ? `/card-statement/${p.id}` : `/account/${p.id}/card`,
      });
    } else if (p.type === "bank_loan") {
      out.push({
        id: `pay-loan-${p.id}-${p.dueDate}`,
        kind: "loan",
        kindLabel: "Préstamo",
        icon: "business-outline",
        title: p.name,
        amount: p.amount,
        dueDate: p.dueDate,
        days,
        badgeText: shortWhenBadge(days),
        tone: toneForDays(days),
        route: `/bank-loan/${p.id}`,
      });
    } else {
      out.push({
        id: `pay-rec-${p.id}-${p.dueDate}`,
        kind: "recurring",
        kindLabel: "Recurrente",
        icon: "repeat-outline",
        title: p.name,
        amount: p.amount,
        dueDate: p.dueDate,
        days,
        badgeText: shortWhenBadge(days),
        tone: toneForDays(days),
        route: `/recurring/occurrence/${p.id}`,
      });
    }
  }

  return out.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
}

/** Firma estable de una notificación: si cambia su urgencia o contenido vuelve a marcarse como no vista. */
export const attentionSignature = (a: AttentionItem): string => `${a.id}|${a.tone}|${a.title}|${a.text ?? ""}`;

export function countUnreadAttention(items: AttentionItem[], seen: Set<string>): number {
  let n = 0;
  for (const it of items) {
    if (!seen.has(attentionSignature(it))) n++;
  }
  return n;
}
