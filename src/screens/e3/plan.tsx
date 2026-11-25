import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Budget, BudgetStatus } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, DateField, MoneyField } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useModules } from "../../context/ModulesContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";

const PERIOD: Record<string, string> = { weekly: "semanal", monthly: "mensual", yearly: "anual" };

function parseThresholds(raw: string): { values: number[] | null; invalid: boolean } {
  if (raw.trim() === "") return { values: null, invalid: false };
  const parsed = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (/^\d+$/.test(x) ? Number.parseInt(x, 10) : Number.NaN));
  const invalid = parsed.length === 0 || parsed.length > 6 || parsed.some((n) => !Number.isInteger(n) || n < 1 || n > 1000);
  return { values: parsed, invalid };
}

function isPositiveMoney(raw: string): boolean {
  const n = normalizeMoneyInput(raw);
  return !!n && cmpMoney(n, "0.00") > 0;
}

function StatusLine({ s }: { s: BudgetStatus }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <Txt bold style={{ flexShrink: 1 }}>{formatSoles(s.spent)} de {formatSoles(s.available)}</Txt>
        <Chip status={s.exceeded ? "overdue" : s.level ? "partial" : "paid"} label={s.exceeded ? `Pasado por ${formatSoles(s.overBy)}` : s.percent === null ? "—" : `${s.percent}%`} />
      </View>
      <Txt size={12} muted>
        {humanDate(s.period.start)} → {humanDate(s.period.end)} · queda {formatSoles(s.remaining)}
        {s.carry !== "0.00" ? ` · sobró antes ${formatSoles(s.carry)}` : ""}
      </Txt>
    </View>
  );
}

