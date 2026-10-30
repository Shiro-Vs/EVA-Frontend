import React, { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { CardId, DashboardCard, LeadKind, Preferences } from "../../api/types";
import { Choice } from "../../components/v1/forms";
import { Badge, Button, Card, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";
import { MultiChoice } from "../e4/shared";
import { useLock } from "../../security/LockGate";
import { permissionStatus, requestPermission, syncReminders, type Permission } from "../../notifications/scheduler";

const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

function Row({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}><Txt size={14}>{label}</Txt>{hint ? <Txt size={11} muted>{hint}</Txt> : null}</View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

// ───────────────────────── Menú de ajustes ─────────────────────────

export function SettingsMenuScreen() {
  const router = useRouter();
  const items: Array<[string, string, string]> = [
    ["Panel", "Las tarjetas que eliges, en el orden que quieras", "/panel"],
    ["Tarjetas del panel", "Elegir y ordenar", "/settings/dashboard"],
    ["Avisos y recordatorios", "Qué avisar, cuándo y con qué detalle", "/settings/notifications"],
    ["PIN y huella", "Bloquear la app en este teléfono", "/settings/lock"],
    ["Bloqueo y captura", "Re-bloqueo, revisión de propuestas y duplicados", "/settings/general"],
    ["Respaldos", "Copias, restaurar y exportar", "/settings/backups"],
    ["Resumen mensual", "Flujo de dinero, resultado, versiones y PDF", "/reports"],
    ["Exportar", "CSV, Excel y PDF con lo que elijas", "/export"],
    ["Cuenta y privacidad", "Eliminar mi cuenta y mis datos", "/settings/account"],
  ];
  return (
    <Screen title="Ajustes" back={false}>
      {items.map(([t, s, to]) => <RowLink key={to} onPress={() => router.push(to as never)}><View style={{ flex: 1 }}><Txt bold>{t}</Txt><Txt size={12} muted>{s}</Txt></View></RowLink>)}
    </Screen>
  );
}

// ───────────────────────── Panel ─────────────────────────

const list = (n: number, f: (i: number) => React.ReactNode) => Array.from({ length: n }, (_, i) => f(i));

function CardView({ c }: { c: DashboardCard }) {
  const router = useRouter();
  const d = c.data;
  switch (c.id) {
    case "accounts_balance": return <>{(d.accounts as any[]).map((a) => <KV key={a.id} label={a.name} value={formatSoles(a.balance)} />)}<KV label="Total" value={formatSoles(d.net)} strong /></>;
    case "credit_debt": return <>{(d.cards as any[]).length === 0 ? <Txt size={13} muted>Sin tarjetas.</Txt> : (d.cards as any[]).map((a) => <KV key={a.id} label={a.name} value={formatSoles(a.debt)} />)}</>;
    case "period_flow": return <><KV label="Ingresos" value={formatSoles(d.income)} /><KV label="Gastos" value={formatSoles(d.consumption)} /><KV label="Resultado" value={formatSoles(d.net)} strong /></>;
    case "budgets": return <>{(d.budgets as any[]).length === 0 ? <Txt size={13} muted>Sin presupuestos.</Txt> : (d.budgets as any[]).map((b) => <KV key={b.id} label={b.name} value={`${b.percent ?? 0} %${b.exceeded ? " · superado" : ""}`} />)}</>;
    case "goals": return <><KV label="Total en cuentas" value={formatSoles(d.totals.total)} /><KV label="Reservado" value={formatSoles(d.totals.reserved)} /><KV label="Libre" value={formatSoles(d.totals.free)} strong /></>;
    case "renewals": return <>{(d.items as any[]).length === 0 ? <Txt size={13} muted>Nada por renovar en 14 días.</Txt> : (d.items as any[]).map((r) => <KV key={r.subscriptionId} label={`${r.name} · ${humanDate(r.renewsOn)}`} value={formatSoles(r.price)} />)}</>;
    case "pending_collections": return <><KV label="Por cobrar" value={formatSoles(d.pending)} strong /><KV label="Vencido" value={formatSoles(d.overdue)} /><KV label="Personas" value={String(d.debtors)} /></>;
    case "loans": return <><KV label="Prestado por cobrar" value={formatSoles(d.ledger.lentPending)} /><KV label="Recibido por pagar" value={formatSoles(d.ledger.borrowedPending)} />{(d.bankLoans.nextInstallments as any[]).map((b) => <KV key={`${b.loanId}${b.number}`} label={`${b.name} · cuota ${b.number} · ${humanDate(b.dueDate)}`} value={formatSoles(b.remaining)} />)}</>;
    case "capture_pending": return (
      <>
        <KV label="Propuestas por aceptar (no afectan saldo)" value={String(d.pendingProposals)} />
        <KV label="Aceptadas por clasificar (sí afectan)" value={String(d.acceptedToClassify)} />
        {d.failedDocuments > 0 && <KV label="Documentos que no se pudieron leer" value={String(d.failedDocuments)} />}
        {d.loanDocuments > 0 && <KV label="Documentos de préstamo por asociar" value={String(d.loanDocuments)} />}
        <Button title="Abrir la bandeja" variant="secondary" onPress={() => router.push("/capture" as never)} />
      </>
    );
    case "upcoming_payments": return <>{(d.items as any[]).length === 0 ? <Txt size={13} muted>Sin pagos próximos.</Txt> : (d.items as any[]).map((i) => <KV key={`${i.type}${i.id}`} label={`${i.name} · ${humanDate(i.dueDate)}`} value={formatSoles(i.amount)} />)}</>;
    default: return null;
  }
}

export function PanelScreen() {
  const router = useRouter();
  const dash = useAsync(() => api.dashboard(), []);
  useFocusReload(dash.reload);
  return (
    <Screen title="Panel" subtitle={dash.data ? `Al ${humanDate(dash.data.asOf)}` : undefined} right={<Button title="Editar" variant="secondary" onPress={() => router.push("/settings/dashboard" as never)} />}>
      {dash.loading && !dash.data ? <Loading /> : dash.error || !dash.data ? <ErrorBox message={dash.error ?? "No se pudo cargar el panel."} onRetry={dash.reload} /> : dash.data.cards.length === 0 ? (
        <Empty icon="grid-outline" title="Sin tarjetas" text="Elige qué mostrar en «Tarjetas del panel»." />
      ) : dash.data.cards.map((c) => <Card key={c.id}><Txt bold>{c.title}</Txt><CardView c={c} /></Card>)}
    </Screen>
  );
}

export function DashboardSettingsScreen() {
  const prefs = useAsync(() => api.preferences(), []);
  const [cards, setCards] = useState<Array<{ id: CardId; enabled: boolean }> | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const dash = useAsync(() => api.dashboard(), []);
  useEffect(() => { if (prefs.data) setCards(prefs.data.dashboard.cards); }, [prefs.data]);
  useEffect(() => { if (dash.data) setTitles(Object.fromEntries(dash.data.available.map((a) => [a.id, a.title]))); }, [dash.data]);
  const [saved, setSaved] = useState(false);
  const save = useSubmit(async () => { await api.savePreferences({ dashboard: { cards: cards! } }); setSaved(true); });
  const move = (i: number, d: number) => setCards((cs) => { if (!cs) return cs; const n = [...cs]; const j = i + d; if (j < 0 || j >= n.length) return cs; [n[i], n[j]] = [n[j]!, n[i]!]; setSaved(false); return n; });
  if (!cards) return <Screen title="Tarjetas del panel">{prefs.error ? <ErrorBox message={prefs.error} onRetry={prefs.reload} /> : <Loading />}</Screen>;
  return (
    <Screen title="Tarjetas del panel" subtitle="Activa las que quieras y ordénalas" footer={<Button title="Guardar" busy={save.busy} onPress={save.submit} />}>
      {cards.map((c, i) => (
        <Card key={c.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch value={c.enabled} onValueChange={(v) => { setCards(cards.map((x) => (x.id === c.id ? { ...x, enabled: v } : x))); setSaved(false); }} />
            <Txt style={{ flex: 1 }} bold>{titles[c.id] ?? c.id}</Txt>
            <Button title="↑" variant="secondary" disabled={i === 0} onPress={() => move(i, -1)} />
            <Button title="↓" variant="secondary" disabled={i === cards.length - 1} onPress={() => move(i, 1)} />
          </View>
        </Card>
      ))}
      {saved && <Notice tone="ok">Guardado.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Avisos ─────────────────────────

const KIND_LABEL: Record<string, string> = { renewal: "Renovaciones de servicios", collection: "Cobros pendientes", recurring: "Movimientos recurrentes", loan: "Cuotas de préstamos bancarios" };
const LEADS = [0, 1, 2, 3, 5, 7];

export function NotificationsSettingsScreen() {
  const prefs = useAsync(() => api.preferences(), []);
  const rem = useAsync(() => api.reminders(14), []);
  const [n, setN] = useState<Preferences["notifications"] | null>(null);
  const [saved, setSaved] = useState(false);
  const [perm, setPerm] = useState<Permission>("undetermined");
  useEffect(() => { permissionStatus().then(setPerm).catch(() => {}); }, []);
  useEffect(() => { if (prefs.data) setN(prefs.data.notifications); }, [prefs.data]);
  const allow = useSubmit(async () => { const p = await requestPermission(); setPerm(p); if (p === "granted") await syncReminders(); });
  const set = (patch: Partial<Preferences["notifications"]>) => { setN((x) => (x ? { ...x, ...patch } : x)); setSaved(false); };
  const setKind = (k: keyof Preferences["notifications"]["kinds"], v: Partial<LeadKind>) => { setN((x) => (x ? { ...x, kinds: { ...x.kinds, [k]: { ...(x.kinds[k] as LeadKind), ...v } } } : x)); setSaved(false); };
  const valid = !!n && isHHMM(n.time) && (!n.quiet || (isHHMM(n.quiet.from) && isHHMM(n.quiet.to)));
  const save = useSubmit(async () => { await api.savePreferences({ notifications: n! }); setSaved(true); await rem.reload(); await syncReminders().catch(() => {}); });
  if (!n) return <Screen title="Avisos">{prefs.error ? <ErrorBox message={prefs.error} onRetry={prefs.reload} /> : <Loading />}</Screen>;
  return (
    <Screen title="Avisos" subtitle="EVA nunca envía mensajes a otras personas" footer={<Button title="Guardar" busy={save.busy} disabled={!valid} onPress={save.submit} />}>
      {perm === "unsupported" ? <Notice tone="info">Las notificaciones del teléfono solo funcionan en la app instalada (APK), no en el navegador ni en Expo Go.</Notice> : perm !== "granted" && (
        <Card>
          <Txt bold>Permiso de notificaciones</Txt>
          <Txt size={13}>{perm === "denied" ? "Las notificaciones están bloqueadas: actívalas en los ajustes del teléfono para esta app." : "Para avisarte necesitamos tu permiso."}</Txt>
          {perm !== "denied" && <Button title="Permitir notificaciones" busy={allow.busy} onPress={allow.submit} />}
        </Card>
      )}
      <Card>
        <Row label="Activar avisos" value={n.enabled} onChange={(v) => set({ enabled: v })} />
        <Row label="Texto discreto" hint="Sin nombres ni importes en la notificación" value={n.discreet} onChange={(v) => set({ discreet: v })} />
        <Row label="Repetir lo vencido cada día" value={n.repeatOverdue} onChange={(v) => set({ repeatOverdue: v })} />
        <Field label="Hora del aviso · HH:MM" value={n.time} onChangeText={(v) => set({ time: v })} placeholder="09:00" keyboardType="numbers-and-punctuation" error={isHHMM(n.time) ? undefined : "Hora inválida"} />
        <Row label="Horario silencioso" value={!!n.quiet} onChange={(v) => set({ quiet: v ? { from: "22:00", to: "07:00" } : null })} />
        {n.quiet && (
          <>
            <Field label="Desde · HH:MM" value={n.quiet.from} onChangeText={(v) => set({ quiet: { ...n.quiet!, from: v } })} keyboardType="numbers-and-punctuation" error={isHHMM(n.quiet.from) ? undefined : "Hora inválida"} />
            <Field label="Hasta · HH:MM" value={n.quiet.to} onChangeText={(v) => set({ quiet: { ...n.quiet!, to: v } })} keyboardType="numbers-and-punctuation" error={isHHMM(n.quiet.to) ? undefined : "Hora inválida"} />
          </>
        )}
      </Card>
      {(["renewal", "collection", "recurring", "loan"] as const).map((k) => (
        <Card key={k}>
          <Row label={KIND_LABEL[k]!} value={n.kinds[k].enabled} onChange={(v) => setKind(k, { enabled: v })} />
          {n.kinds[k].enabled && <MultiChoice label="Avisar con anticipación de (días)" options={LEADS.map((d) => ({ id: String(d), label: d === 0 ? "El mismo día" : `${d} día${d > 1 ? "s" : ""}` }))} value={n.kinds[k].leadDays.map(String)} onChange={(v) => setKind(k, { leadDays: v.map(Number).sort((a, b) => b - a).slice(0, 5) })} />}
        </Card>
      ))}
      <Card>
        <Row label="Presupuestos que llegan a un umbral" value={n.kinds.budget.enabled} onChange={(v) => { setN({ ...n, kinds: { ...n.kinds, budget: { enabled: v } } }); setSaved(false); }} />
        <Row label="Propuestas de captura por revisar" value={n.kinds.capture.enabled} onChange={(v) => { setN({ ...n, kinds: { ...n.kinds, capture: { enabled: v } } }); setSaved(false); }} />
      </Card>
      {saved && <Notice tone="ok">Guardado.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}

      <Heading>Lo que te avisaría (próximos 14 días)</Heading>
      {rem.loading && !rem.data ? <Loading /> : !rem.data?.enabled ? <Txt size={13} muted>Los avisos están apagados.</Txt> : rem.data.items.length === 0 ? <Txt size={13} muted>Nada por avisar.</Txt> : rem.data.items.map((r) => (
        <Card key={r.id} outlined>
          <Txt bold size={13}>{r.title}</Txt>
          {r.detail && <Txt size={12}>{r.detail}</Txt>}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {r.dueDate && <Badge text={`Vence ${humanDate(r.dueDate)}`} />}
            {r.overdue && <Badge text="Vencido" color="#D64545" />}
            {r.fireAt.map((f) => <Badge key={f} text={`Aviso ${f.slice(5, 10)} ${f.slice(11)}`} color="#3B82F6" />)}
          </View>
        </Card>
      ))}
      <Notice tone="info">Esta lista es lo que el servidor calcula; el teléfono la programa sola al abrir la app y al guardar. Se borra al cerrar sesión.</Notice>
    </Screen>
  );
}

// ───────────────────────── Bloqueo y captura ─────────────────────────

const LOCKS: Array<[number, string]> = [[0, "Al salir de la app"], [60, "1 minuto"], [300, "5 minutos"], [900, "15 minutos"], [3600, "1 hora"]];

export function GeneralSettingsScreen() {
  const prefs = useAsync(() => api.preferences(), []);
  const [p, setP] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const lock = useLock();
  useEffect(() => { if (prefs.data) setP(prefs.data); }, [prefs.data]);
  const save = useSubmit(async () => { await api.savePreferences({ security: p!.security, capture: p!.capture }); setSaved(true); await lock.refresh(); });
  if (!p) return <Screen title="Bloqueo y captura">{prefs.error ? <ErrorBox message={prefs.error} onRetry={prefs.reload} /> : <Loading />}</Screen>;
  const upd = (patch: Partial<Preferences>) => { setP({ ...p, ...patch }); setSaved(false); };
  return (
    <Screen title="Bloqueo y captura" footer={<Button title="Guardar" busy={save.busy} onPress={save.submit} />}>
      <Card>
        <Choice label="Volver a pedir el PIN o la huella tras estar en segundo plano" value={String(p.security.lockAfterSeconds)} onChange={(v) => upd({ security: { lockAfterSeconds: Number(v) } })} options={LOCKS.map(([s, l]) => ({ id: String(s), label: l }))} />
        <Txt size={12} muted>El PIN y la huella se configuran en cada teléfono y no reemplazan tu inicio de sesión.</Txt>
      </Card>
      <Card>
        <Choice label="Revisar propuestas de captura" value={p.capture.reviewMode} onChange={(v) => upd({ capture: { ...p.capture, reviewMode: v } })} options={[{ id: "individual", label: "Una por una" }, { id: "batch", label: "En lote" }]} />
        <Choice label="Posibles duplicados" value={p.capture.duplicates} onChange={(v) => upd({ capture: { ...p.capture, duplicates: v } })} options={[{ id: "separate", label: "Separados con advertencia" }, { id: "grouped", label: "Agrupados como posible coincidencia" }]} />
      </Card>
      {saved && <Notice tone="ok">Guardado.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}
