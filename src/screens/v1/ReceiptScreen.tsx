import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, errorMessage, type ReceiptBody } from "../../api/client";
import type { Charge, ReceiptPreview } from "../../api/types";
import { Choice } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, KV, Loading, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { DateInput } from "../../components/v1/DatePicker";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { humanDate, humanRange, isIsoDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput, suggestAllocation } from "../../utils/money";

export default function ReceiptScreen() {
  const { colors } = useAppTheme();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const statement = useAsync(() => api.contactStatement(contactId), [contactId]);
  const accounts = useAsync(() => api.accounts(), []);

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocalIso());
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [noReserve, setNoReserve] = useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const charges = useMemo<Charge[]>(() => (statement.data?.services ?? []).flatMap((s) => s.charges).filter((c) => cmpMoney(c.pending, "0.00") > 0), [statement.data]);
  // Lo que se puede cobrar: cargos de servicios y componentes de préstamos.
  const payables = useMemo(() => [
    ...charges.map((c) => ({ obligationId: c.obligationId, title: `${c.subscriptionName} · ${c.seatLabel}`, sub: `${humanRange(c.cycle.start, c.cycle.end)} · vence ${humanDate(c.dueDate)}`, pending: c.pending, dueDate: c.dueDate, overdue: c.overdue })),
    ...(statement.data?.loans ?? []).flatMap((l) => l.components).filter((c) => cmpMoney(c.pending, "0.00") > 0)
      .map((c) => ({ obligationId: c.obligationId, title: `Préstamo · ${c.concept}`, sub: [c.periodLabel, c.dueDate ? `vence ${humanDate(c.dueDate)}` : null].filter(Boolean).join(" · "), pending: c.pending, dueDate: c.dueDate ?? "9999-12-31", overdue: false })),
  ], [charges, statement.data]);
  const serviceName = (id: string | null) => statement.data?.services.find((s) => s.subscriptionId === id)?.name;
  const activeAccounts = (accounts.data ?? []).filter((a) => a.status === "active");

  // Cuenta por defecto: la marcada como predeterminada o la primera.
  useEffect(() => {
    if (!accountId && activeAccounts.length) setAccountId((activeAccounts.find((a) => a.isDefault) ?? activeAccounts[0]!).id);
  }, [accountId, activeAccounts]);

  const amountNorm = normalizeMoneyInput(amount);
  const body = useMemo<ReceiptBody | null>(() => {
    if (!amountNorm || amountNorm === "0.00" || !accountId || !isIsoDate(date)) return null;
    const allocations = Object.entries(alloc).map(([obligationId, v]) => ({ obligationId, amount: normalizeMoneyInput(v) })).filter((a): a is { obligationId: string; amount: string } => !!a.amount && a.amount !== "0.00");
    return { contactId, accountId, amount: amountNorm, receivedOn: date, ...(note.trim() ? { note: note.trim() } : {}), allocations, ...(noReserve ? { reserveRemainder: null } : {}) };
  }, [amountNorm, accountId, date, alloc, noReserve, contactId, note]);

  const seq = useRef(0);
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!body) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const p = await api.previewReceipt(body);
        if (mine === seq.current) { setPreview(p); setPreviewError(null); }
      } catch (e) {
        if (mine === seq.current) { setPreview(null); setPreviewError(errorMessage(e)); }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [body]);

  const save = useSubmit(async (key: string) => {
    if (!body || !preview?.previewToken) throw new Error("Revisa el reparto antes de confirmar.");
    return api.createReceipt({ ...body, previewToken: preview.previewToken }, key);
  });
  const done = useDone();
  const confirm = async () => { if (await save.submit()) done(`/contact/${contactId}`); };

  const issueFor = (id: string) => preview?.issues.find((i) => "obligationId" in i && i.obligationId === id);
  const canConfirm = !!preview?.valid && !!preview.previewToken;

  const suggest = () => { if (amountNorm) { setAlloc(suggestAllocation(amountNorm, payables.map((c) => ({ id: c.obligationId, pending: c.pending, dueDate: c.dueDate })))); save.resetKey(); } };

  if ((statement.loading && !statement.data) || (accounts.loading && !accounts.data)) return <Screen title="Registrar cobro"><Loading /></Screen>;
  if (statement.error || accounts.error) return <Screen title="Registrar cobro"><ErrorBox message={(statement.error ?? accounts.error)!} onRetry={() => { void statement.reload(); void accounts.reload(); }} /></Screen>;

  return (
    <Screen title="Registrar cobro" footer={<Button title="Confirmar cobro" onPress={confirm} busy={save.busy} disabled={!canConfirm} />}>
      <Card outlined><Txt bold size={17}>{statement.data!.contact.name}</Txt><Txt size={12} muted>Debe {formatSoles(statement.data!.totals.pending)} en {payables.length} concepto{payables.length === 1 ? "" : "s"}</Txt></Card>

      <Card>
        <Field label="Importe recibido (S/)" value={amount} onChangeText={(t) => { setAmount(t); save.resetKey(); }} placeholder="40.00" keyboardType="decimal-pad" error={amount && !amountNorm ? "Importe inválido" : undefined} />
        {activeAccounts.length > 0 ? (
          <Choice label="Entró a" value={accountId} onChange={(id) => { setAccountId(id); save.resetKey(); }} options={activeAccounts.map((a) => ({ id: a.id, label: a.name }))} />
        ) : (
          <Notice tone="warn">Primero crea una cuenta desde Dinero.</Notice>
        )}
        <DateInput label="Fecha" value={date} onChange={(t) => { setDate(t); save.resetKey(); }} />
        <Field label="Nota (opcional)" value={note} onChangeText={(t) => { setNote(t); save.resetKey(); }} autoCapitalize="sentences" maxLength={200} />
      </Card>

      <Heading
        action={
          <TouchableOpacity onPress={suggest} disabled={!amountNorm} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} style={{ minHeight: 32, justifyContent: "center" }}>
            <Text style={{ color: amountNorm ? colors.primary : colors.muted, fontSize: 13, fontFamily: "AsapBold" }}>Sugerir por vencimiento</Text>
          </TouchableOpacity>
        }
      >
        Aplicar a
      </Heading>
      {payables.length === 0 ? <Card><Txt muted>No hay cargos pendientes: el importe quedará como crédito (anticipo).</Txt></Card> : payables.map((c) => {
        const issue = issueFor(c.obligationId);
        return (
          <Card key={c.obligationId} outlined style={issue ? { borderColor: colors.expenseStrong } : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt bold size={14}>{c.title}</Txt>
                {c.sub ? <Txt size={12} muted>{c.sub}</Txt> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>{c.overdue && <Chip status="overdue" />}<Txt size={12} muted>Pendiente {formatSoles(c.pending)}</Txt></View>
              </View>
              <TextInput value={alloc[c.obligationId] ?? ""} onChangeText={(t) => { setAlloc((a) => ({ ...a, [c.obligationId]: t })); save.resetKey(); }} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" accessibilityLabel={`Importe a aplicar a ${c.title}`}
                style={{ width: 98, minHeight: 42, textAlign: "right", color: colors.text, fontFamily: "AsapBold", fontSize: 15, fontVariant: ["tabular-nums"], borderWidth: 1, borderColor: issue ? colors.expenseStrong : colors.borderStrong, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.elevated }} />
            </View>
            {issue && "pending" in issue && <Txt size={12} color={colors.expenseStrong}>No puedes aplicar más que lo pendiente ({formatSoles(issue.pending)}).</Txt>}
          </Card>
        );
      })}

      {previewError && <Notice tone="err">{previewError}</Notice>}
      {preview && (
        <>
          {preview.issues.some((i) => i.code === "EXCEEDS_RECEIPT") && <Notice tone="err">La suma aplicada supera el importe recibido.</Notice>}
          <Card>
            <KV label="Aplicado" value={formatSoles(preview.summary.applied)} strong />
            <KV label="Sobrante" value={formatSoles(preview.summary.remainder)} strong />
            <KV label="Saldo de la cuenta después" value={formatSoles(preview.account.balanceAfter)} />
            {cmpMoney(preview.summary.remainder, "0.00") > 0 && (
              preview.summary.reservedTo || noReserve ? (
                <SwitchRow
                  label={preview.summary.reservedTo ? `Reservar el sobrante para el próximo cargo${serviceName(preview.summary.reservedTo) ? ` de ${serviceName(preview.summary.reservedTo)}` : ""}` : "Dejar el sobrante como crédito libre"}
                  value={!!preview.summary.reservedTo && !noReserve}
                  onValueChange={(v) => { setNoReserve(!v); save.resetKey(); }}
                  accessibilityLabel="Reservar el sobrante"
                />
              ) : (
                <Txt size={12} muted>El sobrante quedará como crédito libre (no se reserva automáticamente a un solo servicio).</Txt>
              )
            )}
          </Card>
          <Notice tone="info">Se registra un solo ingreso de {formatSoles(preview.summary.received)} en la cuenta. El reparto no crea ingresos adicionales.</Notice>
        </>
      )}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}
