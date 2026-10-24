import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Budget, BudgetStatus } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, DateField, MoneyField } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

const PERIOD: Record<string, string> = { weekly: "semanal", monthly: "mensual", yearly: "anual" };

function StatusLine({ s }: { s: BudgetStatus }) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt bold>{formatSoles(s.spent)} de {formatSoles(s.available)}</Txt>
        <Chip status={s.exceeded ? "overdue" : s.level ? "partial" : "paid"} label={s.exceeded ? `Pasado por ${formatSoles(s.overBy)}` : s.percent === null ? "—" : `${s.percent}%`} />
      </View>
      <Txt size={12} muted>{humanDate(s.period.start)} → {humanDate(s.period.end)} · queda {formatSoles(s.remaining)}{s.carry !== "0.00" ? ` · arrastre ${formatSoles(s.carry)}` : ""}</Txt>
    </View>
  );
}

export function BudgetsScreen() {
  const router = useRouter();
  const list = useAsync(() => api.budgets(), []);
  useFocusReload(list.reload);
  return (
    <Screen title="Presupuestos" subtitle="Son un límite: avisan, nunca bloquean" footer={<Button title="Nuevo presupuesto" icon="add" onPress={() => router.push("/budgets/new" as never)} />}>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? (
        <Empty icon="pie-chart-outline" title="Sin presupuestos" text="Crea un límite por categoría o uno general." />
      ) : (list.data ?? []).map((b) => (
        <RowLink key={b.id} onPress={() => router.push(`/budgets/${b.id}` as never)}>
          <View style={{ flex: 1, gap: 4 }}><Txt bold>{b.name}</Txt><Txt size={12} muted>{b.category?.name ?? "Todo el gasto"} · {PERIOD[b.period]}</Txt><StatusLine s={b.current} /></View>
        </RowLink>
      ))}
    </Screen>
  );
}