export function BudgetsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [refreshing, setRefreshing] = useState(false);
  const list = useAsync(() => api.budgets(undefined, status), [status]);
  useFocusReload(list.reload);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await list.reload(); } finally { setRefreshing(false); }
  };

  return (
    <Screen title="Presupuestos" subtitle="Son un límite: avisan, nunca bloquean" refreshing={refreshing} onRefresh={onRefresh} footer={<Button title="Nuevo presupuesto" icon="add" onPress={() => router.push("/budgets/new" as never)} />}>
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
  const { colors } = useAppTheme();
  const { modules } = useModules();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [children, setChildren] = useState<"yes" | "no">("yes");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [limit, setLimit] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [thresholds, setThresholds] = useState("80,100");
  const [rollover, setRollover] = useState<"no" | "yes">("no");
  const [cap, setCap] = useState("");
  const [view, setView] = useState<"origin_cycle" | "receipt_date">("origin_cycle");
  const [startsOn, setStartsOn] = useState("");

  const { values: parsedTh, invalid: thInvalid } = parseThresholds(thresholds);
  const limitValid = isPositiveMoney(limit);
  const capInvalid = rollover === "yes" && cap.trim() !== "" && !isPositiveMoney(cap);
  const startInvalid = startsOn !== "" && !isIsoDate(startsOn);
  const showSharedOption = modules.services && modules.people;

  const save = useSubmit(async () => api.createBudget({
    name: name.trim(),
    categoryId,
    includeSubcategories: children === "yes",
    period,
    limit: normalizeMoneyInput(limit)!,
    ...(parsedTh && !thInvalid ? { thresholds: parsedTh } : {}),
    rollover: rollover === "yes",
    ...(rollover === "yes" && isPositiveMoney(cap) ? { rolloverCap: normalizeMoneyInput(cap)! } : {}),
    sharedView: view,
    ...(startsOn ? { startsOn } : {}),
  }));

  const canCreate = !!name.trim() && limitValid && !thInvalid && !capInvalid && !startInvalid;

  return (
    <Screen title="Nuevo presupuesto" footer={<Button title="Crear presupuesto" busy={save.busy} disabled={!canCreate} onPress={async () => { if (await save.submit()) done("/budgets"); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Ej. Comida" autoCapitalize="sentences" />
        <CategoryPicker label="Categoría (vacío = todo tu gasto)" value={categoryId} onChange={setCategoryId} />
        {categoryId && <Choice label="¿Incluye sus subcategorías?" value={children} onChange={setChildren} options={[{ id: "yes", label: "Sí" }, { id: "no", label: "No" }]} />}
        <Choice label="Cada cuánto se reinicia" value={period} onChange={setPeriod} options={[{ id: "weekly", label: "Semanal" }, { id: "monthly", label: "Mensual" }, { id: "yearly", label: "Anual" }]} />
        <MoneyField label="Límite de gasto" value={limit} onChange={setLimit} />
      </Card>

      <TouchableOpacity
        onPress={() => setShowAdvanced((v) => !v)}
        activeOpacity={0.75}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
          <Txt bold size={14} muted>Opciones avanzadas</Txt>
        </View>
        <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {showAdvanced && (
        <Card>
          <Field
            label="Avisarme al llegar a estos %"
            value={thresholds}
            onChangeText={setThresholds}
            placeholder="80,100"
            error={thInvalid ? "Usa entre 1 y 6 números enteros del 1 al 1000 (ej. 80,100)" : undefined}
          />
          <Choice label="¿Sumar lo que sobró al siguiente período?" value={rollover} onChange={setRollover} options={[{ id: "no", label: "No" }, { id: "yes", label: "Sí" }]} />
          {rollover === "yes" && (
            <>
              <MoneyField label="Máximo a acumular" value={cap} optional onChange={setCap} />
              {capInvalid && <Txt size={12} color={colors.expenseStrong}>El máximo a acumular debe ser mayor a S/ 0.00.</Txt>}
            </>
          )}
          {showSharedOption && (
            <Choice
              label="En servicios compartidos, descontar cobros…"
              value={view}
              onChange={setView}
              options={[
                { id: "origin_cycle", label: "En el mes que pagaste el servicio" },
                { id: "receipt_date", label: "En el mes en que te pagan" },
              ]}
            />
          )}
          <DateField label="Empieza desde" value={startsOn} optional onChange={setStartsOn} />
        </Card>
      )}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

export function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const { colors } = useAppTheme();
  const b = useAsync(() => api.budget(id), [id]);
  const hist = useAsync(() => api.budgetHistory(id, 6), [id]);
  useFocusReload(() => { void b.reload(); void hist.reload(); });
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const [thresholds, setThresholds] = useState("");
  const [rollover, setRollover] = useState<"no" | "yes" | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [children, setChildren] = useState<"yes" | "no" | null>(null);

  const { values: parsedTh, invalid: thInvalid } = parseThresholds(thresholds);
  const limitBad = limit.trim() !== "" && !isPositiveMoney(limit);
  const capBad = cap !== null && cap.trim() !== "" && !isPositiveMoney(cap);

  const save = useSubmit(async () => {
    const cur = b.data!;
    const nextRoll = rollover === null ? cur.rollover : rollover === "yes";
    const normLimit = isPositiveMoney(limit) ? normalizeMoneyInput(limit) : null;
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

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([b.reload(), hist.reload()]); } finally { setRefreshing(false); }
  };

  if (b.loading && !b.data) return <Screen title="Presupuesto"><Loading /></Screen>;
  if (b.error || !b.data) return <Screen title="Presupuesto"><ErrorBox message={b.error ?? "No se encontró el presupuesto."} onRetry={b.reload} /></Screen>;
  const d: Budget = b.data;
  const effRoll = rollover === null ? (d.rollover ? "yes" : "no") : rollover;
  const effChildren = children === null ? (d.includeSubcategories ? "yes" : "no") : children;
  const hasEdit = (name !== null && name.trim().length > 0 && name.trim() !== d.name)
    || isPositiveMoney(limit)
    || (parsedTh !== null && !thInvalid)
    || (rollover !== null && (rollover === "yes") !== d.rollover)
    || (effRoll === "yes" && cap !== null && (cap.trim() === "" || isPositiveMoney(cap)))
    || (children !== null && (children === "yes") !== d.includeSubcategories);
  const hasCollectionsOffset = cmpMoney(d.current.breakdown.collectionsOffset, "0.00") > 0;

  return (
    <Screen
      title={d.name}
      subtitle={`${d.category?.name ?? "Todo el gasto"} · ${PERIOD[d.period]}`}
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={d.status === "active" ? (
        <Button title={editing ? "Cerrar" : "Editar"} variant="secondary" size="compact" onPress={() => setEditing((v) => !v)} />
      ) : undefined}
    >
      <Card>
        <StatusLine s={d.current} />
        {hasCollectionsOffset && (
          <>
            <KV label="Total pagado" value={formatSoles(d.current.breakdown.gross)} />
            <KV label="Cobrado a otros" value={`-${formatSoles(d.current.breakdown.collectionsOffset)}`} />
          </>
        )}
        <KV label="Acumula lo no gastado" value={d.rollover ? (d.rolloverCap ? `Sí (máximo ${formatSoles(d.rolloverCap)})` : "Sí") : "No"} />
      </Card>

      {d.status === "active" && editing && (
        <Card>
          <Txt bold size={14}>Editar presupuesto</Txt>
          <Field label="Nombre" value={name ?? d.name} onChangeText={setName} autoCapitalize="sentences" maxLength={80} />
          <MoneyField label={`Nuevo límite (actual ${formatSoles(d.current.limit)})`} value={limit} optional onChange={setLimit} />
          {limitBad && <Txt size={12} color={colors.expenseStrong}>El límite debe ser mayor a S/ 0.00.</Txt>}
          <Field label={`Avisos en % (actual ${d.thresholds.join(", ")})`} value={thresholds} onChangeText={setThresholds} placeholder="80,100" error={thInvalid ? "Usa entre 1 y 6 enteros de 1 a 1000" : undefined} />
          {d.category && <Choice label="¿Incluye sus subcategorías?" value={effChildren} onChange={setChildren} options={[{ id: "yes", label: "Sí" }, { id: "no", label: "No" }]} />}
          <Choice label="¿Sumar lo que sobró al siguiente período?" value={effRoll} onChange={setRollover} options={[{ id: "no", label: "No" }, { id: "yes", label: "Sí" }]} />
          {effRoll === "yes" && (
            <>
              <MoneyField label="Máximo a acumular" value={cap ?? d.rolloverCap ?? ""} optional onChange={setCap} />
              {capBad && <Txt size={12} color={colors.expenseStrong}>El máximo debe ser mayor a S/ 0.00.</Txt>}
            </>
          )}
          <Button
            title="Guardar cambios"
            busy={save.busy}
            disabled={!hasEdit || thInvalid || limitBad || capBad}
            onPress={async () => {
              if (await save.submit()) {
                setName(null);
                setLimit("");
                setThresholds("");
                setRollover(null);
                setCap(null);
                setChildren(null);
                setEditing(false);
                void b.reload();
              }
            }}
          />
          {save.error && <Notice tone="err">{save.error}</Notice>}
        </Card>
      )}

      <Heading>Qué consume este período</Heading>
      {(d.items ?? []).length === 0 ? <Card><Txt muted>Sin gastos en este período.</Txt></Card> : d.items!.map((i) => (
        <Card key={i.operationId} outlined><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Txt size={13} style={{ flex: 1 }}>{humanDate(i.date)} · {i.description || "Gasto"}{i.sharedService ? " (servicio compartido)" : ""}</Txt><Money value={i.amount} size={14} /></View></Card>
      ))}
      {(d.shared ?? []).map((s) => (
        <Card key={s.operationId}>
          <Txt bold size={13}>Servicio compartido</Txt>
          <KV label="Pagaste en total" value={formatSoles(s.paid)} />
          <KV label="Parte de otros" value={formatSoles(s.expectedFromOthers)} />
          <KV label="Ya cobrado" value={formatSoles(s.receivedFromOthers)} />
          <KV label="Falta cobrar" value={formatSoles(s.pendingFromOthers)} />
          <KV label="Tu parte estimada" value={formatSoles(s.projectedCost)} />
          <KV label="Tu costo hasta ahora" value={formatSoles(s.realCost)} strong />
        </Card>
      ))}

      <Heading>Períodos anteriores</Heading>
      {(hist.data ?? []).map((h) => <Card key={h.period.start} outlined><StatusLine s={h} /></Card>)}

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
  const [refreshing, setRefreshing] = useState(false);
  const goals = useAsync(() => api.goals(status), [status]);
  const ov = useAsync(() => api.goalsOverview(), []);
  useFocusReload(() => { void goals.reload(); void ov.reload(); });

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([goals.reload(), ov.reload()]); } finally { setRefreshing(false); }
  };

  return (
    <Screen title="Metas" subtitle="Reservar aparta saldo sin mover tu dinero" refreshing={refreshing} onRefresh={onRefresh} footer={<Button title="Nueva meta" icon="add" onPress={() => router.push("/goals/new" as never)} />}>
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
  const { colors } = useAppTheme();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const today = todayLocalIso();
  const targetValid = isPositiveMoney(target);
  const dateInvalid = date !== "" && (!isIsoDate(date) || date <= today);

  const save = useSubmit(async () => api.createGoal({
    name: name.trim(),
    targetAmount: normalizeMoneyInput(target)!,
    ...(date ? { targetDate: date } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  }));

  return (
    <Screen title="Nueva meta" footer={<Button title="Crear meta" busy={save.busy} disabled={!name.trim() || !targetValid || dateInvalid} onPress={async () => { if (await save.submit()) done("/goals/accounts"); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Ej. Viaje" autoCapitalize="sentences" />
        <MoneyField label="Objetivo" value={target} onChange={setTarget} />
        <DateField label="Fecha objetivo" value={date} optional onChange={setDate} />
        {date !== "" && isIsoDate(date) && date <= today && (
          <Txt size={12} color={colors.expenseStrong}>La fecha objetivo debe ser posterior a hoy.</Txt>
        )}
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
  const { colors } = useAppTheme();
  const g = useAsync(() => api.goal(id), [id]);
  const transfers = useAsync(() => api.operations({ kind: "transfer", limit: 30 }), []);
  useFocusReload(() => { void g.reload(); void transfers.reload(); });
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"reserve" | "release" | "link">("reserve");
  const [account, setAccount] = useState<string | null>(null);
  const [releaseAccount, setReleaseAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<string | null>(null);

  const money = useSubmit(async (key: string, accId: string) => (mode === "reserve" ? api.reserveGoal : api.releaseGoal)(id, { accountId: accId, amount: normalizeMoneyInput(amount)! }, key));
  const link = useSubmit(async (key: string) => api.linkGoalTransfer(id, opId!, key));
  const patch = useSubmit(async () => {
    const cur = g.data!;
    const normT = editTarget !== null && isPositiveMoney(editTarget) ? normalizeMoneyInput(editTarget) : null;
    return api.patchGoal(id, {
      ...(editName !== null && editName.trim() && editName.trim() !== cur.name ? { name: editName.trim() } : {}),
      ...(normT && normT !== cur.targetAmount ? { targetAmount: normT } : {}),
      ...(editDate !== null && (editDate || null) !== cur.targetDate ? { targetDate: editDate || null } : {}),
      ...(editNote !== null && (editNote.trim() || null) !== (cur.note ?? null) ? { note: editNote.trim() || null } : {}),
    }, cur.version);
  });
  const archive = useSubmit(async () => (g.data!.status === "active" ? api.archiveGoal(id) : api.restoreGoal(id)));
  const remove = useSubmit(async () => api.deleteGoal(id));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([g.reload(), transfers.reload()]); } finally { setRefreshing(false); }
  };

  if (g.loading && !g.data) return <Screen title="Meta"><Loading /></Screen>;
  if (g.error || !g.data) return <Screen title="Meta"><ErrorBox message={g.error ?? "No se encontró la meta."} onRetry={g.reload} /></Screen>;
  const d = g.data;
  const today = todayLocalIso();
  const reservedAccounts = d.accounts.filter((a) => cmpMoney(a.reserved, "0.00") > 0);
  const activeReleaseAcc = releaseAccount && reservedAccounts.some((a) => a.accountId === releaseAccount)
    ? releaseAccount
    : (reservedAccounts[0]?.accountId ?? null);

  const editTargetBad = editTarget !== null && !isPositiveMoney(editTarget);
  const editDateBad = editDate !== null && editDate !== "" && (!isIsoDate(editDate) || (editDate !== d.targetDate && editDate <= today));
  const editDirty = (editName !== null && editName.trim().length > 0 && editName.trim() !== d.name)
    || (editTarget !== null && isPositiveMoney(editTarget) && normalizeMoneyInput(editTarget) !== d.targetAmount)
    || (editDate !== null && !editDateBad && (editDate || null) !== d.targetDate)
    || (editNote !== null && (editNote.trim() || null) !== (d.note ?? null));

  const effectiveAccountId = mode === "release" ? activeReleaseAcc : account;
  const canMoveMoney = !!effectiveAccountId && isPositiveMoney(amount);

  return (
    <Screen
      title={d.name}
      subtitle={`Objetivo ${formatSoles(d.targetAmount)}${d.targetDate ? ` · ${humanDate(d.targetDate)}` : ""}`}
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={d.status === "active" ? (
        <Button title={editing ? "Cerrar" : "Editar"} variant="secondary" size="compact" onPress={() => setEditing((v) => !v)} />
      ) : undefined}
    >
      <Card>
        <Money value={d.saved} size={30} />
        <Txt size={13} muted>
          {d.percent}% · faltan {formatSoles(d.remaining)}
          {d.daysLeft !== null ? (d.daysLeft < 0 ? ` · venció hace ${Math.abs(d.daysLeft)} días` : ` · ${d.daysLeft} días`) : ""}
        </Txt>
        {d.note ? <Txt size={13} muted>{d.note}</Txt> : null}
        {d.achieved && <Chip status="paid" label="Meta cumplida" />}
        {d.accounts.map((a) => (
          <View key={a.accountId}>
            <KV label={a.name} value={formatSoles(a.reserved)} />
            {a.overReserved && <Notice tone="warn">Lo reservado en {a.name} supera su saldo.</Notice>}
          </View>
        ))}
      </Card>

      {d.status === "active" && editing && (
        <Card>
          <Txt bold size={14}>Editar meta</Txt>
          <Field label="Nombre" value={editName ?? d.name} onChangeText={setEditName} autoCapitalize="sentences" maxLength={80} />
          <MoneyField label="Objetivo" value={editTarget ?? d.targetAmount} onChange={setEditTarget} />
          {editTargetBad && <Txt size={12} color={colors.expenseStrong}>El objetivo debe ser mayor a S/ 0.00.</Txt>}
          <DateField label="Fecha objetivo" value={editDate ?? d.targetDate ?? ""} optional onChange={setEditDate} />
          {editDateBad && <Txt size={12} color={colors.expenseStrong}>La fecha objetivo debe ser posterior a hoy.</Txt>}
          <Field label="Nota (opcional)" value={editNote ?? d.note ?? ""} onChangeText={setEditNote} autoCapitalize="sentences" maxLength={200} />
          <Button
            title="Guardar cambios"
            busy={patch.busy}
            disabled={!editDirty || editTargetBad || editDateBad}
            onPress={async () => {
              if (await patch.submit()) {
                setEditName(null);
                setEditTarget(null);
                setEditDate(null);
                setEditNote(null);
                setEditing(false);
                void g.reload();
              }
            }}
          />
          {patch.error && <Notice tone="err">{patch.error}</Notice>}
        </Card>
      )}

      {d.status === "archived" && (
        <Notice tone="info">
          {d.saved !== "0.00"
            ? `Esta meta está archivada: los ${formatSoles(d.saved)} guardados aquí ya cuentan como dinero libre en tus cuentas. Si la restauras, volverán a apartarse.`
            : "Esta meta está archivada. Puedes restaurarla cuando quieras."}
        </Notice>
      )}

      {d.status === "active" && (
        <Card>
          <Choice label="Qué quieres hacer" value={mode} onChange={(m) => { setMode(m); setAmount(""); money.resetKey(); }} options={[{ id: "reserve", label: "Reservar dinero" }, { id: "release", label: "Liberar dinero" }, { id: "link", label: "Vincular transferencia" }]} />
          {mode === "reserve" ? (
            <>
              <AccountPicker label="Reservar de la cuenta" value={account} excludeTypes={["credit"]} onChange={(v) => { setAccount(v); money.resetKey(); }} />
              <MoneyField label="Importe" value={amount} onChange={(v) => { setAmount(v); money.resetKey(); }} />
              <Button title="Reservar" busy={money.busy} disabled={!canMoveMoney} onPress={async () => { if (await money.submit(account!)) { setAmount(""); void g.reload(); } }} />
              {money.error && <Notice tone="err">{money.error}</Notice>}
              <Txt size={12} muted>Reservar aparta dinero que ya está en tu cuenta: no crea movimientos ni cambia el saldo.</Txt>
            </>
          ) : mode === "release" ? (
            reservedAccounts.length === 0 ? (
              <Notice tone="info">Todavía no tienes dinero reservado en esta meta para liberar.</Notice>
            ) : (
              <>
                <Choice
                  select
                  label="Liberar de la cuenta"
                  value={activeReleaseAcc}
                  onChange={(v) => { setReleaseAccount(v); money.resetKey(); }}
                  options={reservedAccounts.map((a) => ({ id: a.accountId, label: a.name, hint: `Reservado ${formatSoles(a.reserved)}` }))}
                />
                <MoneyField label="Importe" value={amount} onChange={(v) => { setAmount(v); money.resetKey(); }} />
                <Button
                  title="Liberar"
                  busy={money.busy}
                  disabled={!canMoveMoney}
                  onPress={async () => {
                    if (await money.submit(activeReleaseAcc!)) {
                      setAmount("");
                      void g.reload();
                    }
                  }}
                />
                {money.error && <Notice tone="err">{money.error}</Notice>}
                <Txt size={12} muted>El dinero liberado vuelve a contar como saldo libre en tu cuenta.</Txt>
              </>
            )
          ) : (
            <>
              <Choice
                select
                label="Transferencia"
                value={opId}
                onChange={(v) => { setOpId(v); link.resetKey(); }}
                options={(transfers.data?.items ?? []).filter((o) => o.status === "confirmed").map((o) => ({
                  id: o.id,
                  label: `${humanDate(o.occurredOn)} · ${formatSoles(o.amount)}`,
                  hint: [o.accountName && o.toAccountName ? `${o.accountName} → ${o.toAccountName}` : null, o.description || null].filter(Boolean).join(" · ") || undefined,
                }))}
              />
              <Button title="Vincular" busy={link.busy} disabled={!opId} onPress={async () => { if (await link.submit()) { setOpId(null); void g.reload(); } }} />
              {link.error && <Notice tone="err">{link.error}</Notice>}
            </>
          )}
        </Card>
      )}

      <Heading>Historial</Heading>
      {(d.contributions ?? []).length === 0 ? (
        <Card><Txt muted>Aún no hay movimientos en esta meta.</Txt></Card>
      ) : (d.contributions ?? []).map((c) => {
        const isPos = cmpMoney(c.amount, "0.00") > 0;
        const kindLabel = c.kind === "reserve" ? "Reserva" : c.kind === "release" ? "Liberación" : c.kind === "transfer" ? "Transferencia" : "Gasto";
        const dateStr = c.at ? humanDate(c.at.slice(0, 10)) : "";
        return (
          <Card key={c.id} outlined>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt bold size={13}>{c.accountName} · {kindLabel}</Txt>
                {dateStr ? <Txt size={11} muted>{dateStr}</Txt> : null}
              </View>
              <Txt bold size={13} color={isPos ? colors.incomeStrong : colors.expenseStrong} style={{ fontVariant: ["tabular-nums"] }}>
                {isPos ? `+${formatSoles(c.amount)}` : formatSoles(c.amount)}
              </Txt>
            </View>
          </Card>
        );
      })}

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
