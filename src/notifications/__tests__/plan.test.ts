import { identifierOf, MAX_SCHEDULED, parseLocal, planNotifications, type ReminderItem } from "../plan";

const NOW = new Date(2026, 10, 3, 9, 0, 0); // 3 nov 2026, 09:00 locales
const item = (id: string, fireAt: string[], over: Partial<ReminderItem> = {}): ReminderItem => ({ id, title: "Tienes renovaciones próximas", detail: null, route: "/service/1", fireAt, ...over });

describe("Planificación de notificaciones locales", () => {
  it("interpreta la hora local sin mover la zona", () => {
    const d = parseLocal("2026-11-04T09:30")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 4, 9, 30]);
    expect(parseLocal("2026-11-04 09:30")).toBeNull();
    expect(parseLocal("hoy")).toBeNull();
    expect(parseLocal("2026-13-40T09:00")).toBeNull();
  });

  it("programa solo lo futuro, en orden, con texto discreto por defecto", () => {
    const p = planNotifications([item("renewal:1", ["2026-11-07T09:00", "2026-11-03T08:00", "2026-11-04T09:00"])], [], NOW);
    expect(p.schedule.map((s) => s.identifier)).toEqual(["eva:renewal:1@2026-11-04T09:00", "eva:renewal:1@2026-11-07T09:00"]); // la de las 08:00 ya pasó
    expect(p.schedule[0]).toMatchObject({ title: "EVA", body: "Tienes renovaciones próximas", route: "/service/1" });
    expect(p.cancel).toEqual([]);
    expect(p.desired).toBe(2);
  });

  it("usa el detalle solo si el servidor lo mandó (el usuario lo habilitó)", () => {
    const p = planNotifications([item("renewal:1", ["2026-11-05T09:00"], { detail: "Renueva Netflix (S/ 45.00)" })], [], NOW);
    expect(p.schedule[0]!.body).toBe("Renueva Netflix (S/ 45.00)");
  });

  it("es incremental: no reprograma lo que ya está y cancela lo que ya no corresponde", () => {
    const keep = identifierOf("renewal:1", "2026-11-04T09:00");
    const stale = identifierOf("loan:9", "2026-11-05T09:00");
    const p = planNotifications([item("renewal:1", ["2026-11-04T09:00", "2026-11-06T09:00"])], [keep, stale], NOW);
    expect(p.schedule.map((s) => s.identifier)).toEqual(["eva:renewal:1@2026-11-06T09:00"]);
    expect(p.cancel).toEqual([stale]);
  });

  it("nunca toca notificaciones que no son de EVA", () => {
    const p = planNotifications([], ["otra-app-123", "eva:x@2026-11-04T09:00"], NOW);
    expect(p.cancel).toEqual(["eva:x@2026-11-04T09:00"]);
  });

  it("si el aviso se apagó (lista vacía) se cancela todo lo nuestro", () => {
    const ids = [identifierOf("a", "2026-11-04T09:00"), identifierOf("b", "2026-11-05T09:00")];
    expect(planNotifications([], ids, NOW)).toMatchObject({ schedule: [], cancel: ids, desired: 0 });
  });

  it("respeta el límite del teléfono quedándose con las más próximas", () => {
    const fire = Array.from({ length: 80 }, (_, i) => `2026-12-${String((i % 28) + 1).padStart(2, "0")}T${String(8 + Math.floor(i / 28)).padStart(2, "0")}:00`);
    const p = planNotifications([item("x", fire)], [], NOW);
    expect(p.schedule).toHaveLength(MAX_SCHEDULED);
    const times = p.schedule.map((s) => s.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("ignora horas mal formadas sin romper", () => {
    expect(planNotifications([item("x", ["mañana", "2026-11-04T09:00"])], [], NOW).schedule).toHaveLength(1);
  });
});
