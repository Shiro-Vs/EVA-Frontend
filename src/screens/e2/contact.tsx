import React, { useMemo, useState } from "react";
import { Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Charge, Refund } from "../../api/types";
import { AccountPicker, Choice, DateField, FlowResult, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, humanRange, isIsoDate } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";

/** Convertir deuda de servicio en un préstamo con detalle (la deuda total no cambia). */
export function ContactConvertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const st = useAsync(() => api.contactStatement(id), [id]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const charges = useMemo<Charge[]>(() => (st.data?.services ?? []).flatMap((s) => s.charges).filter((c) => cmpMoney(c.pending, "0.00") > 0), [st.data]);
  const ids = charges.filter((c) => picked[c.obligationId]).map((c) => c.obligationId);
  const flow = usePreviewFlow({
    preview: () => api.previewDebtConversion(id, ids),
    apply: (token, key) => api.convertDebt(id, { obligationIds: ids, reason: reason.trim(), previewToken: token }, key),
  });

  if (st.loading && !st.data) return <Screen title="Convertir en préstamo"><Loading /></Screen>;
  if (st.error || !st.data) return <Screen title="Convertir en préstamo"><ErrorBox message={st.error ?? "No se encontró el contacto."} onRetry={st.reload} /></Screen>;
  return (
    <Screen title="Convertir en préstamo" subtitle={st.data.contact.name}
      footer={<PreviewFooter flow={flow} disabled={ids.length === 0 || reason.trim().length === 0} confirmLabel="Convertir en préstamo"
        confirmDisabled={reason.trim().length === 0} onConfirm={async () => { const r = await flow.confirm(); if (r) router.replace(`/loan/${(r as { id: string }).id}` as never); }} />}>
      <Heading>Qué deuda pasa al préstamo</Heading>
      {charges.length === 0 ? <Card><Txt muted>No hay deuda pendiente de servicios para convertir.</Txt></Card> : charges.map((c) => (
        <Card key={c.obligationId} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Switch value={!!picked[c.obligationId]} onValueChange={(v) => { setPicked((p) => ({ ...p, [c.obligationId]: v })); flow.invalidate(); }} accessibilityLabel={`Incluir ${c.subscriptionName} ${c.seatLabel}`} />
            <View style={{ flex: 1 }}>
              <Txt bold size={14}>{c.subscriptionName} · {c.seatLabel}</Txt>
              <Txt size={12} muted>{humanRange(c.cycle.start, c.cycle.end)} · vence {humanDate(c.dueDate)}</Txt>
            </View>
            <Money value={c.pending} size={14} />
          </View>
        </Card>
      ))}
      <Card><ReasonField value={reason} onChange={(v) => { setReason(v); flow.invalidate(); }} /></Card>
      <Notice tone="info">La persona sigue debiendo lo mismo: la deuda deja de ser del servicio y pasa a un préstamo con su detalle. No se registra ningún ingreso ni egreso.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}

/** Cobros del contacto: de aquí se llega a corregirlos o revertirlos. */
export function ContactReceiptsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const list = useAsync(() => api.contactReceipts(id), [id]);
  useFocusReload(list.reload);
  return (
    <Screen title="Cobros" right={undefined}>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? (
        <Empty icon="cash-outline" title="Sin cobros" text="Aquí verás cada cobro registrado a esta persona." />
      ) : (list.data ?? []).map((r) => (
        <RowLink key={r.id} onPress={() => router.push(`/receipt/${r.id}` as never)}>
          <View style={{ flex: 1 }}>
            <Txt bold>{formatSoles(r.amount)} · {humanDate(r.receivedOn)}</Txt>
            <Txt size={12} muted>{r.note ?? "Sin nota"}{r.free && cmpMoney(r.free, "0.00") > 0 ? ` · crédito libre ${formatSoles(r.free)}` : ""}</Txt>
          </View>
          <Chip status={r.status === "active" ? "paid" : "converted"} label={r.status === "active" ? "Vigente" : "Revertido"} />
        </RowLink>
      ))}
    </Screen>
  );
}

export function LoansScreen() {
  const { contactId } = useLocalSearchParams<{ contactId?: string }>();
  const router = useRouter();
  const loans = useAsync(() => api.loans(contactId), [contactId]);
  useFocusReload(loans.reload);
  return (
    <Screen title="Préstamos" footer={<Button title="Nuevo préstamo" icon="add" onPress={() => router.push("/loans/new" as never)} />}>
      {loans.loading && !loans.data ? <Loading /> : loans.error ? <ErrorBox message={loans.error} onRetry={loans.reload} /> : (loans.data ?? []).length === 0 ? (
        <Empty icon="swap-horizontal-outline" title="Sin préstamos" text="Registra uno nuevo, o conviértelo desde una deuda de servicio (por ejemplo, al dar de baja a alguien que debe)." />
      ) : (loans.data ?? []).map((l) => (
        <RowLink key={l.id} onPress={() => router.push(`/loan/${l.id}` as never)}>
          <View style={{ flex: 1 }}>
            <Txt bold>{l.contactName}</Txt>
            <Txt size={12} muted>Desde {humanDate(l.openedOn)} · capital {formatSoles(l.principal)}</Txt>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}><Chip status={l.status === "open" ? "partial" : "paid"} label={l.status === "open" ? "Abierto" : "Cerrado"} /><Txt bold size={13}>{formatSoles(l.pending)}</Txt></View>
        </RowLink>
      ))}
    </Screen>
  );
}

