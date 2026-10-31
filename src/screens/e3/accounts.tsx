import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { CardStatement, CreditDetails, Occurrence } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, DateField, FlowResult, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

// ───────────────────────── Conciliación ─────────────────────────

/** Compara el saldo real con el registrado; con diferencia, el ajuste lleva fecha y motivo. */
export function ReconcileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const acc = useAsync(() => api.account(id), [id]);
  const hist = useAsync(() => api.reconciliations(id), [id]);
  const [real, setReal] = useState("");
  const [asOf, setAsOf] = useState("");
  const [reason, setReason] = useState("");
  const credit = acc.data?.type === "credit";
  const realSigned = () => { const n = normalizeMoneyInput(real); return n ? (credit && n !== "0.00" ? `-${n}` : n) : null; };
  const flow = usePreviewFlow({
    preview: () => api.previewReconcile(id, { realBalance: realSigned()!, ...(asOf ? { asOf } : {}) }),
    apply: (token, key) => api.reconcile(id, { realBalance: realSigned()!, ...(asOf ? { asOf } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}), previewToken: token }, key),
  });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  const needsReason = flow.data?.status === "difference";
  return (
    <Screen title="Conciliar" subtitle={acc.data ? `${acc.data.name} · en EVA ${formatSoles(acc.data.balance)}` : undefined}
      footer={<PreviewFooter flow={flow} previewLabel="Comparar" confirmLabel="Registrar" disabled={!realSigned() && real !== "0" && real !== "0.00" || (asOf !== "" && !isIsoDate(asOf))} confirmDisabled={needsReason && !reason.trim()} onConfirm={async () => { if (await flow.confirm()) done(`/account/${id}`); }} />}>
      <Card>
        <MoneyField label={credit ? "Deuda real de la tarjeta" : "Saldo real (según el banco o tu efectivo)"} value={real} onChange={touch(setReal)} />
        <DateField label="A la fecha" value={asOf} optional onChange={touch(setAsOf)} />
        {needsReason && <ReasonField value={reason} onChange={(v) => { setReason(v); }} label="Motivo del ajuste" />}
      </Card>
      <Notice tone="info">Primero revisa y corrige los movimientos. Si la diferencia no se explica, el ajuste queda en una línea propia: no es ingreso ni gasto.</Notice>
      <FlowResult flow={flow} />
      <Heading>Conciliaciones anteriores</Heading>
      {(hist.data ?? []).length === 0 ? <Card><Txt muted>Aún no hay conciliaciones.</Txt></Card> : hist.data!.map((h) => (
        <Card key={h.id} outlined><Txt bold size={13}>{humanDate(h.asOf)} · {h.adjusted ? `ajuste ${formatSoles(h.difference)}` : "coincidía"}</Txt><Txt size={12} muted>{formatSoles(h.registeredBefore)} → {formatSoles(h.balanceAfter)}{h.reason ? ` · ${h.reason}` : ""}</Txt></Card>
      ))}
    </Screen>
  );
}

// ───────────────────────── Tarjeta de crédito ─────────────────────────

