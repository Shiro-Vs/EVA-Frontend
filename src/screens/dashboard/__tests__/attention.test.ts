import { buildAttention, daysUntil, whenText } from "../attention";

const TODAY = "2026-10-29";

describe("Qué merece atención en el inicio", () => {
  it("cuenta días y los dice en español", () => {
    expect(daysUntil("2026-10-31", TODAY)).toBe(2);
    expect(daysUntil("2026-10-28", TODAY)).toBe(-1);
    expect(whenText(0)).toBe("hoy");
    expect(whenText(1)).toBe("mañana");
    expect(whenText(5)).toBe("en 5 días");
    expect(whenText(-1)).toBe("venció ayer");
    expect(whenText(-3)).toBe("venció hace 3 días");
  });

  it("sin nada pendiente no inventa avisos", () => {
    expect(buildAttention({ cards: [], today: TODAY })).toEqual([]);
    expect(buildAttention({ cards: [{ id: "pending_collections", data: { pending: "0.00", overdue: "0.00", debtors: 0 } }], today: TODAY })).toEqual([]);
  });

  it("ordena por urgencia: vencido primero, luego presupuestos excedidos, captura y renovaciones", () => {
    const items = buildAttention({
      today: TODAY, recurringPending: 2,
      cards: [
        { id: "pending_collections", data: { pending: "120.00", overdue: "47.00", debtors: 2 } },
        { id: "budgets", data: { budgets: [{ id: "b1", name: "Comida", percent: 151.7, exceeded: true, level: 100 }, { id: "b2", name: "Ocio", percent: 40, exceeded: false, level: null }] } },
        { id: "capture_pending", data: { pendingProposals: 4, acceptedToClassify: 1, failedDocuments: 0 } },
        { id: "renewals", data: { items: [{ subscriptionId: "s1", name: "Netflix", renewsOn: "2026-10-30", price: "44.90" }, { subscriptionId: "s2", name: "HBO", renewsOn: "2026-12-01", price: "32.90" }] } },
      ],
    });
    expect(items.map((i) => i.id)).toEqual(["col-overdue", "ren-s1", "bud-b1", "rec", "cap-pending", "cap-classify"]);
    expect(items[0]).toMatchObject({ tone: "danger", route: "/people" });
    expect(items.find((i) => i.id === "ren-s1")!.title).toBe("Netflix renueva mañana");
    expect(items.find((i) => i.id === "bud-b1")!.text).toBe("152% del límite");
  });

  it("solo avisa de renovaciones y pagos de la próxima semana", () => {
    const items = buildAttention({
      today: TODAY,
      cards: [
        { id: "renewals", data: { items: [{ subscriptionId: "s1", name: "Spotify", renewsOn: "2026-11-20", price: "26.90" }] } },
        { id: "upcoming_payments", data: { items: [{ type: "bank_loan", id: "l1", name: "Préstamo BCP · cuota 6", dueDate: "2026-11-02", amount: "406.02" }, { type: "recurring", id: "o1", name: "Gimnasio", dueDate: "2026-11-30", amount: "89.00" }] } },
      ],
    });
    expect(items).toEqual([expect.objectContaining({ id: "pay-bank_loan-l1", route: "/bank-loan/l1", title: "Préstamo BCP · cuota 6 vence en 4 días" })]);
  });

  it("un presupuesto cerca del límite avisa distinto a uno excedido y respeta el umbral del servidor", () => {
    const [i] = buildAttention({ today: TODAY, cards: [{ id: "budgets", data: { budgets: [{ id: "b", name: "Total", percent: 75, exceeded: false, level: 70 }] } }] });
    expect(i).toMatchObject({ tone: "warn", title: "Total: casi al límite" });
  });

  it("no duplica recurrentes cuando ya aparecen en próximos pagos", () => {
    const items = buildAttention({
      today: TODAY,
      recurringPending: 1,
      cards: [{ id: "upcoming_payments", data: { items: [{ type: "recurring", id: "o1", name: "Alquiler", dueDate: "2026-10-29", amount: "900.00" }] } }],
    });
    expect(items.map((x) => x.id)).toEqual(["pay-recurring-o1"]);
  });

  it("muestra pagos próximos y vencidos de tarjetas de crédito con su ruta correcta", () => {
    const items = buildAttention({
      today: TODAY,
      cards: [
        {
          id: "upcoming_payments",
          data: {
            items: [
              { type: "card_debt", id: "c1", name: "Pago tarjeta Visa BCP", dueDate: "2026-10-30", amount: "100.00" },
              { type: "card_statement", id: "st1", name: "Pago tarjeta Interbank", dueDate: "2026-10-28", amount: "250.00" },
            ],
          },
        },
      ],
    });
    expect(items).toEqual([
      expect.objectContaining({ id: "pay-card_statement-st1", tone: "danger", title: "Pago tarjeta Interbank venció ayer", text: "S/ 250.00", route: "/card-statement/st1" }),
      expect.objectContaining({ id: "pay-card_debt-c1", tone: "warn", title: "Pago tarjeta Visa BCP vence mañana", text: "S/ 100.00", route: "/account/c1/card" }),
    ]);
  });
});