export function LoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const loan = useAsync(() => api.loan(id), [id]);
  useFocusReload(loan.reload);
  if (loan.loading && !loan.data) return <Screen title="Préstamo"><Loading /></Screen>;
  if (loan.error || !loan.data) return <Screen title="Préstamo"><ErrorBox message={loan.error ?? "No se encontró el préstamo."} onRetry={loan.reload} /></Screen>;
  const l = loan.data;
  return (
    <Screen title={l.contactName} subtitle="Préstamo">
      <Card>
        <KV label="Capital" value={formatSoles(l.principal)} strong />
        <KV label="Pendiente" value={formatSoles(l.pending)} strong />
        <KV label="Abierto el" value={humanDate(l.openedOn)} />
        {l.conversion && <KV label="Origen" value={`${l.conversion.trigger === "exit" ? "Baja" : l.conversion.trigger === "individual_switch" ? "Cambio a individual" : l.conversion.trigger === "courtesy_choice" ? "Cortesía" : "Manual"}: ${l.conversion.reason}`} />}
        <View style={{ marginTop: 6 }}><Chip status={l.status === "open" ? "partial" : "paid"} label={l.status === "open" ? "Abierto" : "Cerrado"} /></View>
      </Card>
      {l.status === "open" && <Button title="Registrar cobro del préstamo" icon="cash-outline" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId: l.contactId } })} />}
      <Heading>Componentes</Heading>
      {l.components.map((c) => (
        <Card key={c.obligationId} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt bold size={14}>{c.concept}</Txt>
              <Txt size={12} muted>{c.periodLabel ?? ""}{c.dueDate ? ` · vence ${humanDate(c.dueDate)}` : ""}</Txt>
              <Txt size={12} muted>Monto {formatSoles(c.amount)}</Txt>
            </View>
            {cmpMoney(c.pending, "0.00") > 0 ? <Money value={c.pending} size={14} /> : <Chip status="paid" />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function RefundCard({ r, onChanged }: { r: Refund; onChanged: () => void }) {
  const [mode, setMode] = useState<"pay" | "cancel" | "reverse" | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const pay = useSubmit(async (key: string) => api.payRefund(r.id, { accountId: accountId!, ...(paidOn ? { paidOn } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, key));
  const cancel = useSubmit(async (key: string) => api.cancelRefund(r.id, reason.trim(), key));
  const reverse = useSubmit(async (key: string) => api.reverseRefund(r.id, reason.trim(), key));
  const STATUS = { planned: "Programada", paid: "Pagada", cancelled: "Cancelada" } as const;
  return (
    <Card outlined>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt bold size={14}>{r.contact.name}</Txt>
          <Txt size={12} muted>{r.reason}</Txt>
          <Txt size={12} muted>{r.plannedOn ? `Programada el ${humanDate(r.plannedOn)}` : ""}</Txt>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}><Chip status={r.status === "planned" ? "partial" : r.status === "paid" ? "paid" : "converted"} label={STATUS[r.status]} /><Money value={r.amount} size={15} /></View>
      </View>
      {r.status === "planned" && !mode && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}><Button title="Pagar" icon="cash-outline" onPress={() => setMode("pay")} /></View>
          <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setMode("cancel")} /></View>
        </View>
      )}
      {r.status === "paid" && !mode && (
        <View style={{ marginTop: 10 }}>
          <Button title="Revertir devolución" variant="outlineDanger" size="small" icon="return-up-back-outline" onPress={() => { setReason(""); setMode("reverse"); }} />
        </View>
      )}
      {mode === "pay" && (
        <View style={{ marginTop: 10 }}>
          <AccountPicker label="Sale de la cuenta" value={accountId} onChange={(v) => { setAccountId(v); pay.resetKey(); }} />
          <DateField label="Fecha de la salida" value={paidOn} optional onChange={(v) => { setPaidOn(v); pay.resetKey(); }} />
          <Field label="Nota (opcional)" value={note} onChangeText={(v) => { setNote(v); pay.resetKey(); }} autoCapitalize="sentences" />
          <Notice tone="info">Registra la salida real del dinero: se crea un egreso en la cuenta elegida.</Notice>
          <View style={{ height: 8 }} />
          <Button title="Registrar salida" busy={pay.busy} disabled={!accountId || (paidOn !== "" && !isIsoDate(paidOn))} onPress={async () => { if (await pay.submit()) onChanged(); }} />
          <View style={{ height: 8 }} /><Button title="Volver" variant="secondary" onPress={() => setMode(null)} />
          {pay.error && <Notice tone="err">{pay.error}</Notice>}
        </View>
      )}
      {mode === "cancel" && (
        <View style={{ marginTop: 10 }}>
          <ReasonField value={reason} onChange={(v) => { setReason(v); cancel.resetKey(); }} label="Motivo de la cancelación" />
          <Notice tone="info">El dinero vuelve a contar como crédito libre de la persona.</Notice>
          <View style={{ height: 8 }} />
          <Button title="Cancelar devolución" variant="danger" busy={cancel.busy} disabled={reason.trim().length === 0} onPress={async () => { if (await cancel.submit()) onChanged(); }} />
          <View style={{ height: 8 }} /><Button title="Volver" variant="secondary" onPress={() => setMode(null)} />
          {cancel.error && <Notice tone="err">{cancel.error}</Notice>}
        </View>
      )}
      {mode === "reverse" && (
        <View style={{ marginTop: 10 }}>
          <ReasonField value={reason} onChange={(v) => { setReason(v); reverse.resetKey(); }} label="Motivo de la reversión" />
          <Notice tone="warn">Se revierte la salida en tu cuenta y el dinero vuelve al crédito libre de la persona.</Notice>
          <View style={{ height: 8 }} />
          <Button title="Confirmar reversión" variant="danger" busy={reverse.busy} disabled={reason.trim().length === 0} onPress={async () => { if (await reverse.submit()) onChanged(); }} />
          <View style={{ height: 8 }} /><Button title="Volver" variant="secondary" onPress={() => setMode(null)} />
          {reverse.error && <Notice tone="err">{reverse.error}</Notice>}
        </View>
      )}
    </Card>
  );
}

export function RefundsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"planned" | "paid" | "cancelled" | "all">("planned");
  const list = useAsync(() => api.refunds(status === "all" ? undefined : status), [status]);
  useFocusReload(list.reload);
  return (
    <Screen title="Devoluciones" right={undefined} footer={<Button title="Nueva devolución de crédito libre" variant="secondary" icon="add" onPress={() => router.push("/refunds/new" as never)} />}>
      <Choice value={status} onChange={setStatus} options={[{ id: "planned", label: "Programadas" }, { id: "paid", label: "Pagadas" }, { id: "cancelled", label: "Canceladas" }, { id: "all", label: "Todas" }]} />
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? (
        <Empty icon="return-down-back-outline" title="Sin devoluciones" text="Se programan al dar de baja a alguien con ciclos futuros pagados, o a mano con crédito libre." />
      ) : (list.data ?? []).map((r) => <RefundCard key={r.id} r={r} onChanged={list.reload} />)}
    </Screen>
  );
}