export function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const acc = useAsync(() => api.account(id), [id]);
  const det = useAsync(() => api.creditDetails(id), [id]);
  const sts = useAsync(() => api.statements(id), [id]);
  const plans = useAsync(() => api.installmentPlans(id), [id]);
  useFocusReload(() => { void acc.reload(); void det.reload(); void sts.reload(); void plans.reload(); });
  const cfg = det.data && "cutoffDay" in det.data ? (det.data as CreditDetails) : null;
  const [line, setLine] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const saveCfg = useSubmit(async () => api.setCreditDetails(id, {
    creditLine: (line ?? cfg?.creditLine ?? "") ? normalizeMoneyInput(line ?? cfg?.creditLine ?? "") : null, cutoffDay: Number.parseInt(cutoff ?? String(cfg?.cutoffDay ?? ""), 10), dueDay: Number.parseInt(due ?? String(cfg?.dueDay ?? ""), 10),
  }));
  const cancel = useSubmit(async (_k: string, planId: string) => api.cancelInstallmentPlan(planId));
  const voidSt = useSubmit(async (_k: string, s: CardStatement) => api.voidStatement(s.id, "Anulado desde la app"));
  const c = (acc.data as unknown as { credit?: { creditLine: string | null; used: string; available: string | null } })?.credit;
  return (
    <Screen title={acc.data?.name ?? "Tarjeta"} subtitle="Tarjeta de crédito">
      <Card>
        <KV label="Deuda" value={formatSoles(c?.used ?? "0.00")} strong />
        {c?.available != null && <KV label="Línea disponible (no es dinero propio)" value={formatSoles(c.available)} />}
      </Card>
      <Heading>Corte y pago</Heading>
      <Card>
        <MoneyField label="Línea de crédito" value={line ?? cfg?.creditLine ?? ""} optional onChange={setLine} />
        <Field label="Día de corte (1–31)" value={cutoff ?? String(cfg?.cutoffDay ?? "")} onChangeText={setCutoff} keyboardType="number-pad" />
        <Field label="Día límite de pago (1–31)" value={due ?? String(cfg?.dueDay ?? "")} onChangeText={setDue} keyboardType="number-pad" />
        <Button title="Guardar configuración" busy={saveCfg.busy} disabled={!(cutoff ?? cfg?.cutoffDay) || !(due ?? cfg?.dueDay)} onPress={async () => { if (await saveCfg.submit()) { setLine(null); setCutoff(null); setDue(null); void det.reload(); void acc.reload(); } }} />
        {saveCfg.error && <Notice tone="err">{saveCfg.error}</Notice>}
      </Card>
      <View style={{ gap: 10 }}>
        <Button title="Registrar estado de cuenta" icon="document-text-outline" onPress={() => router.push(`/account/${id}/statement/new` as never)} />
        <Button title="Compra en cuotas" variant="secondary" icon="layers-outline" onPress={() => router.push(`/account/${id}/installments/new` as never)} />
        <Button title="Conciliar saldo" variant="secondary" icon="git-compare-outline" onPress={() => router.push(`/account/${id}/reconcile` as never)} />
      </View>
      <Heading>Estados de cuenta</Heading>
      {(sts.data ?? []).length === 0 ? <Card><Txt muted>Sin estados de cuenta.</Txt></Card> : sts.data!.map((s) => (
        <RowLink key={s.id} onPress={() => router.push(`/card-statement/${s.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>Corte {humanDate(s.cutoffDate)}</Txt><Txt size={12} muted>Pagar hasta {humanDate(s.dueDate)} · período {formatSoles(s.periodTotal)} · mínimo {formatSoles(s.minimumPayment)}</Txt></View>
          <Chip status={s.status === "paid" ? "paid" : s.overdue ? "overdue" : s.status === "partial" ? "partial" : s.status === "void" ? "converted" : "unpaid"} label={s.overdue ? "Vencido" : undefined} />
        </RowLink>
      ))}
      {voidSt.error && <Notice tone="err">{voidSt.error}</Notice>}
      <Heading>Compras en cuotas</Heading>
      {(plans.data ?? []).map((p) => (
        <Card key={p.id} outlined>
          <Txt bold>{p.description || "Compra en cuotas"} · {formatSoles(p.principal)} en {p.installments}</Txt>
          <Txt size={12} muted>Por pagar en cuotas: {formatSoles(p.upcomingTotal)} · {p.status === "active" ? "vigente" : "cancelado"}</Txt>
          {p.schedule.map((x) => <KV key={x.number} label={`Cuota ${x.number} · ${humanDate(x.dueDate)}`} value={formatSoles(x.amount)} />)}
          {p.status === "active" && <Button title="Cancelar plan" variant="secondary" busy={cancel.busy} onPress={async () => { if (await cancel.submit(p.id)) void plans.reload(); }} />}
        </Card>
      ))}
    </Screen>
  );
}

export function StatementNewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const [cutoff, setCutoff] = useState("");
  const [due, setDue] = useState("");
  const [total, setTotal] = useState("");
  const [min, setMin] = useState("");
  const [balance, setBalance] = useState("");
  const [note, setNote] = useState("");
  const save = useSubmit(async (key: string) => api.createStatement(id, {
    cutoffDate: cutoff, dueDate: due, periodTotal: normalizeMoneyInput(total)!, minimumPayment: normalizeMoneyInput(min)!, ...(normalizeMoneyInput(balance) ? { totalBalance: normalizeMoneyInput(balance)! } : {}), ...(note.trim() ? { note: note.trim() } : {}),
  }, key));
  const ok = isIsoDate(cutoff) && isIsoDate(due) && !!normalizeMoneyInput(total) && !!normalizeMoneyInput(min);
  return (
    <Screen title="Estado de cuenta" subtitle="Tal como lo informa el banco" footer={<Button title="Registrar" busy={save.busy} disabled={!ok} onPress={async () => { if (await save.submit()) done(`/account/${id}/card`); }} />}>
      <Card>
        <DateField label="Fecha de corte" value={cutoff} onChange={(v) => { setCutoff(v); save.resetKey(); }} />
        <DateField label="Fecha límite de pago" value={due} onChange={(v) => { setDue(v); save.resetKey(); }} />
        <MoneyField label="Pago total del período" value={total} onChange={setTotal} />
        <MoneyField label="Pago mínimo" value={min} onChange={setMin} />
        <MoneyField label="Deuda total informada" value={balance} optional onChange={setBalance} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} autoCapitalize="sentences" />
      </Card>
      <Notice tone="info">El pago total del período no es toda la deuda: la deuda total solo se guarda si el banco la informa.</Notice>
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

export function StatementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useAsync(() => api.cardStatement(id), [id]);
  const ops = useAsync(() => api.operations({ kind: "transfer", limit: 30 }), []);
  useFocusReload(st.reload);
  const [opId, setOpId] = useState<string | null>(null);
  const link = useSubmit(async (key: string) => api.linkCardPayment(id, opId!, key));
  const unlink = useSubmit(async (_k: string, pid: string) => api.unlinkCardPayment(pid));
  if (st.loading && !st.data) return <Screen title="Estado de cuenta"><Loading /></Screen>;
  if (st.error || !st.data) return <Screen title="Estado de cuenta"><ErrorBox message={st.error ?? "No se encontró el estado de cuenta."} onRetry={st.reload} /></Screen>;
  const s = st.data;
  const hereTo = (ops.data?.items ?? []).filter((o) => o.toAccountId === s.accountId && o.status === "confirmed" && !s.payments.some((p) => p.operationId === o.id));
  return (
    <Screen title={`Corte ${humanDate(s.cutoffDate)}`} subtitle={`Pagar hasta ${humanDate(s.dueDate)}`}>
      <Card>
        <KV label="Pago total del período" value={formatSoles(s.periodTotal)} strong /><KV label="Pago mínimo" value={formatSoles(s.minimumPayment)} />
        {s.totalBalance && <KV label="Deuda total informada" value={formatSoles(s.totalBalance)} />}
        <KV label="Pagado" value={formatSoles(s.paid)} /><KV label="Falta" value={formatSoles(s.remaining)} strong />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}><Chip status={s.status === "paid" ? "paid" : s.status === "partial" ? "partial" : "unpaid"} />{s.minimumCovered && <Chip status="paid" label="Mínimo cubierto" />}{s.overdue && <Chip status="overdue" />}</View>
      </Card>
      <Heading>Pagos vinculados</Heading>
      {s.payments.length === 0 ? <Card><Txt muted>Ningún pago vinculado.</Txt></Card> : s.payments.map((p) => (
        <Card key={p.id} outlined><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Txt style={{ flex: 1 }} size={13}>{humanDate(p.occurredOn)} · {formatSoles(p.amount)}</Txt><Button title="Quitar" variant="secondary" size="small" busy={unlink.busy} onPress={async () => { if (await unlink.submit(p.id)) void st.reload(); }} /></View></Card>
      ))}
      {s.status !== "void" && (
        <Card>
          <Choice select label="Vincular una transferencia a esta tarjeta" value={opId} onChange={(v) => { setOpId(v); link.resetKey(); }} options={hereTo.map((o) => ({ id: o.id, label: `${humanDate(o.occurredOn)} · ${formatSoles(o.amount)}`, hint: o.description || undefined }))} />
          {hereTo.length === 0 && <Txt size={12} muted>No hay transferencias hacia esta tarjeta por vincular.</Txt>}
          <Button title="Vincular pago" busy={link.busy} disabled={!opId} onPress={async () => { if (await link.submit()) { setOpId(null); void st.reload(); } }} />
          {(link.error || unlink.error) && <Notice tone="err">{link.error ?? unlink.error}</Notice>}
        </Card>
      )}
    </Screen>
  );
}

export function InstallmentNewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const [amount, setAmount] = useState("");
  const [n, setN] = useState("3");
  const [first, setFirst] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const save = useSubmit(async (key: string) => api.installmentPurchase(id, {
    amount: normalizeMoneyInput(amount)!, installments: Number.parseInt(n, 10), firstDueDate: first, ...(desc.trim() ? { description: desc.trim() } : {}), ...(cat ? { categoryId: cat } : {}), ...(date ? { date } : {}),
  }, key));
  const k = Number.parseInt(n, 10);
  return (
    <Screen title="Compra en cuotas" footer={<Button title="Registrar compra" busy={save.busy} disabled={!normalizeMoneyInput(amount) || !(k >= 2) || !isIsoDate(first) || (date !== "" && !isIsoDate(date))} onPress={async () => { if (await save.submit()) done(`/account/${id}/card`); }} />}>
      <Card>
        <MoneyField label="Total de la compra" value={amount} onChange={(v) => { setAmount(v); save.resetKey(); }} />
        <Field label="Cantidad de cuotas (2–60)" value={n} onChangeText={setN} keyboardType="number-pad" />
        <DateField label="Vence la primera cuota" value={first} onChange={setFirst} />
        <DateField label="Fecha de la compra" value={date} optional onChange={setDate} />
        <Field label="Descripción (opcional)" value={desc} onChangeText={setDesc} autoCapitalize="sentences" />
        <CategoryPicker label="Categoría" value={cat} onChange={setCat} />
      </Card>
      <Notice tone="info">Se registra UN gasto por el total (sube la deuda de la tarjeta). Las cuotas son solo el calendario.</Notice>
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Recurrentes ─────────────────────────

export function RecurringScreen() {
  const router = useRouter();
  const pend = useAsync(() => api.recurringPending(14), []);
  const tpls = useAsync(() => api.recurringTemplates(), []);
  useFocusReload(() => { void pend.reload(); void tpls.reload(); });
  const skip = useSubmit(async (_k: string, o: Occurrence) => api.skipOccurrence(o.id));
  return (
    <Screen title="Recurrentes" subtitle="Solo proponen: nada se registra solo" footer={<Button title="Nueva recurrencia" icon="add" onPress={() => router.push("/recurring/new" as never)} />}>
      <Heading>Por decidir</Heading>
      {(pend.data?.due ?? []).length === 0 ? <Card><Txt muted>No hay nada por decidir.</Txt></Card> : pend.data!.due.map((o) => (
        <Card key={o.id} outlined>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Txt bold>{o.templateName}</Txt><Money value={o.amount} size={15} tone={o.kind === "income" ? "income" : "expense"} /></View>
          <Txt size={12} muted>{o.kind === "income" ? "Ingreso" : "Gasto"} del {humanDate(o.dueDate)}</Txt>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Button title="Confirmar" onPress={() => router.push(`/recurring/occurrence/${o.id}` as never)} /></View>
            <View style={{ flex: 1 }}><Button title="Omitir" variant="secondary" busy={skip.busy} onPress={async () => { if (await skip.submit(o)) void pend.reload(); }} /></View>
          </View>
        </Card>
      ))}
      {skip.error && <Notice tone="err">{skip.error}</Notice>}
      {(pend.data?.upcoming ?? []).length > 0 && <Heading>Próximas</Heading>}
      {(pend.data?.upcoming ?? []).map((u) => <Card key={u.templateId} outlined><Txt size={13}>{humanDate(u.dueDate)} · {u.name} · {formatSoles(u.amount)}</Txt></Card>)}
      <Heading>Plantillas</Heading>
      {(tpls.data ?? []).map((t) => (
        <RowLink key={t.id} onPress={() => router.push(`/recurring/${t.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>{t.name}</Txt><Txt size={12} muted>{formatSoles(t.amount)} · {t.account.name}{t.nextDue ? ` · próxima ${humanDate(t.nextDue)}` : ""}</Txt></View>
          {!!t.pendingCount && <Chip status="partial" label={`${t.pendingCount} por decidir`} />}
        </RowLink>
      ))}
    </Screen>
  );
}

const UNITS = [{ id: "day", label: "Días" }, { id: "week", label: "Semanas" }, { id: "month", label: "Meses" }, { id: "year", label: "Años" }] as const;

export function RecurringNewScreen() {
  const done = useDone();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState<"day" | "week" | "month" | "year">("month");
  const [count, setCount] = useState("1");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const save = useSubmit(async () => api.createRecurring({
    name: name.trim(), kind, accountId: account!, amount: normalizeMoneyInput(amount)!, ...(cat ? { categoryId: cat } : {}), ...(desc.trim() ? { description: desc.trim() } : {}),
    interval: { unit, count: Math.max(1, Number.parseInt(count, 10) || 1) }, startDate: start, ...(end ? { endDate: end } : {}),
  }));
  return (
    <Screen title="Nueva recurrencia" footer={<Button title="Crear" busy={save.busy} disabled={!name.trim() || !account || !normalizeMoneyInput(amount) || !isIsoDate(start) || (end !== "" && !isIsoDate(end))} onPress={async () => { if (await save.submit()) done("/recurring"); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Alquiler" autoCapitalize="sentences" />
        <Choice label="Tipo" value={kind} onChange={setKind} options={[{ id: "expense", label: "Gasto" }, { id: "income", label: "Ingreso" }]} />
        <AccountPicker label={kind === "income" ? "Entra a" : "Se paga con"} value={account} onChange={setAccount} />
        <MoneyField label="Importe esperado" value={amount} onChange={setAmount} />
        <CategoryPicker value={cat} onChange={setCat} />
        <Field label="Descripción (opcional)" value={desc} onChangeText={setDesc} autoCapitalize="sentences" />
      </Card>
      <Card>
        <Choice label="Se repite cada…" value={unit} onChange={setUnit} options={UNITS.map((u) => ({ id: u.id, label: u.label }))} />
        <Field label="Cada cuántas unidades" value={count} onChangeText={setCount} keyboardType="number-pad" />
        <DateField label="Primera fecha" value={start} onChange={setStart} />
        <DateField label="Hasta" value={end} optional onChange={setEnd} />
      </Card>
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

export function RecurringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useAsync(() => api.recurringTemplate(id), [id]);
  useFocusReload(t.reload);
  const act = useSubmit(async (_k: string, a: "pause" | "resume" | "archive") => api.setRecurringStatus(id, a));
  const reopen = useSubmit(async (_k: string, oid: string) => api.reopenOccurrence(oid));
  if (t.loading && !t.data) return <Screen title="Recurrencia"><Loading /></Screen>;
  if (t.error || !t.data) return <Screen title="Recurrencia"><ErrorBox message={t.error ?? "No se encontró la recurrencia."} onRetry={t.reload} /></Screen>;
  const d = t.data;
  return (
    <Screen title={d.name} subtitle={`${d.kind === "income" ? "Ingreso" : "Gasto"} de ${formatSoles(d.amount)} · ${d.account.name}`}>
      <Card><KV label="Estado" value={d.status === "active" ? "Activa" : d.status === "paused" ? "En pausa" : "Archivada"} />{d.nextDue && <KV label="Próxima" value={humanDate(d.nextDue)} />}</Card>
      <View style={{ gap: 10 }}>
        {d.status === "active" && <Button title="Pausar" variant="secondary" busy={act.busy} onPress={async () => { if (await act.submit("pause")) void t.reload(); }} />}
        {d.status === "paused" && <Button title="Reanudar" busy={act.busy} onPress={async () => { if (await act.submit("resume")) void t.reload(); }} />}
        {d.status !== "archived" && <Button title="Archivar" variant="danger" busy={act.busy} onPress={async () => { if (await act.submit("archive")) router.back(); }} />}
      </View>
      {act.error && <Notice tone="err">{act.error}</Notice>}
      <Heading>Ocurrencias</Heading>
      {(d.occurrences ?? []).map((o) => (
        <Card key={o.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt style={{ flex: 1 }} size={13}>{humanDate(o.dueDate)} · {formatSoles(o.amount)}</Txt>
            <Chip status={o.status === "confirmed" ? (o.operationReversed ? "converted" : "paid") : o.status === "skipped" ? "converted" : "partial"} label={o.status === "confirmed" ? (o.operationReversed ? "Revertido" : "Confirmada") : o.status === "skipped" ? "Omitida" : "Por decidir"} />
          </View>
          {o.status === "pending" && <Button title="Decidir" variant="secondary" size="small" onPress={() => router.push(`/recurring/occurrence/${o.id}` as never)} />}
          {(o.status === "skipped" || o.operationReversed) && <Button title="Reabrir" variant="secondary" size="small" busy={reopen.busy} onPress={async () => { if (await reopen.submit(o.id)) void t.reload(); }} />}
        </Card>
      ))}
      {reopen.error && <Notice tone="err">{reopen.error}</Notice>}
    </Screen>
  );
}

/** Confirmar una ocurrencia (con lo esperado o corregido) o vincularla a un movimiento que ya existe. */
export function OccurrenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const pend = useAsync(() => api.recurringPending(0), []);
  const occ = (pend.data?.due ?? []).find((o) => o.id === id);
  const ops = useAsync(() => api.operations({ limit: 30 }), []);
  const [mode, setMode] = useState<"confirm" | "link">("confirm");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const confirm = useSubmit(async (key: string) => api.confirmOccurrence(id, {
    ...(normalizeMoneyInput(amount) ? { amount: normalizeMoneyInput(amount)! } : {}), ...(account ? { accountId: account } : {}), ...(date ? { date } : {}), ...(accept ? { acceptReserveShortfall: true } : {}),
  }, key));
  const link = useSubmit(async () => api.linkOccurrence(id, opId!));
  if (pend.loading && !pend.data) return <Screen title="Ocurrencia"><Loading /></Screen>;
  if (!occ) return <Screen title="Ocurrencia"><Notice tone="info">Esta ocurrencia ya se decidió.</Notice></Screen>;
  const goalConflict = confirm.error?.includes("dinero reservado");
  return (
    <Screen title={occ.templateName} subtitle={`${occ.kind === "income" ? "Ingreso" : "Gasto"} esperado del ${humanDate(occ.dueDate)} · ${formatSoles(occ.amount)}`}>
      <Choice value={mode} onChange={setMode} options={[{ id: "confirm", label: "Registrar ahora" }, { id: "link", label: "Ya lo registré: vincular" }]} />
      {mode === "confirm" ? (
        <Card>
          <MoneyField label={`Importe (esperado ${formatSoles(occ.amount)})`} value={amount} optional onChange={(v) => { setAmount(v); confirm.resetKey(); }} />
          <AccountPicker label="Cuenta (si es otra)" value={account} onChange={setAccount} />
          <DateField label="Fecha (si no es la esperada)" value={date} optional onChange={setDate} />
          {goalConflict && <Button title={accept ? "Aceptado el faltante: confirma de nuevo" : "Aceptar que lo reservado supere el saldo"} variant="secondary" onPress={() => { setAccept(true); confirm.resetKey(); }} />}
          <Button title="Confirmar y registrar" busy={confirm.busy} onPress={async () => { if (await confirm.submit()) done("/recurring"); }} />
          {confirm.error && <Notice tone="err">{confirm.error}</Notice>}
        </Card>
      ) : (
        <Card>
          <Choice select label="Movimiento ya registrado" value={opId} onChange={setOpId} options={(ops.data?.items ?? []).filter((o) => o.kind === occ.kind && o.status === "confirmed").map((o) => ({ id: o.id, label: `${humanDate(o.occurredOn)} · ${formatSoles(o.amount.replace("-", ""))}`, hint: o.description || undefined }))} />
          <Button title="Vincular" busy={link.busy} disabled={!opId} onPress={async () => { if (await link.submit()) done("/recurring"); }} />
          {link.error && <Notice tone="err">{link.error}</Notice>}
          <Txt size={12} muted>No se crea otro movimiento; si el importe o la fecha difieren, se informa.</Txt>
        </Card>
      )}
    </Screen>
  );
}