export function BudgetNewScreen() {
  const done = useDone();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [children, setChildren] = useState<"yes" | "no">("yes");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [limit, setLimit] = useState("");
  const [thresholds, setThresholds] = useState("80,100");
  const [rollover, setRollover] = useState<"no" | "yes">("no");
  const [cap, setCap] = useState("");
  const [view, setView] = useState<"origin_cycle" | "receipt_date">("origin_cycle");
  const [startsOn, setStartsOn] = useState("");
  const th = thresholds.split(",").map((x) => Number.parseInt(x.trim(), 10)).filter((x) => Number.isInteger(x));
  const save = useSubmit(async () => api.createBudget({
    name: name.trim(), categoryId, includeSubcategories: children === "yes", period, limit: normalizeMoneyInput(limit)!, ...(th.length ? { thresholds: th } : {}),
    rollover: rollover === "yes", ...(rollover === "yes" && normalizeMoneyInput(cap) ? { rolloverCap: normalizeMoneyInput(cap)! } : {}), sharedView: view, ...(startsOn ? { startsOn } : {}),
  }));
  return (
    <Screen title="Nuevo presupuesto" footer={<Button title="Crear presupuesto" busy={save.busy} disabled={!name.trim() || !normalizeMoneyInput(limit) || (startsOn !== "" && !isIsoDate(startsOn))} onPress={async () => { if (await save.submit()) done("/budgets"); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Comida" autoCapitalize="sentences" />
        <CategoryPicker label="Categoría (sin categoría = presupuesto general)" value={categoryId} onChange={setCategoryId} />
        {categoryId && <Choice label="¿Incluye sus subcategorías?" value={children} onChange={setChildren} options={[{ id: "yes", label: "Sí" }, { id: "no", label: "No" }]} />}
        <Choice label="Período" value={period} onChange={setPeriod} options={[{ id: "weekly", label: "Semanal" }, { id: "monthly", label: "Mensual" }, { id: "yearly", label: "Anual" }]} />
        <MoneyField label="Límite del período" value={limit} onChange={setLimit} />
        <Field label="Avisos en % (separados por coma)" value={thresholds} onChangeText={setThresholds} placeholder="80,100" />
      </Card>
      <Card>
        <Choice label="¿Arrastra lo no gastado al período siguiente?" value={rollover} onChange={setRollover} options={[{ id: "no", label: "No" }, { id: "yes", label: "Sí" }]} />
        {rollover === "yes" && <MoneyField label="Tope del arrastre" value={cap} optional onChange={setCap} />}
        <Choice label="Servicios compartidos: los cobros se restan…" value={view} onChange={setView} options={[{ id: "origin_cycle", label: "Al mes del pago (ciclo de origen)" }, { id: "receipt_date", label: "Al mes en que entran" }]} />
        <DateField label="Empieza en" value={startsOn} optional onChange={setStartsOn} />
      </Card>
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

export function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const b = useAsync(() => api.budget(id), [id]);
  const hist = useAsync(() => api.budgetHistory(id, 6), [id]);
  useFocusReload(() => { void b.reload(); void hist.reload(); });
  const [limit, setLimit] = useState("");
  const [thresholds, setThresholds] = useState("");
  const save = useSubmit(async () => {
    const th = thresholds.split(",").map((x) => Number.parseInt(x.trim(), 10)).filter((x) => Number.isInteger(x));
    return api.patchBudget(id, { ...(normalizeMoneyInput(limit) ? { limit: normalizeMoneyInput(limit)! } : {}), ...(th.length ? { thresholds: th } : {}) }, b.data!.version);
  });
  const archive = useSubmit(async () => (b.data!.status === "active" ? api.archiveBudget(id) : api.restoreBudget(id)));
  if (b.loading && !b.data) return <Screen title="Presupuesto"><Loading /></Screen>;
  if (b.error || !b.data) return <Screen title="Presupuesto"><ErrorBox message={b.error ?? "No se encontró el presupuesto."} onRetry={b.reload} /></Screen>;
  const d: Budget = b.data;
  return (
    <Screen title={d.name} subtitle={`${d.category?.name ?? "Todo el gasto"} · ${PERIOD[d.period]}`}>
      <Card><StatusLine s={d.current} /><KV label="Bruto" value={formatSoles(d.current.breakdown.gross)} /><KV label="Cobros restados" value={formatSoles(d.current.breakdown.collectionsOffset)} /></Card>
      <Heading>Qué consume</Heading>
      {(d.items ?? []).length === 0 ? <Card><Txt muted>Sin gastos en este período.</Txt></Card> : d.items!.map((i) => (
        <Card key={i.operationId} outlined><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Txt size={13} style={{ flex: 1 }}>{humanDate(i.date)} · {i.description || "Gasto"}{i.sharedService ? " (servicio compartido)" : ""}</Txt><Money value={i.amount} size={14} /></View></Card>
      ))}
      {(d.shared ?? []).map((s) => (
        <Card key={s.operationId}><Txt bold size={13}>Servicio compartido</Txt><KV label="Pagaste" value={formatSoles(s.paid)} /><KV label="Cuotas exigibles" value={formatSoles(s.expectedFromOthers)} /><KV label="Cobrado" value={formatSoles(s.receivedFromOthers)} /><KV label="Costo previsto" value={formatSoles(s.projectedCost)} /><KV label="Costo real" value={formatSoles(s.realCost)} strong /><KV label="Pendiente de cobrar" value={formatSoles(s.pendingFromOthers)} /></Card>
      ))}
      <Heading>Períodos anteriores</Heading>
      {(hist.data ?? []).map((h) => <Card key={h.period.start} outlined><StatusLine s={h} /></Card>)}
      <Heading>Editar</Heading>
      <Card>
        <MoneyField label={`Límite nuevo (hoy ${formatSoles(d.current.limit)}); rige desde este período`} value={limit} optional onChange={setLimit} />
        <Field label={`Avisos en % (hoy ${d.thresholds.join(", ")})`} value={thresholds} onChangeText={setThresholds} placeholder="80,100" />
        <Button title="Guardar cambios" busy={save.busy} disabled={!normalizeMoneyInput(limit) && !thresholds.trim()} onPress={async () => { if (await save.submit()) { setLimit(""); setThresholds(""); void b.reload(); } }} />
        {save.error && <Notice tone="err">{save.error}</Notice>}
      </Card>
      <Button title={d.status === "active" ? "Archivar presupuesto" : "Restaurar presupuesto"} variant="secondary" busy={archive.busy} onPress={async () => { if (await archive.submit()) void b.reload(); }} />
    </Screen>
  );
}

// ───────────────────────── Metas ─────────────────────────

export function GoalsScreen() {
  const router = useRouter();
  const goals = useAsync(() => api.goals(), []);
  const ov = useAsync(() => api.goalsOverview(), []);
  useFocusReload(() => { void goals.reload(); void ov.reload(); });
  return (
    <Screen title="Metas" subtitle="Reservar no mueve dinero" footer={<Button title="Nueva meta" icon="add" onPress={() => router.push("/goals/new" as never)} />}>
      <Heading>Por cuenta</Heading>
      {(ov.data?.accounts ?? []).map((a) => (
        <Card key={a.accountId} outlined>
          <Txt bold>{a.name}</Txt>
          <KV label="Total" value={formatSoles(a.total)} /><KV label="Reservado" value={formatSoles(a.reserved)} /><KV label="Libre" value={formatSoles(a.free)} strong />
          {a.overReserved && <Notice tone="warn">Lo reservado supera el saldo de esta cuenta.</Notice>}
        </Card>
      ))}
      <Heading>Mis metas</Heading>
      {goals.loading && !goals.data ? <Loading /> : goals.error ? <ErrorBox message={goals.error} onRetry={goals.reload} /> : (goals.data ?? []).length === 0 ? (
        <Empty icon="flag-outline" title="Sin metas" text="Crea una meta y reserva dinero que ya tienes en tus cuentas." />
      ) : (goals.data ?? []).map((g) => (
        <RowLink key={g.id} onPress={() => router.push(`/goals/${g.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>{g.name}</Txt><Txt size={12} muted>{formatSoles(g.saved)} de {formatSoles(g.targetAmount)}{g.targetDate ? ` · hasta ${humanDate(g.targetDate)}` : ""}</Txt></View>
          <Chip status={g.achieved ? "paid" : "partial"} label={`${g.percent}%`} />
        </RowLink>
      ))}
    </Screen>
  );
}

export function GoalNewScreen() {
  const done = useDone();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const save = useSubmit(async () => api.createGoal({ name: name.trim(), targetAmount: normalizeMoneyInput(target)!, ...(date ? { targetDate: date } : {}), ...(note.trim() ? { note: note.trim() } : {}) }));
  return (
    <Screen title="Nueva meta" footer={<Button title="Crear meta" busy={save.busy} disabled={!name.trim() || !normalizeMoneyInput(target) || (date !== "" && !isIsoDate(date))} onPress={async () => { if (await save.submit()) done("/goals"); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Viaje" autoCapitalize="sentences" />
        <MoneyField label="Objetivo" value={target} onChange={setTarget} />
        <DateField label="Fecha objetivo" value={date} optional onChange={setDate} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} autoCapitalize="sentences" />
      </Card>
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

export function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useAsync(() => api.goal(id), [id]);
  const transfers = useAsync(() => api.operations({ kind: "transfer", limit: 20 }), []);
  useFocusReload(g.reload);
  const [mode, setMode] = useState<"reserve" | "release" | "link">("reserve");
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const money = useSubmit(async (key: string) => (mode === "reserve" ? api.reserveGoal : api.releaseGoal)(id, { accountId: account!, amount: normalizeMoneyInput(amount)! }, key));
  const link = useSubmit(async (key: string) => api.linkGoalTransfer(id, opId!, key));
  const archive = useSubmit(async () => (g.data!.status === "active" ? api.archiveGoal(id) : api.restoreGoal(id)));
  if (g.loading && !g.data) return <Screen title="Meta"><Loading /></Screen>;
  if (g.error || !g.data) return <Screen title="Meta"><ErrorBox message={g.error ?? "No se encontró la meta."} onRetry={g.reload} /></Screen>;
  const d = g.data;
  return (
    <Screen title={d.name} subtitle={`Objetivo ${formatSoles(d.targetAmount)}${d.targetDate ? ` · ${humanDate(d.targetDate)}` : ""}`}>
      <Card>
        <Money value={d.saved} size={30} /><Txt size={13} muted>{d.percent}% · faltan {formatSoles(d.remaining)}{d.daysLeft !== null ? ` · ${d.daysLeft} días` : ""}</Txt>
        {d.achieved && <Chip status="paid" label="Meta cumplida" />}
        {d.accounts.map((a) => <View key={a.accountId}><KV label={a.name} value={formatSoles(a.reserved)} />{a.overReserved && <Notice tone="warn">Lo reservado en {a.name} supera su saldo.</Notice>}</View>)}
      </Card>
      {d.status === "active" && (
        <Card>
          <Choice label="Qué quieres hacer" value={mode} onChange={setMode} options={[{ id: "reserve", label: "Reservar dinero" }, { id: "release", label: "Liberar dinero" }, { id: "link", label: "Vincular una transferencia" }]} />
          {mode !== "link" ? (
            <>
              <AccountPicker label={mode === "reserve" ? "Reservar de la cuenta" : "Liberar de la cuenta"} value={account} onChange={(v) => { setAccount(v); money.resetKey(); }} />
              <MoneyField label="Importe" value={amount} onChange={(v) => { setAmount(v); money.resetKey(); }} />
              <Button title={mode === "reserve" ? "Reservar" : "Liberar"} busy={money.busy} disabled={!account || !normalizeMoneyInput(amount)} onPress={async () => { if (await money.submit()) { setAmount(""); void g.reload(); } }} />
              {money.error && <Notice tone="err">{money.error}</Notice>}
              <Txt size={12} muted>Reservar aparta dinero que ya está en la cuenta: no crea movimientos ni cambia el saldo.</Txt>
            </>
          ) : (
            <>
              <Choice label="Transferencia" value={opId} onChange={(v) => { setOpId(v); link.resetKey(); }}
                options={(transfers.data?.items ?? []).filter((o) => o.status === "confirmed").map((o) => ({ id: o.id, label: `${humanDate(o.occurredOn)} · ${formatSoles(o.amount)}`, hint: o.description || undefined }))} />
              <Button title="Vincular" busy={link.busy} disabled={!opId} onPress={async () => { if (await link.submit()) void g.reload(); }} />
              {link.error && <Notice tone="err">{link.error}</Notice>}
            </>
          )}
        </Card>
      )}
      <Heading>Historial</Heading>
      {(d.contributions ?? []).map((c) => <Card key={c.id} outlined><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Txt size={13}>{c.accountName} · {c.kind === "reserve" ? "reserva" : c.kind === "release" ? "liberación" : c.kind === "transfer" ? "transferencia" : "gasto"}</Txt><Txt bold size={13}>{formatSoles(c.amount)}</Txt></View></Card>)}
      <Button title={d.status === "active" ? "Archivar meta" : "Restaurar meta"} variant="secondary" busy={archive.busy} onPress={async () => { if (await archive.submit()) void g.reload(); }} />
    </Screen>
  );
}