/** Devolución manual: de un cobro con crédito libre. */
export function RefundNewScreen() {
  const params = useLocalSearchParams<{ contactId?: string }>();
  const done = useDone();
  const contacts = useAsync(() => api.contacts(), []);
  const [contactId, setContactId] = useState<string | null>(params.contactId ?? null);
  const receipts = useAsync(() => (contactId ? api.contactReceipts(contactId) : Promise.resolve([])), [contactId]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const free = (receipts.data ?? []).filter((r) => r.status === "active" && r.free && cmpMoney(r.free, "0.00") > 0);
  const create = useSubmit(async (key: string) => api.createRefund({ receiptId: receiptId!, amount: normalizeMoneyInput(amount)!, reason: reason.trim() }, key));
  const ready = !!receiptId && !!normalizeMoneyInput(amount) && reason.trim().length > 0;
  return (
    <Screen title="Nueva devolución" footer={<Button title="Programar devolución" busy={create.busy} disabled={!ready} onPress={async () => { if (await create.submit()) done("/refunds"); }} />}>
      <Card>
        {contacts.loading && !contacts.data ? <Loading /> : (
          <Choice select label="Persona" value={contactId} onChange={(v) => { setContactId(v); setReceiptId(null); create.resetKey(); }}
            options={(contacts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name, hint: cmpMoney(c.totals.creditFree, "0.00") > 0 ? `libre ${formatSoles(c.totals.creditFree)}` : undefined }))} />
        )}
        {contactId && (receipts.loading ? <Loading /> : free.length === 0 ? <Notice tone="warn">Esta persona no tiene crédito libre para devolver.</Notice> : (
          <Choice select label="De qué cobro" value={receiptId} onChange={(v) => { setReceiptId(v); create.resetKey(); }}
            options={free.map((r) => ({ id: r.id, label: `${humanDate(r.receivedOn)} · ${formatSoles(r.amount)}`, hint: `libre ${formatSoles(r.free!)}` }))} />
        ))}
        <MoneyField label="Importe a devolver" value={amount} onChange={(v) => { setAmount(v); create.resetKey(); }} />
        <ReasonField value={reason} onChange={(v) => { setReason(v); create.resetKey(); }} />
      </Card>
      <Notice tone="info">Solo se programa: el dinero sale cuando registres la salida desde Devoluciones.</Notice>
      {create.error && <Notice tone="err">{create.error}</Notice>}
    </Screen>
  );
}
