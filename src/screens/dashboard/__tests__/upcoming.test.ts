import { buildUpcoming, attentionSignature, countUnreadAttention, shortWhenBadge } from "../upcoming";
import type { AttentionItem } from "../attention";

const TODAY = "2026-11-22";

describe("Próximos vencimientos y notificaciones vistas en Inicio", () => {
  it("etiqueta días de forma corta y clara", () => {
    expect(shortWhenBadge(-2)).toBe("Hace 2 días");
    expect(shortWhenBadge(-1)).toBe("Venció ayer");
    expect(shortWhenBadge(0)).toBe("Vence hoy");
    expect(shortWhenBadge(1)).toBe("Mañana");
    expect(shortWhenBadge(5)).toBe("En 5 días");
  });

  it("reúne tarjetas, servicios, préstamos y recurrentes ordenados por urgencia", () => {
    const items = buildUpcoming(
      [
        {
          id: "renewals",
          data: {
            items: [
              { subscriptionId: "s1", name: "Netflix", renewsOn: "2026-11-26", price: "45.00" },
              { subscriptionId: "s2", name: "Lejano", renewsOn: "2026-12-20", price: "20.00" },
            ],
          },
        },
        {
          id: "upcoming_payments",
          data: {
            items: [
              { type: "card_debt", id: "c1", name: "Pago tarjeta Visa BCP", dueDate: "2026-11-23", amount: "100.00" },
              { type: "card_statement", id: "st1", name: "Pago tarjeta Interbank", dueDate: "2026-11-21", amount: "250.00" },
              { type: "bank_loan", id: "l1", name: "Préstamo · cuota 3", dueDate: "2026-11-25", amount: "300.00" },
              { type: "recurring", id: "o1", name: "Alquiler", dueDate: "2026-11-22", amount: "900.00" },
            ],
          },
        },
      ],
      TODAY,
    );

    expect(items.map((x) => [x.kind, x.title, x.badgeText, x.tone, x.route])).toEqual([
      ["card", "Interbank", "Venció ayer", "danger", "/card-statement/st1"],
      ["recurring", "Alquiler", "Vence hoy", "warn", "/recurring/occurrence/o1"],
      ["card", "Visa BCP", "Mañana", "warn", "/account/c1/card"],
      ["loan", "Préstamo · cuota 3", "En 3 días", "info", "/bank-loan/l1"],
      ["service", "Netflix", "En 4 días", "info", "/service/s1"],
    ]);
  });

  it("marca notificaciones como vistas y vuelve a avisar si aparece una nueva o cambia su urgencia", () => {
    const a1: AttentionItem = { id: "pay-card-1", icon: "card-outline", tone: "warn", title: "Visa vence mañana", text: "S/ 100.00", route: "/account/1/card", urgency: 85 };
    const a2: AttentionItem = { id: "ren-s1", icon: "calendar-outline", tone: "info", title: "Netflix renueva en 3 días", text: "S/ 45.00", route: "/service/s1", urgency: 70 };

    const seen = new Set<string>();
    expect(countUnreadAttention([a1, a2], seen)).toBe(2);

    // Al abrir la campanita, se guardan sus firmas → 0 sin leer.
    seen.add(attentionSignature(a1));
    seen.add(attentionSignature(a2));
    expect(countUnreadAttention([a1, a2], seen)).toBe(0);

    // Al día siguiente, a1 pasa a vencido → vuelve a contar como 1 no vista.
    const a1Overdue: AttentionItem = { ...a1, tone: "danger", title: "Visa venció ayer" };
    expect(countUnreadAttention([a1Overdue, a2], seen)).toBe(1);
  });
});
