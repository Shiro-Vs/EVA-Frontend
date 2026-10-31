import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { LedgerCharge } from "../../api/types";
import { AccountPicker, Choice, DateField, FlowResult, MoneyField, OptionalAccountPicker, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, KV, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { LoanScreen } from "../e2/contact";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

const CONCEPT = { principal: "Capital", interest: "Interés", late_fee: "Mora" } as const;

/** Nuevo préstamo, recibido u otorgado: vista previa del cronograma antes de registrarlo. */
export function LoanNewScreen() {
  const router = useRouter();
  const contacts = useAsync(() => api.contacts(), []);
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [contactId, setContactId] = useState<string | null>(null);
  const [party, setParty] = useState("");
  const [principal, setPrincipal] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "fixed" | "percent">("none");
  const [fixed, setFixed] = useState("");
  const [rate, setRate] = useState("");
  const [base, setBase] = useState<"original" | "pending">("original");
  const [kind, setKind] = useState<"installments" | "final_date" | "open">("installments");
  const [n, setN] = useState("3");
  const [first, setFirst] = useState("");
  const [finalDate, setFinalDate] = useState("");
  const [order, setOrder] = useState<"capital_first" | "interest_first">("capital_first");
  const [early, setEarly] = useState<"keep" | "accrued">("keep");
  const [note, setNote] = useState("");
  const body = () => ({
    direction, ...(contactId ? { contactId } : {}), ...(!contactId && party.trim() ? { counterpartyName: party.trim() } : {}), principal: normalizeMoneyInput(principal)!,
    ...(openedOn ? { openedOn } : {}), ...(account ? { accountId: account } : {}),
    interest: { mode, ...(mode === "fixed" ? { amount: normalizeMoneyInput(fixed) } : {}), ...(mode === "percent" ? { ratePercent: rate.trim(), base } : {}) },
    repayment: { kind, ...(kind === "installments" ? { installments: Number.parseInt(n, 10), firstDueDate: first } : {}), ...(kind === "final_date" ? { finalDate } : {}) },
    paymentOrder: order, earlyPayoff: early, ...(note.trim() ? { note: note.trim() } : {}),
  });
  const flow = usePreviewFlow({ preview: () => api.previewLoan(body() as never), apply: (token, key) => api.createLoan({ ...body(), previewToken: token } as never, key) });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  const ready = !!normalizeMoneyInput(principal) && (direction === "lent" ? !!contactId : !!contactId || !!party.trim())
    && (mode !== "fixed" || !!normalizeMoneyInput(fixed)) && (mode !== "percent" || /^\d+(\.\d{1,2})?$/.test(rate.trim()))
    && (kind !== "installments" || (Number.parseInt(n, 10) >= 1 && isIsoDate(first))) && (kind !== "final_date" || isIsoDate(finalDate)) && (openedOn === "" || isIsoDate(openedOn));
  const people = (contacts.data ?? []).filter((c) => c.status === "active");
  return (
    <Screen title="Nuevo préstamo" footer={<PreviewFooter flow={flow} disabled={!ready} previewLabel="Ver cronograma" confirmLabel="Registrar préstamo" onConfirm={async () => { const r = await flow.confirm(); if (r) router.replace(`/loan/${(r as { id: string }).id}` as never); }} />}>
      <Card>
        <Choice label="Tipo" value={direction} onChange={touch(setDirection)} options={[{ id: "lent", label: "Presté dinero" }, { id: "borrowed", label: "Me prestaron" }]} />
        <Choice select label={direction === "lent" ? "A quién" : "Quién me prestó"} value={contactId} onChange={(v) => touch(setContactId)(v === contactId ? null : v)} options={people.map((c) => ({ id: c.id, label: c.name }))} />
        {direction === "borrowed" && !contactId && <Field label="O el nombre de la entidad o persona" value={party} onChangeText={touch(setParty)} placeholder="Banco X" autoCapitalize="words" />}
        <MoneyField label="Capital" value={principal} onChange={touch(setPrincipal)} />
        <DateField label="Fecha del préstamo" value={openedOn} optional onChange={touch(setOpenedOn)} />
        <OptionalAccountPicker label="Cuenta por la que se movió el dinero (si no, no se registra el movimiento)" value={account} onChange={touch(setAccount)} />
      </Card>
      <Card>
        <Choice label="Interés" value={mode} onChange={touch(setMode)} options={[{ id: "none", label: "Sin interés" }, { id: "fixed", label: "Importe fijo por período" }, { id: "percent", label: "Porcentaje por período" }]} />
        {mode === "fixed" && <MoneyField label="Interés por período" value={fixed} onChange={touch(setFixed)} />}
        {mode === "percent" && (
          <>
            <Field label="Porcentaje por período (ej. 5)" value={rate} onChangeText={touch(setRate)} keyboardType="decimal-pad" />
            <Choice label="Sobre qué capital" value={base} onChange={touch(setBase)} options={[{ id: "original", label: "El original" }, { id: "pending", label: "El pendiente" }]} />
          </>
        )}
        <Choice label="Devolución" value={kind} onChange={touch(setKind)} options={[{ id: "installments", label: "Cuotas mensuales" }, { id: "final_date", label: "Fecha final" }, { id: "open", label: "Sin fecha" }]} />
        {kind === "installments" && <><Field label="Cantidad de cuotas" value={n} onChangeText={touch(setN)} keyboardType="number-pad" /><DateField label="Vence la primera cuota" value={first} onChange={touch(setFirst)} /></>}
        {kind === "final_date" && <DateField label="Fecha final" value={finalDate} onChange={touch(setFinalDate)} />}
      </Card>
      <Card>
        <Choice label="Dentro de cada cuota se paga primero" value={order} onChange={touch(setOrder)} options={[{ id: "capital_first", label: "El capital" }, { id: "interest_first", label: "El interés" }]} />
        <Choice label="Si se paga por adelantado" value={early} onChange={touch(setEarly)} options={[{ id: "keep", label: "Mantener el interés acordado" }, { id: "accrued", label: "Solo el interés devengado" }]} />
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} autoCapitalize="sentences" />
      </Card>
      <FlowResult flow={flow} />
    </Screen>
  );
}

