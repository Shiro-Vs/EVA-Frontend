import React, { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { BankChangePreview, BankInstallment, BankLoan, BankPaymentPreview, ChangeKind, LoanFactKey, Preview } from "../../api/types";
import type { BankChangeBody, BankInstallmentIn, BankPaymentBody } from "../../api/client";
import { AccountPicker, Choice, DateField, MoneyField, OptionalAccountPicker, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, RowLink, Screen, Txt, SwitchRow } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

const FACT_LABEL: Record<LoanFactKey, string> = {
  principal: "Capital", tea: "TEA", tcea: "TCEA", term_months: "Plazo (meses)", installments_count: "N.º de cuotas", disbursed_on: "Desembolso", first_due_date: "Primer vencimiento",
  monthly_payment: "Cuota mensual", outstanding_balance: "Saldo pendiente", loan_number: "N.º de préstamo",
};
const MONEY_KEYS = new Set<LoanFactKey>(["principal", "monthly_payment", "outstanding_balance"]);
const DATE_KEYS = new Set<LoanFactKey>(["disbursed_on", "first_due_date"]);
const factValue = (k: LoanFactKey, v: string) => (MONEY_KEYS.has(k) ? formatSoles(v) : DATE_KEYS.has(k) ? humanDate(v) : k === "tea" || k === "tcea" ? `${v} %` : v);
const CHANGE: Record<ChangeKind, { text: string; chip: string }> = { new: { text: "Nuevo", chip: "paid" }, changed: { text: "Cambia", chip: "partial" }, same: { text: "Igual", chip: "converted" }, locked: { text: "Con pagos: no se toca", chip: "exempt" }, removed: { text: "Se retira", chip: "overdue" } };
const STATE: Record<BankInstallment["state"], { chip: string; text: string }> = { paid: { chip: "paid", text: "Pagada" }, partial: { chip: "partial", text: "Parcial" }, partial_overdue: { chip: "overdue", text: "Parcial vencida" }, overdue: { chip: "overdue", text: "Vencida" }, upcoming: { chip: "unpaid", text: "Por vencer" } };
const KIND_LABEL = { summary: "Hoja resumen", schedule: "Cronograma", statement: "Estado de cuenta" } as const;

const parts = (i: { principal: string | null; interest: string | null; insurance: string | null; fees: string | null }) =>
  [["Capital", i.principal], ["Interés", i.interest], ["Seguro", i.insurance], ["Comisiones", i.fees]].filter(([, v]) => v !== null).map(([k, v]) => `${k} ${formatSoles(v as string)}`).join(" · ");

// ───────────────────────── Lista y alta ─────────────────────────

export function BankLoansScreen() {
  const router = useRouter();
  const loans = useAsync(() => api.bankLoans(), []);
  useFocusReload(loans.reload);
  return (
    <Screen title="Préstamos bancarios" subtitle="Solo datos confirmados por documento o por ti" footer={<Button title="Nuevo préstamo bancario" icon="add" onPress={() => router.push("/bank-loans/new" as never)} />}>
      {loans.loading && !loans.data ? <Loading /> : loans.error ? <ErrorBox message={loans.error} onRetry={loans.reload} /> : (loans.data ?? []).length === 0 ? (
        <Empty icon="business-outline" title="Sin préstamos bancarios" text="Crea uno y agrégale el cronograma o la hoja resumen (desde la bandeja de captura o a mano)." />
      ) : (loans.data ?? []).map((l) => (
        <RowLink key={l.id} onPress={() => router.push(`/bank-loan/${l.id}` as never)}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt bold>{l.name}</Txt>
            <Txt size={12} muted>{l.entity ?? "Sin entidad"}{l.nextDue ? ` · próxima cuota ${humanDate(l.nextDue.dueDate)}` : " · sin calendario"}</Txt>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {l.status === "closed" && <Badge text="Cerrado" />}
              {l.overdue > 0 && <Badge text={`${l.overdue} vencida${l.overdue > 1 ? "s" : ""}`} tone="danger" />}
              {l.pending.length > 0 && <Badge text={`Faltan ${l.pending.length} datos`} tone="warn" />}
            </View>
          </View>
          <Txt bold>{formatSoles(l.remainingScheduled)}</Txt>
        </RowLink>
      ))}
    </Screen>
  );
}

export function BankLoanNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const create = useSubmit(async () => api.createBankLoan({ name: name.trim(), entity: entity.trim() || null, accountId, note: note.trim() || null }));
  return (
    <Screen title="Nuevo préstamo bancario" footer={<Button title="Crear" busy={create.busy} disabled={!name.trim()} onPress={async () => { const l = await create.submit(); if (l) router.replace(`/bank-loan/${l.id}` as never); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); create.resetKey(); }} autoCapitalize="sentences" placeholder="Préstamo personal" maxLength={80} />
        <Field label="Entidad (opcional)" value={entity} onChangeText={setEntity} autoCapitalize="words" placeholder="Banco" maxLength={80} />
        <OptionalAccountPicker label="Cuenta con la que sueles pagarlo (opcional)" value={accountId} onChange={setAccountId} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} autoCapitalize="sentences" maxLength={300} />
      </Card>
      <Notice tone="info">Se crea vacío: no se inventa ningún dato. Después agregas la hoja resumen y el cronograma, por documento o a mano.</Notice>
      {create.error && <Notice tone="err">{create.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Detalle ─────────────────────────

export function BankLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useAsync(() => api.bankLoan(id), [id]);
  useFocusReload(q.reload);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const reverse = useSubmit(async (key: string, pid: string) => api.reverseBankPayment(pid, reason.trim(), key));
  const toggle = useSubmit(async () => api.patchBankLoan(id, { status: q.data!.status === "active" ? "closed" : "active" }, q.data!.version));

  if (q.loading && !q.data) return <Screen title="Préstamo"><Loading /></Screen>;
  if (q.error || !q.data) return <Screen title="Préstamo"><ErrorBox message={q.error ?? "No se encontró el préstamo."} onRetry={q.reload} /></Screen>;
  const l: BankLoan = q.data;
  const active = l.status === "active";
  return (
    <Screen title={l.name} subtitle={l.entity ?? undefined}>
      <Card>
        <KV label="Por pagar según el calendario" value={formatSoles(l.totals.remainingScheduled)} strong />
        <KV label="Total del calendario" value={formatSoles(l.totals.scheduled)} />
        <KV label="Pagado" value={formatSoles(l.totals.paid)} />
        {l.nextDue && <KV label="Próxima cuota" value={`${l.nextDue.number} · ${humanDate(l.nextDue.dueDate)} · ${formatSoles(l.nextDue.remaining)}`} />}
        {l.totals.overdue > 0 && <Notice tone="warn">{l.totals.overdue} cuota(s) vencida(s). EVA solo lo marca: no calcula mora ni mueve el calendario.</Notice>}
      </Card>

      {active && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Registrar pago" icon="cash-outline" onPress={() => router.push(`/bank-loan/${id}/pay` as never)} /></View>
          <View style={{ flex: 1 }}><Button title="Documento o datos" variant="secondary" icon="document-text-outline" onPress={() => router.push(`/bank-loan/${id}/change` as never)} /></View>
        </View>
      )}

      <Heading>Datos confirmados</Heading>
      <Card outlined>
        {l.facts.length === 0 && <Txt size={13} muted>Todavía no hay datos confirmados.</Txt>}
        {l.facts.map((f) => (
          <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><KV label={FACT_LABEL[f.key]} value={`${factValue(f.key, f.value)}${f.asOf ? ` (al ${humanDate(f.asOf)})` : ""}`} /></View>
            <Badge text={f.origin === "document" ? "Documento" : "Tú"} />
          </View>
        ))}
        {l.pending.length > 0 && <Txt size={12} muted>Pendiente de conocer: {l.pending.map((k) => FACT_LABEL[k]).join(", ")}. No impide registrar pagos.</Txt>}
      </Card>

      {l.warnings.map((w, i) => <Notice key={i} tone="warn">{w.message}</Notice>)}

      <Heading>Calendario</Heading>
      {l.installments.length === 0 ? <Empty icon="calendar-outline" title="Sin calendario" text="Agrega el cronograma por documento o a mano. Lo que no esté confirmado no se muestra." /> : l.installments.map((i) => (
        <Card key={i.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt bold>Cuota {i.number} · vence {humanDate(i.dueDate)}</Txt>
              {parts(i) !== "" && <Txt size={11} muted>{parts(i)}</Txt>}
            </View>
            <Txt bold>{formatSoles(i.total)}</Txt>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Chip status={STATE[i.state].chip} label={STATE[i.state].text} />
            <Badge text={i.origin === "document" ? "Documento" : "Tú"} />
            {i.state === "paid" && i.paidOn && <Txt size={11} muted>Pagada el {humanDate(i.paidOn)}{i.late ? " (con atraso)" : ""}</Txt>}
            {(i.state === "partial" || i.state === "partial_overdue") && <Txt size={11} muted>Pagado {formatSoles(i.paidAmount)} · resta {formatSoles(i.remaining)}</Txt>}
          </View>
        </Card>
      ))}

      <Heading>Pagos</Heading>
      {l.payments.length === 0 ? <Txt size={13} muted>Sin pagos registrados.</Txt> : l.payments.map((p) => (
        <Card key={p.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt bold>{formatSoles(p.amount)} · {humanDate(p.paidOn)}</Txt>
              {parts(p) !== "" && <Txt size={11} muted>{parts(p)}</Txt>}
              {p.note && <Txt size={11} muted>{p.note}</Txt>}
            </View>
            {p.status === "reversed" ? <Chip status="converted" label="Revertido" /> : <Button title="Revertir" variant="secondary" onPress={() => { setReversing(reversing === p.id ? null : p.id); setReason(""); }} />}
          </View>
          {reversing === p.id && (
            <>
              <ReasonField value={reason} onChange={setReason} />
              <Button title="Confirmar reversión" variant="danger" busy={reverse.busy} disabled={!reason.trim()} onPress={async () => { if (await reverse.submit(p.id)) { setReversing(null); await q.reload(); } }} />
            </>
          )}
        </Card>
      ))}
      {reverse.error && <Notice tone="err">{reverse.error}</Notice>}

      {l.documents.length > 0 && (
        <>
          <Heading>Historial de documentos</Heading>
          {l.documents.map((d) => (
            <Card key={d.id} outlined>
              <Txt bold>{KIND_LABEL[d.kind]}{d.documentId ? "" : " (manual)"}</Txt>
              <Txt size={12} muted>{humanDate(d.confirmedAt.slice(0, 10))} · {d.summary.facts.length} dato(s) y {d.summary.installments.length} cuota(s) tocados{d.summary.warnings.length ? " · confirmado con advertencias" : ""}</Txt>
            </Card>
          ))}
        </>
      )}

      <Button title={active ? "Cerrar préstamo" : "Reabrir préstamo"} variant="secondary" busy={toggle.busy} onPress={async () => { if (await toggle.submit()) await q.reload(); }} />
      {toggle.error && <Notice tone="err">{toggle.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Pago ─────────────────────────

export function BankLoanPayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const loan = useAsync(() => api.bankLoan(id), [id]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [inst, setInst] = useState<string>("none");
  const [note, setNote] = useState("");
  const [br, setBr] = useState({ principal: "", interest: "", insurance: "", fees: "" });
  const [shortfall, setShortfall] = useState(false);

  useEffect(() => { if (loan.data?.accountId && !accountId) setAccountId(loan.data.accountId); }, [loan.data?.accountId]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = (): BankPaymentBody => {
    const b: BankPaymentBody = { accountId: accountId!, amount: normalizeMoneyInput(amount)! };
    if (paidOn) b.paidOn = paidOn;
    if (inst !== "none") b.installmentNumber = Number(inst);
    if (note.trim()) b.note = note.trim();
    for (const k of ["principal", "interest", "insurance", "fees"] as const) { const v = normalizeMoneyInput(br[k]); if (v) b[k] = v; }
    return b;
  };
  const flow = usePreviewFlow({
    preview: () => api.previewBankPayment(id, body()) as unknown as Promise<Preview>,
    apply: (token, key) => api.payBankLoan(id, { ...body(), previewToken: token, ...(shortfall ? { acceptReserveShortfall: true } : {}) }, key),
  });
  const t = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };

  if (loan.loading && !loan.data) return <Screen title="Registrar pago"><Loading /></Screen>;
  if (loan.error || !loan.data) return <Screen title="Registrar pago"><ErrorBox message={loan.error ?? "No se encontró el préstamo."} onRetry={loan.reload} /></Screen>;
  const open = loan.data.installments.filter((i) => i.state !== "paid");
  const ready = !!accountId && !!normalizeMoneyInput(amount) && (paidOn === "" || isIsoDate(paidOn))
    && (["principal", "interest", "insurance", "fees"] as const).every((k) => br[k] === "" || !!normalizeMoneyInput(br[k]));
  const pv = flow.data as unknown as BankPaymentPreview | null;

  return (
    <Screen title="Registrar pago" subtitle={loan.data.name}
      footer={flow.canConfirm
        ? <View style={{ gap: 8 }}><Button title="Confirmar pago" busy={flow.applying} onPress={async () => { if (await flow.confirm()) router.replace(`/bank-loan/${id}` as never); }} /><Button title="Cambiar datos" variant="secondary" onPress={flow.invalidate} /></View>
        : <Button title="Ver efecto del pago" busy={flow.loading} disabled={!ready} onPress={flow.run} />}>
      <Card>
        <AccountPicker label="Sale de la cuenta" value={accountId} onChange={t(setAccountId)} />
        <MoneyField label="Importe pagado" value={amount} onChange={t(setAmount)} />
        <DateField label="Fecha real del pago (hoy si queda vacía)" value={paidOn} optional onChange={t(setPaidOn)} />
        <Choice select label="¿A qué cuota corresponde?" value={inst} onChange={t(setInst)} options={[{ id: "none", label: "Sin cuota" }, ...open.map((i) => ({ id: String(i.number), label: `Cuota ${i.number}`, hint: `${humanDate(i.dueDate)} · resta ${formatSoles(i.remaining)}` }))]} />
        <Field label="Nota (opcional)" value={note} onChangeText={t(setNote)} autoCapitalize="sentences" maxLength={200} />
      </Card>
      <Card>
        <Txt bold>Desglose (opcional)</Txt>
        <Txt size={12} muted>Complétalo solo con lo que consta en el comprobante; no hace falta inventarlo.</Txt>
        <MoneyField label="Capital" value={br.principal} optional onChange={(v) => { setBr((b) => ({ ...b, principal: v })); flow.invalidate(); }} />
        <MoneyField label="Interés" value={br.interest} optional onChange={(v) => { setBr((b) => ({ ...b, interest: v })); flow.invalidate(); }} />
        <MoneyField label="Seguro" value={br.insurance} optional onChange={(v) => { setBr((b) => ({ ...b, insurance: v })); flow.invalidate(); }} />
        <MoneyField label="Comisiones" value={br.fees} optional onChange={(v) => { setBr((b) => ({ ...b, fees: v })); flow.invalidate(); }} />
      </Card>
      {flow.error && <Notice tone="err">{flow.error}</Notice>}
      {pv && (
        <Card outlined>
          <Txt bold>Efecto</Txt>
          <KV label="Cuenta" value={`${formatSoles(pv.account.before)} → ${formatSoles(pv.account.after)}`} />
          {pv.installment && <KV label={`Cuota ${pv.installment.number}`} value={`pagado ${formatSoles(pv.installment.paidBefore)} → ${formatSoles(pv.installment.paidAfter)} de ${formatSoles(pv.installment.total)}`} />}
          {pv.installment?.settles && <Txt size={12}>{pv.installment.late ? "La cuota queda pagada, con atraso (se guarda la fecha real)." : "La cuota queda pagada."}</Txt>}
          <Txt size={12} muted>{pv.note}</Txt>
        </Card>
      )}
      {flow.applyError && <Notice tone="err">{flow.applyError}</Notice>}
      {flow.applyError?.toLowerCase().includes("meta") && (
        <SwitchRow label="Aceptar aunque deje metas con faltante" value={shortfall} onValueChange={setShortfall} />
      )}
    </Screen>
  );
}

// ───────────────────────── Cambios: documento o manual ─────────────────────────

/** "n, AAAA-MM-DD, capital, interés, seguro, comisiones, total" por línea; «-» o vacío = no consta. */
export function parseInstallments(text: string): { rows: BankInstallmentIn[]; error: string | null } {
  const rows: BankInstallmentIn[] = [];
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (let n = 0; n < lines.length; n++) {
    const c = lines[n]!.split(/[,;\t]/).map((s) => s.trim());
    if (c.length !== 7) return { rows: [], error: `Línea ${n + 1}: se esperan 7 columnas (n, fecha, capital, interés, seguro, comisiones, total).` };
    const num = Number(c[0]);
    const opt = (v: string) => (v === "" || v === "-" ? null : normalizeMoneyInput(v) ?? undefined);
    const [p, i, s, f] = [opt(c[2]!), opt(c[3]!), opt(c[4]!), opt(c[5]!)];
    const total = normalizeMoneyInput(c[6]!);
    if (!Number.isInteger(num) || num < 1) return { rows: [], error: `Línea ${n + 1}: número de cuota inválido.` };
    if (!isIsoDate(c[1]!)) return { rows: [], error: `Línea ${n + 1}: fecha inválida (AAAA-MM-DD).` };
    if (p === undefined || i === undefined || s === undefined || f === undefined) return { rows: [], error: `Línea ${n + 1}: importe inválido.` };
    if (!total) return { rows: [], error: `Línea ${n + 1}: total inválido.` };
    rows.push({ number: num, dueDate: c[1]!, principal: p, interest: i, insurance: s, fees: f, total });
  }
  return { rows, error: null };
}
const toLines = (rows: Array<{ number: number; incoming: { dueDate: string; principal: string | null; interest: string | null; insurance: string | null; fees: string | null; total: string } | null }>) =>
  rows.filter((r) => r.incoming).map((r) => [r.number, r.incoming!.dueDate, r.incoming!.principal ?? "-", r.incoming!.interest ?? "-", r.incoming!.insurance ?? "-", r.incoming!.fees ?? "-", r.incoming!.total].join(", ")).join("\n");

export function BankLoanChangeScreen() {
  const { id, documentId: docParam, kind: kindParam } = useLocalSearchParams<{ id: string; documentId?: string; kind?: string }>();
  const router = useRouter();
  const docs = useAsync(() => api.documents("loan_document"), []);
  const [mode, setMode] = useState<"doc" | "manual">(docParam ? "doc" : "manual");
  const [documentId, setDocumentId] = useState<string | null>(docParam ?? null);
  const [kind, setKind] = useState<"summary" | "schedule" | "statement">((kindParam as "summary") ?? "schedule");
  const [facts, setFacts] = useState<Array<{ key: LoanFactKey; value: string }>>([]);
  const [newKey, setNewKey] = useState<LoanFactKey>("principal");
  const [newVal, setNewVal] = useState("");
  const [linesText, setLinesText] = useState("");
  const [override, setOverride] = useState<string | null>(null);
  const [ack, setAck] = useState(false);

  const manualInst = mode === "manual" ? parseInstallments(linesText) : { rows: [] as BankInstallmentIn[], error: null };
  const overInst = override !== null ? parseInstallments(override) : { rows: [] as BankInstallmentIn[], error: null };
  const body = (): BankChangeBody => {
    if (mode === "doc") return { documentId: documentId!, kind, ...(override !== null && overInst.rows.length ? { installments: overInst.rows } : {}) };
    return { ...(facts.length ? { facts } : {}), ...(manualInst.rows.length ? { installments: manualInst.rows } : {}) };
  };
  const flow = usePreviewFlow({
    preview: () => api.previewBankChange(id, body()) as unknown as Promise<Preview>,
    apply: (token, key) => api.applyBankChange(id, { ...body(), previewToken: token, ...(ack ? { acknowledgeWarnings: true } : {}) }, key),
  });
  const inv = () => { flow.invalidate(); setAck(false); };
  const pv = flow.data as unknown as BankChangePreview | null;
  const ready = mode === "doc" ? !!documentId : (facts.length > 0 || manualInst.rows.length > 0) && !manualInst.error;

  return (
    <Screen title="Documento o datos" subtitle="Se revisa qué cambia antes de guardar"
      footer={flow.canConfirm
        ? <View style={{ gap: 8 }}>
            <Button title="Guardar cambios" busy={flow.applying} disabled={!!pv && !pv.hasChanges || (!!pv?.requiresAcknowledge && !ack)} onPress={async () => { if (await flow.confirm()) router.replace(`/bank-loan/${id}` as never); }} />
            <Button title="Cambiar" variant="secondary" onPress={inv} />
          </View>
        : <Button title="Ver qué cambia" busy={flow.loading} disabled={!ready} onPress={flow.run} />}>
      <Choice label="Origen" value={mode} onChange={(v) => { setMode(v); inv(); }} options={[{ id: "doc", label: "Un documento recibido" }, { id: "manual", label: "Escribirlo a mano" }]} />

      {mode === "doc" ? (
        <Card>
          {!docParam && (docs.loading && !docs.data ? <Loading /> : (docs.data ?? []).length === 0
            ? <Notice tone="info">No hay documentos de préstamo por asociar. Súbelos desde la bandeja de captura.</Notice>
            : <Choice label="Documento" value={documentId} onChange={(v) => { setDocumentId(v); inv(); }} options={(docs.data ?? []).map((d) => ({ id: d.id, label: d.filename ?? d.subject ?? humanDate(d.receivedAt.slice(0, 10)) }))} />)}
          <Choice label="Qué tipo de documento es" value={kind} onChange={(v) => { setKind(v); inv(); }} options={[{ id: "summary", label: "Hoja resumen", hint: "condiciones" }, { id: "schedule", label: "Cronograma", hint: "cuotas" }, { id: "statement", label: "Estado de cuenta", hint: "saldo" }]} />
          <Txt size={12} muted>Los tipos no son intercambiables: si eliges uno que no corresponde, se rechaza.</Txt>
        </Card>
      ) : (
        <>
          <Card>
            <Txt bold>Datos del préstamo</Txt>
            {facts.map((f, i) => (
              <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}><KV label={FACT_LABEL[f.key]} value={f.value} /></View>
                <Button title="Quitar" variant="secondary" size="small" onPress={() => { setFacts(facts.filter((_, j) => j !== i)); inv(); }} />
              </View>
            ))}
            <Choice label="Agregar dato" value={newKey} onChange={setNewKey} options={(Object.keys(FACT_LABEL) as LoanFactKey[]).map((k) => ({ id: k, label: FACT_LABEL[k] }))} />
            <Field label={`Valor de ${FACT_LABEL[newKey]}${MONEY_KEYS.has(newKey) ? " (S/)" : DATE_KEYS.has(newKey) ? " · AAAA-MM-DD" : newKey === "tea" || newKey === "tcea" ? " (%)" : ""}`} value={newVal} onChangeText={setNewVal} autoCapitalize="none" />
            <Button title="Agregar" variant="secondary" disabled={!newVal.trim()} onPress={() => { setFacts([...facts.filter((f) => f.key !== newKey), { key: newKey, value: newVal.trim() }]); setNewVal(""); inv(); }} />
          </Card>
          <Card>
            <Txt bold>Cuotas</Txt>
            <Txt size={12} muted>Una por línea: n, AAAA-MM-DD, capital, interés, seguro, comisiones, total. Usa «-» en lo que no conste.</Txt>
            <Field label="Cuotas" value={linesText} onChangeText={(v) => { setLinesText(v); inv(); }} multiline numberOfLines={6} placeholder={"1, 2026-11-15, 380.12, 22.80, 3.10, -, 406.02"} />
            {manualInst.error && <Notice tone="err">{manualInst.error}</Notice>}
          </Card>
        </>
      )}

      {flow.error && <Notice tone="err">{flow.error}</Notice>}
      {pv && (
        <>
          {!pv.hasChanges && <Notice tone="info">No hay cambios: lo que trae coincide con lo que ya tienes.</Notice>}
          {pv.facts.length > 0 && (
            <Card outlined>
              <Txt bold>Datos</Txt>
              {pv.facts.map((f) => (
                <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}><KV label={FACT_LABEL[f.key]} value={f.change === "changed" ? `${factValue(f.key, f.current!)} → ${factValue(f.key, f.incoming)}` : factValue(f.key, f.incoming)} /></View>
                  <Chip status={CHANGE[f.change].chip} label={CHANGE[f.change].text} />
                </View>
              ))}
            </Card>
          )}
          {pv.installments.length > 0 && (
            <Card outlined>
              <Txt bold>Cuotas</Txt>
              {pv.installments.map((r) => (
                <View key={r.number} style={{ gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Txt size={13} bold>Cuota {r.number}{r.incoming ? ` · ${humanDate(r.incoming.dueDate)} · ${formatSoles(r.incoming.total)}` : ""}</Txt>
                      {r.change === "changed" && r.current && <Txt size={11} muted>Antes: {humanDate(r.current.dueDate)} · {formatSoles(r.current.total)}</Txt>}
                      {r.change === "locked" && <Txt size={11} muted>Tiene pagos: se conserva como está.</Txt>}
                    </View>
                    <Chip status={CHANGE[r.change].chip} label={CHANGE[r.change].text} />
                  </View>
                </View>
              ))}
            </Card>
          )}
          {pv.warnings.length > 0 && (
            <>
              {pv.warnings.map((w, i) => <Notice key={i} tone="warn">{w.message}</Notice>)}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Switch value={ack} onValueChange={setAck} />
                <Txt size={13} style={{ flex: 1 }}>Entiendo las advertencias y quiero guardarlo así</Txt>
              </View>
            </>
          )}
          {mode === "doc" && pv.kind === "schedule" && (
            <Card>
              <Txt bold>¿Algo mal leído?</Txt>
              {override === null
                ? <Button title="Corregir las cuotas leídas" variant="secondary" onPress={() => setOverride(toLines(pv.installments))} />
                : (
                  <>
                    <Field label="Cuotas (n, fecha, capital, interés, seguro, comisiones, total)" value={override} onChangeText={setOverride} multiline numberOfLines={8} />
                    {overInst.error && <Notice tone="err">{overInst.error}</Notice>}
                    <Button title="Recalcular con mis correcciones" disabled={!!overInst.error} onPress={() => { flow.invalidate(); setAck(false); void Promise.resolve().then(flow.run); }} />
                  </>
                )}
            </Card>
          )}
        </>
      )}
      {flow.applyError && <Notice tone="err">{flow.applyError}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Desde un documento de la bandeja ─────────────────────────

export function DocumentToLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const loans = useAsync(() => api.bankLoans("active"), []);
  const [target, setTarget] = useState<string>("new");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"summary" | "schedule" | "statement">("schedule");
  const go = useSubmit(async () => {
    const loanId = target === "new" ? (await api.createBankLoan({ name: name.trim() })).id : target;
    router.replace(`/bank-loan/${loanId}/change?documentId=${id}&kind=${kind}` as never);
  });
  return (
    <Screen title="Usar en un préstamo" footer={<Button title="Continuar" busy={go.busy} disabled={target === "new" && !name.trim()} onPress={go.submit} />}>
      <Card>
        <Choice label="Préstamo" value={target} onChange={setTarget} options={[{ id: "new", label: "Uno nuevo" }, ...(loans.data ?? []).map((l) => ({ id: l.id, label: l.name }))]} />
        {target === "new" && <Field label="Nombre del préstamo nuevo" value={name} onChangeText={setName} autoCapitalize="sentences" placeholder="Préstamo personal" maxLength={80} />}
        <Choice label="Tipo de documento" value={kind} onChange={setKind} options={[{ id: "summary", label: "Hoja resumen" }, { id: "schedule", label: "Cronograma" }, { id: "statement", label: "Estado de cuenta" }]} />
      </Card>
      <Notice tone="info">En el siguiente paso verás qué datos y cuotas cambian antes de guardar. Nada se guarda sin que lo confirmes.</Notice>
      {go.error && <Notice tone="err">{go.error}</Notice>}
    </Screen>
  );
}
