import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Budget, BudgetStatus } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, DateField, MoneyField } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

const PERIOD: Record<string, string> = { weekly: "semanal", monthly: "mensual", yearly: "anual" };

function StatusLine({ s }: { s: BudgetStatus }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <Txt bold style={{ flexShrink: 1 }}>{formatSoles(s.spent)} de {formatSoles(s.available)}</Txt>
        <Chip status={s.exceeded ? "overdue" : s.level ? "partial" : "paid"} label={s.exceeded ? `Pasado por ${formatSoles(s.overBy)}` : s.percent === null ? "—" : `${s.percent}%`} />
      </View>
      <Txt size={12} muted>{humanDate(s.period.start)} → {humanDate(s.period.end)} · queda {formatSoles(s.remaining)}{s.carry !== "0.00" ? ` · arrastre ${formatSoles(s.carry)}` : ""}</Txt>
    </View>
  );
}

export function BudgetsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const list = useAsync(() => api.budgets(status), [status]);
  useFocusReload(list.reload);
  return (
    <Screen title="Presupuestos" subtitle="Son un límite: avisan, nunca bloquean" footer={<Button title="Nuevo presupuesto" icon="add" onPress={() => router.push("/budgets/new" as never)} />}>
      <Choice value={status} onChange={setStatus} options={[{ id: "active", label: "Activos" }, { id: "archived", label: "Archivados" }]} />
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? (
        <Empty icon="pie-chart-outline" title={status === "active" ? "Sin presupuestos" : "Sin presupuestos archivados"} text={status === "active" ? "Crea un límite por categoría o uno general." : "Los presupuestos que archives aparecerán aquí por si quieres restaurarlos."} />
      ) : (list.data ?? []).map((b) => (
        <RowLink key={b.id} onPress={() => router.push(`/budgets/${b.id}` as never)}>
          <View style={{ flex: 1, gap: 4 }}><Txt bold>{b.name}</Txt><Txt size={12} muted>{b.category?.name ?? "Todo el gasto"} · {PERIOD[b.period]}{b.status === "archived" ? " · Archivado" : ""}</Txt><StatusLine s={b.current} /></View>
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
  const router = useRouter();
  const dialog = useDialog();
  const b = useAsync(() => api.budget(id), [id]);
  const hist = useAsync(() => api.budgetHistory(id, 6), [id]);
  useFocusReload(() => { void b.reload(); void hist.reload(); });
  const [name, setName] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const [thresholds, setThresholds] = useState("");
  const [rollover, setRollover] = useState<"no" | "yes" | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [children, setChildren] = useState<"yes" | "no" | null>(null);

  const parsedTh = thresholds.trim() === "" ? null : thresholds.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number.parseInt(x, 10) : Number.NaN));
  const thInvalid = parsedTh !== null && (parsedTh.length === 0 || parsedTh.length > 6 || parsedTh.some((n) => !Number.isInteger(n) || n < 1 || n > 1000));
  const save = useSubmit(async () => {
    const cur = b.data!;
    const nextRoll = rollover === null ? cur.rollover : rollover === "yes";
    const normLimit = normalizeMoneyInput(limit);
    const normCap = cap === null ? undefined : cap.trim() === "" ? null : normalizeMoneyInput(cap);
    return api.patchBudget(id, {
      ...(name !== null && name.trim() && name.trim() !== cur.name ? { name: name.trim() } : {}),
      ...(normLimit ? { limit: normLimit } : {}),
      ...(parsedTh && !thInvalid ? { thresholds: parsedTh } : {}),
      ...(rollover !== null && nextRoll !== cur.rollover ? { rollover: nextRoll } : {}),
      ...(nextRoll && normCap !== undefined ? { rolloverCap: normCap } : {}),
      ...(children !== null && (children === "yes") !== cur.includeSubcategories ? { includeSubcategories: children === "yes" } : {}),
    }, cur.version);
  });
  const archive = useSubmit(async () => (b.data!.status === "active" ? api.archiveBudget(id) : api.restoreBudget(id)));
  const remove = useSubmit(async () => api.deleteBudget(id));

  if (b.loading && !b.data) return <Screen title="Presupuesto"><Loading /></Screen>;
  if (b.error || !b.data) return <Screen title="Presupuesto"><ErrorBox message={b.error ?? "No se encontró el presupuesto."} onRetry={b.reload} /></Screen>;
  const d: Budget = b.data;
  const effRoll = rollover === null ? (d.rollover ? "yes" : "no") : rollover;
  const effChildren = children === null ? (d.includeSubcategories ? "yes" : "no") : children;
  const hasEdit = (name !== null && name.trim().length > 0 && name.trim() !== d.name)
    || !!normalizeMoneyInput(limit)
    || (parsedTh !== null && !thInvalid)
    || (rollover !== null && (rollover === "yes") !== d.rollover)
    || (effRoll === "yes" && cap !== null && (cap.trim() === "" || !!normalizeMoneyInput(cap)))
    || (children !== null && (children === "yes") !== d.includeSubcategories);

  return (
    <Screen title={d.name} subtitle={`${d.category?.name ?? "Todo el gasto"} · ${PERIOD[d.period]}`}>
      <Card>
        <StatusLine s={d.current} />
        <KV label="Bruto" value={formatSoles(d.current.breakdown.gross)} />
        <KV label="Cobros restados" value={formatSoles(d.current.breakdown.collectionsOffset)} />
        <KV label="Arrastre" value={d.rollover ? (d.rolloverCap ? `Sí (tope ${formatSoles(d.rolloverCap)})` : "Sí") : "No"} />
      </Card>
      <Heading>Qué consume</Heading>
      {(d.items ?? []).length === 0 ? <Card><Txt muted>Sin gastos en este período.</Txt></Card> : d.items!.map((i) => (
        <Card key={i.operationId} outlined><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Txt size={13} style={{ flex: 1 }}>{humanDate(i.date)} · {i.description || "Gasto"}{i.sharedService ? " (servicio compartido)" : ""}</Txt><Money value={i.amount} size={14} /></View></Card>
      ))}
      {(d.shared ?? []).map((s) => (
        <Card key={s.operationId}><Txt bold size={13}>Servicio compartido</Txt><KV label="Pagaste" value={formatSoles(s.paid)} /><KV label="Cuotas exigibles" value={formatSoles(s.expectedFromOthers)} /><KV label="Cobrado" value={formatSoles(s.receivedFromOthers)} /><KV label="Costo previsto" value={formatSoles(s.projectedCost)} /><KV label="Costo real" value={formatSoles(s.realCost)} strong /><KV label="Pendiente de cobrar" value={formatSoles(s.pendingFromOthers)} /></Card>
      ))}
      <Heading>Períodos anteriores</Heading>
      {(hist.data ?? []).map((h) => <Card key={h.period.start} outlined><StatusLine s={h} /></Card>)}
      {d.status === "active" && (
        <>
          <Heading>Editar</Heading>
          <Card>
            <Field label="Nombre" value={name ?? d.name} onChangeText={setName} autoCapitalize="sentences" maxLength={80} />
            <MoneyField label={`Límite nuevo (hoy ${formatSoles(d.current.limit)}); rige desde este período`} value={limit} optional onChange={setLimit} />
            <Field label={`Avisos en % (hoy ${d.thresholds.join(", ")})`} value={thresholds} onChangeText={setThresholds} placeholder="80,100" error={thInvalid ? "Usa entre 1 y 6 enteros de 1 a 1000" : undefined} />
            {d.category && <Choice label="¿Incluye sus subcategorías?" value={effChildren} onChange={setChildren} options={[{ id: "yes", label: "Sí" }, { id: "no", label: "No" }]} />}
            <Choice label="¿Arrastra lo no gastado al período siguiente?" value={effRoll} onChange={setRollover} options={[{ id: "no", label: "No" }, { id: "yes", label: "Sí" }]} />
            {effRoll === "yes" && <MoneyField label="Tope del arrastre" value={cap ?? d.rolloverCap ?? ""} optional onChange={setCap} />}
            <Button title="Guardar cambios" busy={save.busy} disabled={!hasEdit || thInvalid} onPress={async () => { if (await save.submit()) { setName(null); setLimit(""); setThresholds(""); setRollover(null); setCap(null); setChildren(null); void b.reload(); } }} />
            {save.error && <Notice tone="err">{save.error}</Notice>}
          </Card>
        </>
      )}
      <Button title={d.status === "active" ? "Archivar presupuesto" : "Restaurar presupuesto"} variant="secondary" busy={archive.busy} onPress={async () => {
        if (d.status === "active") {
          const ok = await dialog.confirm({ title: "¿Archivar presupuesto?", message: "Dejará de aparecer en tus presupuestos activos. Podrás restaurarlo desde Presupuestos → Archivados.", confirmLabel: "Archivar", cancelLabel: "Cancelar" });
          if (!ok) return;
        }
        if (await archive.submit()) void b.reload();
      }} />
      {archive.error && <Notice tone="err">{archive.error}</Notice>}
      <Button title="Eliminar presupuesto" variant="outlineDanger" icon="trash-outline" busy={remove.busy} onPress={async () => {
        const ok = await dialog.confirm({ title: `¿Eliminar «${d.name}»?`, message: "Se eliminará esta regla de presupuesto definitivamente. Tus gastos y movimientos no se tocan.", confirmLabel: "Eliminar", cancelLabel: "Cancelar", danger: true });
        if (ok && await remove.submit()) router.replace("/budgets" as never);
      }} />
      {remove.error && <Notice tone="err">{remove.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Metas ─────────────────────────

export function GoalsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const goals = useAsync(() => api.goals(status), [status]);
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
      <Choice value={status} onChange={setStatus} options={[{ id: "active", label: "Activas" }, { id: "archived", label: "Archivadas" }]} />
      {goals.loading && !goals.data ? <Loading /> : goals.error ? <ErrorBox message={goals.error} onRetry={goals.reload} /> : (goals.data ?? []).length === 0 ? (
        <Empty icon="flag-outline" title={status === "active" ? "Sin metas" : "Sin metas archivadas"} text={status === "active" ? "Crea una meta y reserva dinero que ya tienes en tus cuentas." : "Las metas que archives aparecerán aquí por si quieres restaurarlas."} />
      ) : (goals.data ?? []).map((g) => (
        <RowLink key={g.id} onPress={() => router.push(`/goals/${g.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>{g.name}</Txt><Txt size={12} muted>{formatSoles(g.saved)} de {formatSoles(g.targetAmount)}{g.targetDate ? ` · hasta ${humanDate(g.targetDate)}` : ""}</Txt></View>
          <Chip status={g.status === "archived" ? "converted" : g.achieved ? "paid" : "partial"} label={g.status === "archived" ? "Archivada" : `${g.percent}%`} />
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
  const router = useRouter();
  const dialog = useDialog();
  const g = useAsync(() => api.goal(id), [id]);
  const transfers = useAsync(() => api.operations({ kind: "transfer", limit: 20 }), []);
  useFocusReload(g.reload);
  const [mode, setMode] = useState<"reserve" | "release" | "link">("reserve");
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<string | null>(null);
  const money = useSubmit(async (key: string) => (mode === "reserve" ? api.reserveGoal : api.releaseGoal)(id, { accountId: account!, amount: normalizeMoneyInput(amount)! }, key));
  const link = useSubmit(async (key: string) => api.linkGoalTransfer(id, opId!, key));
  const patch = useSubmit(async () => {
    const cur = g.data!;
    const normT = editTarget !== null ? normalizeMoneyInput(editTarget) : null;
    return api.patchGoal(id, {
      ...(editName !== null && editName.trim() && editName.trim() !== cur.name ? { name: editName.trim() } : {}),
      ...(normT && normT !== cur.targetAmount ? { targetAmount: normT } : {}),
      ...(editDate !== null && (editDate || null) !== cur.targetDate ? { targetDate: editDate || null } : {}),
      ...(editNote !== null && (editNote.trim() || null) !== (cur.note ?? null) ? { note: editNote.trim() || null } : {}),
    }, cur.version);
  });
  const archive = useSubmit(async () => (g.data!.status === "active" ? api.archiveGoal(id) : api.restoreGoal(id)));
  const remove = useSubmit(async () => api.deleteGoal(id));
  if (g.loading && !g.data) return <Screen title="Meta"><Loading /></Screen>;
  if (g.error || !g.data) return <Screen title="Meta"><ErrorBox message={g.error ?? "No se encontró la meta."} onRetry={g.reload} /></Screen>;
  const d = g.data;
  const editDirty = (editName !== null && editName.trim().length > 0 && editName.trim() !== d.name)
    || (editTarget !== null && !!normalizeMoneyInput(editTarget) && normalizeMoneyInput(editTarget) !== d.targetAmount)
    || (editDate !== null && (editDate === "" || isIsoDate(editDate)) && (editDate || null) !== d.targetDate)
    || (editNote !== null && (editNote.trim() || null) !== (d.note ?? null));
  return (
    <Screen title={d.name} subtitle={`Objetivo ${formatSoles(d.targetAmount)}${d.targetDate ? ` · ${humanDate(d.targetDate)}` : ""}`}>
      <Card>
        <Money value={d.saved} size={30} /><Txt size={13} muted>{d.percent}% · faltan {formatSoles(d.remaining)}{d.daysLeft !== null ? (d.daysLeft < 0 ? ` · venció hace ${Math.abs(d.daysLeft)} días` : ` · ${d.daysLeft} días`) : ""}</Txt>
        {d.note ? <Txt size={13} muted>{d.note}</Txt> : null}
        {d.achieved && <Chip status="paid" label="Meta cumplida" />}
        {d.accounts.map((a) => <View key={a.accountId}><KV label={a.name} value={formatSoles(a.reserved)} />{a.overReserved && <Notice tone="warn">Lo reservado en {a.name} supera su saldo.</Notice>}</View>)}
      </Card>
      {d.status === "archived" && (
        <Notice tone="info">
          {d.saved !== "0.00"
            ? `Esta meta está archivada: los ${formatSoles(d.saved)} guardados aquí ya cuentan como dinero libre en tus cuentas. Si la restauras, volverán a apartarse.`
            : "Esta meta está archivada. Puedes restaurarla cuando quieras."}
        </Notice>
      )}
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
              <Choice select label="Transferencia" value={opId} onChange={(v) => { setOpId(v); link.resetKey(); }}
                options={(transfers.data?.items ?? []).filter((o) => o.status === "confirmed").map((o) => ({ id: o.id, label: `${humanDate(o.occurredOn)} · ${formatSoles(o.amount)}`, hint: o.description || undefined }))} />
              <Button title="Vincular" busy={link.busy} disabled={!opId} onPress={async () => { if (await link.submit()) void g.reload(); }} />
              {link.error && <Notice tone="err">{link.error}</Notice>}
            </>
          )}
        </Card>
      )}
      <Heading>Historial</Heading>
      {(d.contributions ?? []).map((c) => <Card key={c.id} outlined><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Txt size={13} style={{ flex: 1, flexShrink: 1 }}>{c.accountName} · {c.kind === "reserve" ? "reserva" : c.kind === "release" ? "liberación" : c.kind === "transfer" ? "transferencia" : "gasto"}</Txt><Txt bold size={13} style={{ fontVariant: ["tabular-nums"] }}>{formatSoles(c.amount)}</Txt></View></Card>)}
      {d.status === "active" && (
        <>
          <Heading>Editar meta</Heading>
          <Card>
            <Field label="Nombre" value={editName ?? d.name} onChangeText={setEditName} autoCapitalize="sentences" maxLength={80} />
            <MoneyField label="Objetivo" value={editTarget ?? d.targetAmount} onChange={setEditTarget} />
            <DateField label="Fecha objetivo" value={editDate ?? d.targetDate ?? ""} optional onChange={setEditDate} />
            <Field label="Nota (opcional)" value={editNote ?? d.note ?? ""} onChangeText={setEditNote} autoCapitalize="sentences" maxLength={200} />
            <Button title="Guardar cambios" variant="secondary" busy={patch.busy} disabled={!editDirty} onPress={async () => { if (await patch.submit()) { setEditName(null); setEditTarget(null); setEditDate(null); setEditNote(null); void g.reload(); } }} />
            {patch.error && <Notice tone="err">{patch.error}</Notice>}
          </Card>
        </>
      )}
      <Button title={d.status === "active" ? "Archivar meta" : "Restaurar meta"} variant="secondary" busy={archive.busy} onPress={async () => {
        if (d.status === "active") {
          const ok = await dialog.confirm({
            title: "¿Archivar esta meta?",
            message: d.saved !== "0.00"
              ? `Mientras esté archivada, los ${formatSoles(d.saved)} reservados volverán a contar como dinero libre en tus cuentas. Podrás restaurarla desde Metas → Archivadas.`
              : "Dejará de aparecer en tus metas activas, pero podrás restaurarla desde Metas → Archivadas.",
            confirmLabel: "Archivar",
            cancelLabel: "Cancelar",
          });
          if (!ok) return;
        }
        if (await archive.submit()) void g.reload();
      }} />
      {archive.error && <Notice tone="err">{archive.error}</Notice>}
      <Button title="Eliminar meta" variant="outlineDanger" icon="trash-outline" busy={remove.busy} onPress={async () => {
        const ok = await dialog.confirm({ title: `¿Eliminar «${d.name}»?`, message: "Se borrará definitivamente. Solo se permite si la meta nunca tuvo reservas ni transferencias vinculadas.", confirmLabel: "Eliminar", cancelLabel: "Cancelar", danger: true });
        if (ok && await remove.submit()) router.replace("/goals/accounts" as never);
      }} />
      {remove.error && <Notice tone="err">{remove.error}</Notice>}
    </Screen>
  );
}