/** Elige el detalle según el motor del préstamo: por conversión de deuda o del libro de cargos. */
export function LoanRouter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loan = useAsync(() => api.loan(id) as Promise<{ engine?: string }>, [id]);
  if (loan.loading && !loan.data) return <Screen title="Préstamo"><Loading /></Screen>;
  if (loan.error) return <Screen title="Préstamo"><ErrorBox message={loan.error} onRetry={loan.reload} /></Screen>;
  return loan.data?.engine === "ledger" ? <LedgerLoanScreen /> : <LoanScreen />;
}

type Action = "pay" | "payoff" | "fees" | "capitalize" | "cancel";

export function LedgerLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanQ = useAsync(() => api.loan(id) as unknown as Promise<Record<string, any>>, [id]);
  useFocusReload(loanQ.reload);
  const [action, setAction] = useState<Action>("pay");
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [custom, setCustom] = useState(false);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [keep, setKeep] = useState(false);
  const [feeMode, setFeeMode] = useState<"fixed" | "percent">("fixed");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeRate, setFeeRate] = useState("");
  const [reason, setReason] = useState("");
  const reload = () => { void loanQ.reload(); };

  const payBody = () => ({
    amount: normalizeMoneyInput(amount)!, accountId: account!, ...(paidOn ? { paidOn } : {}), ...(keep ? { onRemainder: "keep" as const } : {}),
    ...(custom ? { allocations: Object.entries(alloc).map(([chargeId, v]) => ({ chargeId, amount: normalizeMoneyInput(v) })).filter((a): a is { chargeId: string; amount: string } => !!a.amount && a.amount !== "0.00") } : {}),
  });
  const pay = usePreviewFlow({ preview: () => api.previewLoanPayment(id, payBody()), apply: (t, k) => api.payLoan(id, { ...payBody(), previewToken: t }, k) });
  const payoff = usePreviewFlow({ preview: () => api.previewPayoff(id, { accountId: account!, ...(paidOn ? { paidOn } : {}) }), apply: (t, k) => api.payoffLoan(id, { accountId: account!, ...(paidOn ? { paidOn } : {}), previewToken: t }, k) });
  const feeBody = () => ({ mode: feeMode, ...(feeMode === "fixed" ? { amount: normalizeMoneyInput(feeAmount) } : { ratePercent: feeRate.trim() }) });
  const fees = usePreviewFlow({ preview: () => api.previewLateFees(id, feeBody()), apply: (t, k) => api.applyLateFees(id, { ...feeBody(), previewToken: t }, k) });
  const cap = usePreviewFlow({ preview: () => api.previewCapitalize(id), apply: (t, k) => api.capitalizeLoan(id, t, k) });
  const cancel = useSubmit(async (key: string) => api.cancelLoan(id, reason.trim(), key));
  const reverse = useSubmit(async (key: string, pid: string) => api.reverseLoanPayment(pid, "Revertido desde la app", key));
  const flow = { pay, payoff, fees, capitalize: cap }[action as "pay"] as typeof pay | undefined;

  if (loanQ.loading && !loanQ.data) return <Screen title="Préstamo"><Loading /></Screen>;
  if (loanQ.error || !loanQ.data) return <Screen title="Préstamo"><ErrorBox message={loanQ.error ?? "No se encontró el préstamo."} onRetry={loanQ.reload} /></Screen>;
  const l = loanQ.data;
  const charges: LedgerCharge[] = l.charges;
  const open = l.status === "open";
  const invalidateAll = () => { pay.invalidate(); payoff.invalidate(); fees.invalidate(); cap.invalidate(); };
  const after = async (r: unknown) => { if (r) { invalidateAll(); setAmount(""); setAlloc({}); reload(); } };
  const payable = charges.filter((c) => c.status === "active" && c.pending !== "0.00");

  return (
    <Screen title={l.contactName ?? "Préstamo"} subtitle={`${l.direction === "lent" ? "Otorgado" : "Recibido"} · capital ${formatSoles(l.principal)}`}>
      <Card>
        <KV label="Pendiente" value={formatSoles(l.pending)} strong />
        <KV label="Capital pendiente" value={formatSoles(l.totals.principalPending)} /><KV label="Interés pendiente" value={formatSoles(l.totals.interestPending)} /><KV label="Mora pendiente" value={formatSoles(l.totals.feesPending)} />
        <KV label="Costo financiero pagado" value={formatSoles(l.totals.financialCost)} />
        {l.credit !== "0.00" && <KV label="Saldo a favor" value={formatSoles(l.credit)} />}
        {l.nextDue && <KV label="Próximo vencimiento" value={`${humanDate(l.nextDue.dueDate)} · ${formatSoles(l.nextDue.amount)}`} />}
        <View style={{ marginTop: 6 }}><Chip status={l.status === "open" ? "partial" : l.status === "closed" ? "paid" : "converted"} label={l.status === "open" ? "Abierto" : l.status === "closed" ? "Cerrado" : "Anulado"} /></View>
      </Card>

      <Heading>Cargos</Heading>
      {charges.filter((c) => c.status !== "void").map((c) => (
        <Card key={c.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><Txt bold size={14}>{CONCEPT[c.concept]}{c.installmentNo ? ` · cuota ${c.installmentNo}` : c.periodNo ? ` · período ${c.periodNo}` : ""}</Txt><Txt size={12} muted>{c.dueDate ? `Vence ${humanDate(c.dueDate)}` : "Sin fecha"} · {formatSoles(c.amount)}{c.paid !== "0.00" ? ` · pagado ${formatSoles(c.paid)}` : ""}{c.status === "capitalized" ? " · capitalizado" : ""}</Txt></View>
            {c.status === "capitalized" ? <Chip status="converted" label="Capitalizado" /> : c.pending === "0.00" ? <Chip status="paid" /> : c.overdue ? <Chip status="overdue" /> : <Txt bold size={13}>{formatSoles(c.pending)}</Txt>}
          </View>
        </Card>
      ))}

      {open && (
        <>
          <Heading>Acciones</Heading>
          <Choice value={action} onChange={(a) => { setAction(a); invalidateAll(); }} options={[{ id: "pay", label: "Registrar pago" }, { id: "payoff", label: "Pago anticipado" }, { id: "fees", label: "Mora" }, { id: "capitalize", label: "Capitalizar interés" }, { id: "cancel", label: "Anular" }]} />
          {(action === "pay" || action === "payoff") && (
            <Card>
              <AccountPicker label={l.direction === "lent" ? "Entra a la cuenta" : "Sale de la cuenta"} value={account} onChange={(v) => { setAccount(v); invalidateAll(); }} />
              {action === "pay" && <MoneyField label="Importe del pago" value={amount} onChange={(v) => { setAmount(v); invalidateAll(); }} />}
              <DateField label="Fecha del pago" value={paidOn} optional onChange={(v) => { setPaidOn(v); invalidateAll(); }} />
              {action === "pay" && (
                <>
                  <Choice label="¿A qué se aplica?" value={custom ? "custom" : "auto"} onChange={(v) => { setCustom(v === "custom"); invalidateAll(); }} options={[{ id: "auto", label: "Que EVA proponga (lo más antiguo, capital primero)" }, { id: "custom", label: "Elegir yo" }]} />
                  {custom && payable.map((c) => (
                    <MoneyField key={c.id} label={`${CONCEPT[c.concept]}${c.installmentNo ? ` ${c.installmentNo}` : ""} · pendiente ${formatSoles(c.pending)}`} value={alloc[c.id] ?? ""} optional onChange={(v) => { setAlloc((a) => ({ ...a, [c.id]: v })); invalidateAll(); }} />
                  ))}
                  <Choice label="Si sobra dinero" value={keep ? "keep" : "reject"} onChange={(v) => { setKeep(v === "keep"); invalidateAll(); }} options={[{ id: "reject", label: "No permitirlo" }, { id: "keep", label: "Conservarlo como saldo a favor" }]} />
                </>
              )}
            </Card>
          )}
          {action === "fees" && (
            <Card>
              <Choice label="Mora por cada período vencido" value={feeMode} onChange={(v) => { setFeeMode(v); fees.invalidate(); }} options={[{ id: "fixed", label: "Importe fijo" }, { id: "percent", label: "% de lo vencido" }]} />
              {feeMode === "fixed" ? <MoneyField label="Importe" value={feeAmount} onChange={(v) => { setFeeAmount(v); fees.invalidate(); }} /> : <Field label="Porcentaje (ej. 3)" value={feeRate} onChangeText={(v) => { setFeeRate(v); fees.invalidate(); }} keyboardType="decimal-pad" />}
            </Card>
          )}
          {action === "cancel" ? (
            <Card>
              <ReasonField value={reason} onChange={setReason} label="Motivo de la anulación" />
              <Button title="Anular préstamo" variant="danger" busy={cancel.busy} disabled={!reason.trim()} onPress={async () => { if (await cancel.submit()) reload(); }} />
              {cancel.error && <Notice tone="err">{cancel.error}</Notice>}
              <Txt size={12} muted>Solo si no tiene pagos; revierte el desembolso.</Txt>
            </Card>
          ) : flow && (
            <>
              <FlowResult flow={flow} />
              <PreviewFooter flow={flow} disabled={action === "fees" ? !(feeMode === "fixed" ? normalizeMoneyInput(feeAmount) : feeRate.trim()) : (action === "pay" ? !account || !normalizeMoneyInput(amount) : action === "payoff" ? !account : false)}
                previewLabel="Ver cálculo" confirmLabel="Confirmar" onConfirm={async () => after(await flow.confirm())} />
            </>
          )}
        </>
      )}

      <Heading>Pagos</Heading>
      {(l.payments as Array<{ id: string; paidOn: string; amount: string; unapplied: string; kind: string; status: string }>).map((p) => (
        <Card key={p.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt style={{ flex: 1 }} size={13}>{humanDate(p.paidOn)} · {formatSoles(p.amount)}{p.kind === "payoff" ? " · anticipado" : ""}{p.unapplied !== "0.00" ? ` · a favor ${formatSoles(p.unapplied)}` : ""}</Txt>
            {p.status === "active" ? <Button title="Revertir" variant="secondary" busy={reverse.busy} onPress={async () => { if (await reverse.submit(p.id)) reload(); }} /> : <Chip status="converted" label="Revertido" />}
          </View>
        </Card>
      ))}
      {reverse.error && <Notice tone="err">{reverse.error}</Notice>}
    </Screen>
  );
}
