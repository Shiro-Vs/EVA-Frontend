import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Account } from "../../api/types";
import { ApiError } from "../../api/http";
import { AccountPicker, CategoryPicker, Choice, DateField, FlowResult, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, KV, Loading, Money, Notice, Screen, Txt, SwitchRow } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, humanRange, isIsoDate } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";
import {
  InlineCardPay,
  InlineContactReceipt,
  InlineLoanExpense,
  InlineLoanIncome,
  InlineServicePay,
  type ExpenseSubtype,
  type IncomeSubtype,
} from "./InlineQuickForms";

const KIND_TEXT: Record<string, string> = { income: "Ingreso", expense: "Gasto", transfer: "Transferencia", opening: "Saldo inicial", adjustment: "Ajuste", reversal: "Reversión" };
const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  income: "arrow-down-circle-outline",
  expense: "arrow-up-circle-outline",
  transfer: "swap-horizontal-outline",
  opening: "flag-outline",
  adjustment: "construct-outline",
  reversal: "refresh-outline",
};
const LEGACY_REV_RE = /^Reversión de [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanOpDesc = (desc: string) => (LEGACY_REV_RE.test(desc.trim()) ? "Reversión de movimiento" : desc);

const accountName = (accounts: Account[] | null, id: string, fallback?: string, deleted?: boolean) => {
  const base = fallback || accounts?.find((a) => a.id === id)?.name || "Cuenta";
  return deleted ? `${base} (Cuenta eliminada)` : base;
};

// ───────────────────────── Operaciones ─────────────────────────

/** Movimiento: vista detallada en modo lectura con botón para editar, corregir importe/cuenta/fecha, revertir y vínculo al origen. */
export function OperationScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const op = useAsync(() => api.operation(id), [id]);
  const accounts = useAsync(() => api.accounts(), []);
  const contacts = useAsync(() => api.contacts(), []);
  useFocusReload(op.reload);
  const [description, setDescription] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined);
  const [contactId, setContactId] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<"edit" | "reverse" | null>(null);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([op.reload(), accounts.reload(), contacts.reload()]); } finally { setRefreshing(false); }
  };
  const save = useSubmit(async () => {
    const o = op.data!;
    return api.patchOperation(id, {
      ...(description !== null && description.trim() !== o.description ? { description: description.trim() } : {}),
      ...(categoryId !== undefined && categoryId !== (o.category?.id ?? null) ? { categoryId } : {}),
      ...(contactId !== undefined && contactId !== (o.contactId ?? null) ? { contactId } : {}),
    }, o.version);
  });
  const reverse = useSubmit(async (key: string) => api.reverseOperation(id, { reason: reason.trim(), ...(date ? { date } : {}) }, key));

  if (op.loading && !op.data) return <Screen title="Movimiento"><Loading /></Screen>;
  if (op.error || !op.data) return <Screen title="Movimiento"><ErrorBox message={op.error ?? "No se encontró el movimiento."} onRetry={op.reload} /></Screen>;
  const o = op.data;
  const editable = o.status === "confirmed" && o.kind !== "reversal";
  const linked = !!(
    o.links.receiptId
    || o.links.supplierPaymentId
    || o.links.refundId
    || o.links.bankLoanPaymentId
    || o.links.loanPaymentId
    || o.links.loanDisbursementId
    || o.links.cardStatementPaymentId
    || o.links.installmentPlanId
  );
  const correctable = editable && !linked && ["income", "expense", "transfer"].includes(o.kind);
  const canCategorize = editable && ["income", "expense"].includes(o.kind);
  const curCat = categoryId === undefined ? (o.category?.id ?? null) : categoryId;
  const curContact = contactId === undefined ? (o.contactId ?? null) : contactId;
  const metaDirty = (description !== null && description.trim() !== o.description)
    || (categoryId !== undefined && categoryId !== (o.category?.id ?? null))
    || (contactId !== undefined && contactId !== (o.contactId ?? null));
  const activeContacts = (contacts.data ?? []).filter((c) => c.status === "active");
  const contactOpts = [{ id: "__none__", label: "Ninguno" }, ...activeContacts.map((c) => ({ id: c.id, label: c.name }))];
  const contactLabel = o.contactId ? (contacts.data ?? []).find((c) => c.id === o.contactId)?.name ?? null : null;

  const isTransfer = o.kind === "transfer";
  const fromEntry = isTransfer ? o.entries.find((e) => e.amount.startsWith("-")) ?? o.entries[0] : o.entries[0];
  const toEntry = isTransfer ? o.entries.find((e) => !e.amount.startsWith("-")) ?? o.entries[1] : undefined;
  const displayAmount = isTransfer
    ? (toEntry?.amount ?? fromEntry?.amount.replace("-", "") ?? "0.00")
    : (fromEntry?.amount ?? "0.00");
  const amtNum = cmpMoney(displayAmount, "0.00");
  const heroTone = isTransfer
    ? colors.primary
    : o.kind === "income" || (o.kind !== "expense" && amtNum > 0)
      ? colors.incomeStrong
      : o.kind === "expense" || amtNum < 0
        ? colors.expenseStrong
        : colors.text;
  const heroIconColor = isTransfer ? colors.primary : o.kind === "income" ? colors.incomeStrong : o.kind === "expense" ? colors.expenseStrong : colors.textSecondary;
  const prettyDesc = o.description?.trim() ? cleanOpDesc(o.description) : "";
  const anyDeletedAccount = o.entries.some((e) => e.accountDeleted);

  const openEdit = () => {
    setDescription(null);
    setCategoryId(undefined);
    setContactId(undefined);
    save.resetKey();
    setMode("edit");
  };
  const closeEdit = () => {
    setDescription(null);
    setCategoryId(undefined);
    setContactId(undefined);
    setMode(null);
  };

  return (
    <Screen
      title="Detalle del movimiento"
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={editable && mode !== "edit" ? <Button title="Editar" icon="create-outline" variant="secondary" size="compact" onPress={openEdit} /> : undefined}
    >
      {/* Cabecera tipo comprobante */}
      <Card style={{ alignItems: "center", paddingVertical: 20, gap: 6, opacity: o.status === "reversed" ? 0.72 : 1 }}>
        <Ionicons name={KIND_ICON[o.kind] ?? "receipt-outline"} size={30} color={heroIconColor} />
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1 }}>
          {KIND_TEXT[o.kind] ?? o.kind}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: heroTone, fontSize: 32, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}
        >
          {isTransfer ? formatSoles(displayAmount) : `${amtNum > 0 ? "+" : ""}${formatSoles(displayAmount)}`}
        </Text>
        {prettyDesc ? (
          <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapSemiBold", textAlign: "center", marginTop: 2 }}>
            {prettyDesc}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Chip status={o.status === "confirmed" ? "paid" : "converted"} label={o.status === "confirmed" ? "Confirmado" : "Revertido"} />
          <Txt size={12} muted>
            {humanDate(o.occurredOn)}{o.occurredTime ? ` · ${o.occurredTime}` : ""}
          </Txt>
        </View>
      </Card>

      {/* Información detallada en solo lectura */}
      <Card>
        <Txt bold size={13} style={{ marginBottom: 4 }}>Información</Txt>
        <KV label="Tipo" value={KIND_TEXT[o.kind] ?? o.kind} />
        <KV label="Fecha" value={`${humanDate(o.occurredOn)}${o.occurredTime ? ` · ${o.occurredTime}` : ""}`} />
        {isTransfer && fromEntry && toEntry ? (
          <>
            <KV label="Sale de" value={accountName(accounts.data, fromEntry.accountId, fromEntry.accountName, fromEntry.accountDeleted)} strong />
            <KV label="Llega a" value={accountName(accounts.data, toEntry.accountId, toEntry.accountName, toEntry.accountDeleted)} strong />
          </>
        ) : (
          o.entries.map((e, i) => (
            <KV key={i} label={o.entries.length > 1 ? `Cuenta ${i + 1}` : "Cuenta"} value={accountName(accounts.data, e.accountId, e.accountName, e.accountDeleted)} strong />
          ))
        )}
        <KV label="Descripción" value={prettyDesc || "Sin descripción"} />
        {["income", "expense"].includes(o.kind) || o.category ? (
          <KV label="Categoría" value={o.category?.name ?? "Sin categoría"} />
        ) : null}
        {contactLabel ? <KV label="Persona" value={contactLabel} /> : null}
        {o.reason ? <KV label="Motivo" value={o.reason} /> : null}
      </Card>

      {anyDeletedAccount && (
        <Notice tone="info">La cuenta asociada a este movimiento fue eliminada. El movimiento se conserva en tu historial.</Notice>
      )}

      {o.reversalOfId && (
        <Button title="Ver movimiento original" variant="secondary" icon="return-up-back-outline" onPress={() => router.push(`/operation/${o.reversalOfId}` as never)} />
      )}

      {/* Edición (solo al pulsar Editar) */}
      {mode === "edit" && editable && (
        <Card>
          <Txt bold size={14} style={{ marginBottom: 4 }}>Editar detalles</Txt>
          <Field label="Descripción" value={description ?? o.description} onChangeText={(v) => { setDescription(v); save.resetKey(); }} autoCapitalize="sentences" maxLength={200} />
          {canCategorize && <CategoryPicker value={curCat} onChange={(v) => { setCategoryId(v); save.resetKey(); }} />}
          {contactOpts.length > 1 && (
            <Choice select label="Contacto (opcional)" value={curContact ?? "__none__"}
              onChange={(v) => { setContactId(v === "__none__" ? null : v); save.resetKey(); }}
              options={contactOpts} />
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="secondary" disabled={save.busy} onPress={closeEdit} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Guardar" busy={save.busy} disabled={!metaDirty}
                onPress={async () => { if (await save.submit()) { closeEdit(); void op.reload(); } }} />
            </View>
          </View>
          {save.error && <Notice tone="err">{save.error}</Notice>}
        </Card>
      )}

      {/* Reversión (solo al pulsar Revertir) */}
      {mode === "reverse" && (
        <Card>
          <Txt bold size={14} style={{ marginBottom: 4 }}>Revertir movimiento</Txt>
          <ReasonField value={reason} onChange={(v) => { setReason(v); reverse.resetKey(); }} label="Motivo de la reversión" />
          <DateField label="Fecha de la reversión" value={date} optional onChange={(v) => { setDate(v); reverse.resetKey(); }} />
          <Notice tone="info">Se crea la operación contraria; la original queda marcada como revertida y no se borra. Revertir no es devolver dinero.</Notice>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="secondary" disabled={reverse.busy} onPress={() => setMode(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Confirmar" variant="danger" busy={reverse.busy} disabled={reason.trim().length === 0 || (date !== "" && !isIsoDate(date))}
                onPress={async () => { if (await reverse.submit()) { setMode(null); void op.reload(); } }} />
            </View>
          </View>
          {reverse.error && <Notice tone="err">{reverse.error}</Notice>}
        </Card>
      )}

      {/* Opciones y vínculos */}
      <View style={{ gap: 10 }}>
        {o.links.receiptId && <Button title="Ver el cobro de este movimiento" icon="cash-outline" onPress={() => router.push(`/receipt/${o.links.receiptId}` as never)} />}
        {o.links.supplierPaymentId && <Notice tone="info">Es el pago de un servicio al proveedor: se revierte desde el detalle del ciclo del servicio.</Notice>}
        {o.links.refundId && <Notice tone="info">Es la salida de una devolución: se gestiona desde Devoluciones.</Notice>}
        {o.links.bankLoanPaymentId && <Notice tone="info">Es el pago de un préstamo bancario: se revierte desde el detalle de ese préstamo.</Notice>}
        {o.links.loanPaymentId && <Notice tone="info">Es el pago de un préstamo: se revierte desde el detalle del préstamo.</Notice>}
        {o.links.loanDisbursementId && <Notice tone="info">Es el desembolso de un préstamo: se anula desde el detalle del préstamo.</Notice>}
        {o.links.cardStatementPaymentId && <Notice tone="info">Está vinculado a un estado de cuenta de tarjeta: quita primero el vínculo en la tarjeta.</Notice>}
        {o.links.installmentPlanId && <Notice tone="info">Es una compra en cuotas con tarjeta: cancela el plan de cuotas antes de revertir o corregir.</Notice>}
        {editable && mode !== "edit" && (
          <Button title="Editar descripción, categoría o persona" variant="secondary" icon="create-outline" onPress={openEdit} />
        )}
        {correctable && (
          <Button title="Corregir importe, cuenta o fecha" variant="secondary" icon="swap-horizontal-outline" onPress={() => router.push(`/operation/${id}/correct` as never)} />
        )}
        {editable && !linked && mode !== "reverse" && (
          <Button title="Revertir movimiento" variant="outlineDanger" icon="arrow-undo-outline" onPress={() => setMode("reverse")} />
        )}
      </View>
    </Screen>
  );
}

/** Corregir una operación: importe, cuenta(s) y fecha; revierte la original y registra la corregida. */
export function OperationCorrectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const done = useDone();
  const op = useAsync(() => api.operation(id), [id]);
  const [amount, setAmount] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const o = op.data;
  const transfer = o?.kind === "transfer";
  const oldAmount = useMemo(() => (o ? o.entries.map((e) => e.amount.replace("-", "")).sort()[o.entries.length - 1] : ""), [o]);
  const oldFrom = o ? (transfer ? o.entries.find((e) => e.amount.startsWith("-"))?.accountId : o.entries[0]?.accountId) : undefined;
  const oldTo = transfer ? o?.entries.find((e) => !e.amount.startsWith("-"))?.accountId : undefined;

  const body = () => ({
    ...(amount !== null && normalizeMoneyInput(amount) && normalizeMoneyInput(amount) !== oldAmount ? { amount: normalizeMoneyInput(amount)! } : {}),
    ...(from && from !== oldFrom ? { accountId: from } : {}),
    ...(transfer && to && to !== oldTo ? { toAccountId: to } : {}),
    ...(date !== null && date !== o?.occurredOn ? { date } : {}),
  });
  const flow = usePreviewFlow({
    preview: () => api.previewOperationCorrection(id, body()),
    apply: (token, key) => api.correctOperation(id, { ...body(), reason: reason.trim(), previewToken: token }, key),
  });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  useEffect(() => { if (o && from === null && oldFrom) setFrom(oldFrom); if (o && transfer && to === null && oldTo) setTo(oldTo); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [o]);

  if (op.loading && !op.data) return <Screen title="Corregir movimiento"><Loading /></Screen>;
  if (op.error || !o) return <Screen title="Corregir movimiento"><ErrorBox message={op.error ?? "No se encontró el movimiento."} onRetry={op.reload} /></Screen>;
  return (
    <Screen title="Corregir movimiento" subtitle={`${KIND_TEXT[o.kind] ?? o.kind} de ${formatSoles(oldAmount)} · ${humanDate(o.occurredOn)}`}
      footer={<PreviewFooter flow={flow} disabled={Object.keys(body()).length === 0 || reason.trim().length === 0} confirmDisabled={reason.trim().length === 0} confirmLabel="Aplicar corrección" onConfirm={async () => { const res = await flow.confirm(); if (res) { if (router.canDismiss()) router.dismissAll(); router.replace("/money" as never); } }} />}>
      <Card>
        <MoneyField label="Importe" value={amount ?? oldAmount} onChange={touch(setAmount)} />
        <AccountPicker label={transfer ? "Cuenta de origen" : "Cuenta"} value={from} onChange={touch(setFrom)} />
        {transfer && <AccountPicker label="Cuenta de destino" value={to} onChange={touch(setTo)} exclude={from} />}
        <DateField label="Fecha" value={date ?? o.occurredOn} onChange={touch(setDate)} />
        <ReasonField value={reason} onChange={(v) => { setReason(v); flow.invalidate(); }} label="Motivo de la corrección" />
      </Card>
      <Notice tone="info">Se revierte el movimiento original y se registra uno nuevo con estos datos, en una sola operación. No se registra ninguna devolución de dinero.</Notice>
      <FlowResult flow={flow} hide={["willCreate", "note"]} />
    </Screen>
  );
}

/** Nuevo ingreso, gasto o transferencia manual. */
export function OperationNewScreen() {
  const { colors } = useAppTheme();
  const done = useDone();
  const params = useLocalSearchParams<{ kind?: string; accountId?: string; toAccountId?: string }>();
  const initialKind: "income" | "expense" | "transfer" =
    params.kind === "income" || params.kind === "transfer" ? params.kind : "expense";
  const contacts = useAsync(() => api.contacts(), []);
  const [kind, setKind] = useState<"income" | "expense" | "transfer">(initialKind);
  const [expenseSub, setExpenseSub] = useState<ExpenseSubtype>("normal");
  const [incomeSub, setIncomeSub] = useState<IncomeSubtype>("normal");
  const [from, setFrom] = useState<string | null>(params.accountId ?? null);
  const [to, setTo] = useState<string | null>(params.toAccountId ?? null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [suggestedCat, setSuggestedCat] = useState<{ categoryId: string; categoryName: string; ruleName: string } | null>(null);
  const suggestSeq = useRef(0);
  const [conflict, setConflict] = useState<{ eaten: string; goals: Array<{ goalId: string; name: string; reserved: string }> } | null>(null);
  const [deduct, setDeduct] = useState<Record<string, string>>({});
  const [shortfall, setShortfall] = useState(false);
  const [impactId, setImpactId] = useState("");
  const [impact, setImpact] = useState<Array<Record<string, any>> | null>(null);
  const normAmount = normalizeMoneyInput(amount);

  // Sugerencia automática de categoría según tus reglas activas (sin cambiar tu elección manual).
  useEffect(() => {
    setSuggestedCat(null);
    if (kind === "transfer" || !from || categoryId) return;
    if (!description.trim() && (!normAmount || cmpMoney(normAmount, "0.00") <= 0)) return;
    const mine = ++suggestSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.suggestCategory({
          accountId: from,
          direction: kind,
          amount: normAmount && cmpMoney(normAmount, "0.00") > 0 ? normAmount : "1.00",
          ...(description.trim() ? { text: description.trim() } : {}),
        });
        const applied = res?.applied as { categoryId?: string; categoryName?: string; ruleName?: string } | null | undefined;
        if (mine === suggestSeq.current && applied?.categoryId && applied.categoryName) {
          setSuggestedCat({ categoryId: applied.categoryId, categoryName: applied.categoryName, ruleName: applied.ruleName ?? "Regla" });
        }
      } catch {
        // Silencioso: es solo una ayuda opcional.
      }
    }, 450);
    return () => clearTimeout(t);
  }, [kind, from, normAmount, description, categoryId]);

  const create = useSubmit(async (key: string) => {
    const deductions = Object.entries(deduct).map(([goalId, v]) => ({ goalId, amount: normalizeMoneyInput(v) })).filter((d): d is { goalId: string; amount: string } => !!d.amount && d.amount !== "0.00");
    try {
      return await api.createOperation({
        kind, accountId: from!, ...(kind === "transfer" ? { toAccountId: to! } : {}), amount: normalizeMoneyInput(amount)!,
        ...(date ? { date } : {}), ...(description.trim() ? { description: description.trim() } : {}), ...(contactId && kind !== "transfer" ? { contactId } : {}),
        ...(categoryId && kind !== "transfer" ? { categoryId } : {}),
        ...(deductions.length > 0 ? { goalDeductions: deductions } : {}), ...(shortfall ? { acceptReserveShortfall: true } : {}),
      }, key);
    } catch (e) {
      if (e instanceof ApiError && e.code === "GOAL_RESERVE_CONFLICT") setConflict(e.details as never);
      throw e;
    }
  });
  const ready = !!from && !!normAmount && cmpMoney(normAmount, "0.00") > 0 && (date === "" || isIsoDate(date)) && (kind !== "transfer" || (!!to && to !== from));
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setConflict(null); create.resetKey(); };
  const changeFrom = (v: string) => {
    setFrom(v);
    if (kind === "transfer" && v === to) setTo(null);
    setConflict(null);
    create.resetKey();
  };
  if (impact) {
    return (
      <Screen title="Movimiento registrado">
        <Heading>Presupuestos afectados</Heading>
        {impact.map((b, i) => (
          <Card key={i} outlined><Txt bold>{b.name ?? "Presupuesto"}</Txt><Txt size={12} muted>{b.exceeded ? `Superado por ${formatSoles(b.overBy)}` : `Queda ${formatSoles(b.remaining)}`}{b.percent != null ? ` · ${b.percent}%` : ""}</Txt></Card>
        ))}
        <Button title="Continuar" onPress={() => done(`/operation/${impactId}`)} />
      </Screen>
    );
  }
  const isInlineSpecial = (kind === "expense" && expenseSub !== "normal") || (kind === "income" && incomeSub !== "normal");

  const EXPENSE_SUBS: Array<{ id: ExpenseSubtype; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: "normal", label: "Normal", icon: "pricetag-outline" },
    { id: "service", label: "Servicio", icon: "calendar-outline" },
    { id: "loan", label: "Préstamo", icon: "swap-horizontal-outline" },
    { id: "card", label: "Tarjeta", icon: "card-outline" },
  ];
  const INCOME_SUBS: Array<{ id: IncomeSubtype; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: "normal", label: "Normal", icon: "pricetag-outline" },
    { id: "receipt", label: "Cobro a persona", icon: "people-outline" },
    { id: "loan", label: "Préstamo", icon: "swap-horizontal-outline" },
  ];

  const handleKindChange = (next: "expense" | "income" | "transfer") => {
    setKind(next);
    setExpenseSub("normal");
    setIncomeSub("normal");
    setConflict(null);
    create.resetKey();
  };

  return (
    <Screen
      title="Nuevo movimiento"
      footer={
        isInlineSpecial ? undefined : (
          <Button
            title="Registrar"
            busy={create.busy}
            disabled={!ready}
            onPress={async () => {
              const r = await create.submit();
              if (r) {
                if (r.budgetImpact && r.budgetImpact.length > 0) {
                  setImpactId(r.id);
                  setImpact(r.budgetImpact);
                } else done(`/operation/${r.id}`);
              }
            }}
          />
        )
      }
    >
      {/* Selector principal: Gasto | Ingreso | Transferir */}
      <View style={{ flexDirection: "row", gap: 6, backgroundColor: `${colors.text}08`, borderRadius: 16, padding: 4 }}>
        {([
          ["expense", "Gasto", colors.expenseStrong],
          ["income", "Ingreso", colors.incomeStrong],
          ["transfer", "Transferir", colors.primary],
        ] as const).map(([id, label, activeTint]) => {
          const on = kind === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => handleKindChange(id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: on ? colors.card : "transparent",
              }}
            >
              <Text style={{ color: on ? activeTint : colors.textSecondary, fontSize: 13.5, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Subtipo rápido y opcional (despliegue progresivo sin salir de la pantalla) */}
      {kind === "expense" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 6 }}>
          {EXPENSE_SUBS.map((opt) => {
            const on = expenseSub === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setExpenseSub(opt.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 99,
                  backgroundColor: on ? colors.primarySurface : `${colors.text}08`,
                }}
              >
                <Ionicons name={opt.icon} size={14} color={on ? colors.onPrimary : colors.textSecondary} />
                <Text style={{ color: on ? colors.onPrimary : colors.text, fontSize: 12.5, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {kind === "income" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 6 }}>
          {INCOME_SUBS.map((opt) => {
            const on = incomeSub === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setIncomeSub(opt.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 99,
                  backgroundColor: on ? colors.primarySurface : `${colors.text}08`,
                }}
              >
                <Ionicons name={opt.icon} size={14} color={on ? colors.onPrimary : colors.textSecondary} />
                <Text style={{ color: on ? colors.onPrimary : colors.text, fontSize: 12.5, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Formularios especializados inline */}
      {kind === "expense" && expenseSub === "service" ? (
        <InlineServicePay onDone={() => done("/money")} />
      ) : kind === "expense" && expenseSub === "loan" ? (
        <InlineLoanExpense onDone={() => done("/money")} />
      ) : kind === "expense" && expenseSub === "card" ? (
        <InlineCardPay onDone={() => done("/money")} />
      ) : kind === "income" && incomeSub === "receipt" ? (
        <InlineContactReceipt onDone={() => done("/money")} />
      ) : kind === "income" && incomeSub === "loan" ? (
        <InlineLoanIncome onDone={() => done("/money")} />
      ) : (
        <>
          <Card>
            <AccountPicker
              label={kind === "transfer" ? "Sale de" : kind === "income" ? "Entra a" : "Se paga con"}
              value={from}
              onChange={changeFrom}
              exclude={kind === "transfer" ? to : undefined}
              excludeTypes={kind === "income" ? ["credit"] : undefined}
            />
            {kind === "transfer" && <AccountPicker label="Llega a" value={to} onChange={touch(setTo)} exclude={from} />}
            <MoneyField label="Importe" value={amount} onChange={touch(setAmount)} />
            <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={touch(setDate)} />
            <Field label="Descripción (opcional)" value={description} onChangeText={touch(setDescription)} placeholder="Ej. Almuerzo, supermercado, sueldo…" autoCapitalize="sentences" maxLength={200} />
            {kind !== "transfer" && <CategoryPicker value={categoryId} onChange={touch(setCategoryId)} />}
            {kind !== "transfer" && suggestedCat && !categoryId && (
              <TouchableOpacity
                onPress={() => { setCategoryId(suggestedCat.categoryId); setSuggestedCat(null); create.resetKey(); }}
                activeOpacity={0.75}
                accessibilityRole="button"
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}30` }}
              >
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 12, fontFamily: "Asap" }}>
                  Sugerida por «{suggestedCat.ruleName}»: <Text style={{ fontFamily: "AsapBold" }}>{suggestedCat.categoryName}</Text>
                </Text>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Usar</Text>
              </TouchableOpacity>
            )}
            {kind !== "transfer" && (contacts.data ?? []).length > 0 && (
              <Choice select label="Persona (opcional)" value={contactId} onChange={(v) => touch(setContactId)(v === contactId ? null : v)}
                options={(contacts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name }))} />
            )}
          </Card>
          {conflict && (
            <Card>
              <Txt bold>Este gasto usa {formatSoles(conflict.eaten)} reservados para metas</Txt>
              <Txt size={12} muted>Elige de qué metas se descuenta (debe cubrir {formatSoles(conflict.eaten)}) o acepta que las metas queden con faltante.</Txt>
              {conflict.goals.map((g) => (
                <MoneyField key={g.goalId} label={`${g.name} · reservado ${formatSoles(g.reserved)}`} value={deduct[g.goalId] ?? ""} optional onChange={(v) => { setDeduct((d) => ({ ...d, [g.goalId]: v })); create.resetKey(); }} />
              ))}
              <Choice label="Cómo resolverlo" value={shortfall ? "short" : "pick"} onChange={(v) => { setShortfall(v === "short"); create.resetKey(); }} options={[{ id: "pick", label: "Descontar de las metas elegidas" }, { id: "short", label: "Aceptar el faltante en las metas" }]} />
            </Card>
          )}
          {create.error && <Notice tone="err">{create.error}</Notice>}
        </>
      )}
    </Screen>
  );
}

// ───────────────────────── Cobros ─────────────────────────

/** Cobro: detalle, editar nota, corregir, revertir. */
export function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const rc = useAsync(() => api.receipt(id), [id]);
  const op = useAsync(async () => (rc.data ? api.operation(rc.data.operationId) : null), [rc.data?.operationId]);
  const accounts = useAsync(() => api.accounts(), []);
  useFocusReload(rc.reload);
  const [note, setNote] = useState<string | null>(null);
  const save = useSubmit(async () => api.patchReceipt(id, { note: (note ?? "").trim() || null }, rc.data!.version));

  if (rc.loading && !rc.data) return <Screen title="Cobro"><Loading /></Screen>;
  if (rc.error || !rc.data) return <Screen title="Cobro"><ErrorBox message={rc.error ?? "No se encontró el cobro."} onRetry={rc.reload} /></Screen>;
  const r = rc.data;
  const active = r.status === "active";
  const acc = op.data?.entries[0]?.accountId;
  return (
    <Screen title={formatSoles(r.amount)} subtitle={`Cobro del ${humanDate(r.receivedOn)}`}>
      <Card>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}><Chip status={active ? "paid" : "converted"} label={active ? "Vigente" : "Revertido"} /></View>
        {acc && <KV label="Entró a" value={accountName(accounts.data, acc)} />}
        {r.availability && <>
          <KV label="Aplicado" value={formatSoles(r.availability.applied)} />
          <KV label="Sin aplicar" value={formatSoles(r.availability.unapplied)} />
          <KV label="Reservado" value={formatSoles(r.availability.reserved)} />
          <KV label="Crédito libre" value={formatSoles(r.availability.free)} strong />
          <KV label="Devuelto o programado" value={formatSoles(r.availability.refunded)} />
        </>}
      </Card>

      {active && (
        <Card>
          <Field label="Nota" value={note ?? r.note ?? ""} onChangeText={(v) => { setNote(v); save.resetKey(); }} autoCapitalize="sentences" maxLength={200} />
          <Button title="Guardar nota" variant="secondary" busy={save.busy} disabled={note === null || note === (r.note ?? "")} onPress={async () => { if (await save.submit()) { setNote(null); void rc.reload(); } }} />
          {save.error && <Notice tone="err">{save.error}</Notice>}
        </Card>
      )}

      <Heading>Cómo se aplicó</Heading>
      {r.allocations.length === 0 ? <Card><Txt muted>Sin aplicaciones: todo el importe quedó como crédito.</Txt></Card> : r.allocations.map((a) => (
        <Card key={a.id} outlined>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Txt size={13} muted style={{ flex: 1, flexShrink: 1 }}>{a.origin === "reservation" ? "Desde una reserva" : a.origin === "system" ? "Reajuste del sistema" : "Aplicación"}{a.status === "released" ? ` · liberada (${a.releasedReason ?? ""})` : ""}</Txt>
            <Money value={a.amount} size={14} />
          </View>
        </Card>
      ))}

      {active && (
        <View style={{ gap: 10 }}>
          <Button title="Corregir importe, cuenta, fecha o reparto" variant="secondary" icon="create-outline" onPress={() => router.push(`/receipt/${id}/correct` as never)} />
          <Button title="Revertir cobro" variant="danger" icon="arrow-undo-outline" onPress={() => router.push(`/receipt/${id}/reverse` as never)} />
          <Button title="Ver cobros de la persona" variant="secondary" onPress={() => router.push(`/contact/${r.contactId}/receipts` as never)} />
        </View>
      )}
    </Screen>
  );
}

/** Corregir un cobro: nuevo importe, cuenta, fecha y/o reparto. Solo se envía lo que cambió. */
export function ReceiptCorrectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const rc = useAsync(() => api.receipt(id), [id]);
  const op = useAsync(async () => (rc.data ? api.operation(rc.data.operationId) : null), [rc.data?.operationId]);
  const st = useAsync(async () => (rc.data ? api.contactStatement(rc.data.contactId) : null), [rc.data?.contactId]);
  const [amount, setAmount] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [alloc, setAlloc] = useState<Record<string, string> | null>(null);
  const [noReserve, setNoReserve] = useState(false);
  const [reason, setReason] = useState("");

  const r = rc.data;
  const oldAccount = op.data?.entries[0]?.accountId ?? null;
  const oldAlloc = useMemo(() => {
    const m: Record<string, bigint> = {};
    for (const a of r?.allocations ?? []) if (a.status === "active") m[a.obligationId] = (m[a.obligationId] ?? 0n) + BigInt(a.amount.replace(".", ""));
    return m;
  }, [r]);
  const fmt = (c: bigint) => `${c / 100n}.${(c % 100n).toString().padStart(2, "0")}`;
  const lines = useMemo(() => {
    const out: Array<{ id: string; label: string; sub: string; pending: string }> = [];
    for (const s of st.data?.services ?? []) for (const c of s.charges) {
      if (c.pending !== "0.00" || oldAlloc[c.obligationId]) out.push({ id: c.obligationId, label: `${c.subscriptionName} · ${c.seatLabel}`, sub: humanRange(c.cycle.start, c.cycle.end), pending: c.pending });
    }
    for (const l of st.data?.loans ?? []) for (const c of (l as { components: Array<{ obligationId: string; concept: string; periodLabel: string | null; pending: string }> }).components) {
      if (c.pending !== "0.00" || oldAlloc[c.obligationId]) out.push({ id: c.obligationId, label: `Préstamo · ${c.concept}`, sub: c.periodLabel ?? "", pending: c.pending });
    }
    return out;
  }, [st.data, oldAlloc]);
  const current = (oid: string) => alloc?.[oid] ?? (oldAlloc[oid] ? fmt(oldAlloc[oid]!) : "");

  const body = () => ({
    ...(amount !== null && normalizeMoneyInput(amount) && normalizeMoneyInput(amount) !== r!.amount ? { amount: normalizeMoneyInput(amount)! } : {}),
    ...(account && account !== oldAccount ? { accountId: account } : {}),
    ...(date !== null && date !== r!.receivedOn ? { receivedOn: date } : {}),
    ...(alloc ? { allocations: lines.map((l) => ({ obligationId: l.id, amount: normalizeMoneyInput(current(l.id)) })).filter((a): a is { obligationId: string; amount: string } => !!a.amount && a.amount !== "0.00") } : {}),
    ...(noReserve ? { reserveRemainder: null } : {}),
  });
  const flow = usePreviewFlow({
    preview: () => api.previewReceiptCorrection(id, body()),
    apply: (token, key) => api.correctReceipt(id, { ...body(), reason: reason.trim(), previewToken: token }, key),
  });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  useEffect(() => { if (oldAccount && account === null) setAccount(oldAccount); }, [oldAccount, account]);

  if ((rc.loading && !rc.data) || (st.loading && !st.data)) return <Screen title="Corregir cobro"><Loading /></Screen>;
  if (rc.error || !r) return <Screen title="Corregir cobro"><ErrorBox message={rc.error ?? "No se encontró el cobro."} onRetry={rc.reload} /></Screen>;
  return (
    <Screen title="Corregir cobro" subtitle={`${formatSoles(r.amount)} · ${humanDate(r.receivedOn)}`}
      footer={<PreviewFooter flow={flow} disabled={Object.keys(body()).length === 0 || reason.trim().length === 0} confirmDisabled={reason.trim().length === 0} previewLabel="Ver efectos" confirmLabel="Aplicar corrección" onConfirm={async () => { const x = await flow.confirm(); if (x) done(`/contact/${r.contactId}/receipts`); }} />}>
      <Card>
        <MoneyField label="Importe recibido" value={amount ?? r.amount} onChange={touch(setAmount)} />
        <AccountPicker label="Entró a" value={account} onChange={touch(setAccount)} />
        <DateField label="Fecha del cobro" value={date ?? r.receivedOn} onChange={touch(setDate)} />
        <ReasonField value={reason} onChange={(v) => { setReason(v); flow.invalidate(); }} label="Motivo de la corrección" />
      </Card>
      <Heading>Reparto</Heading>
      <Txt size={12} muted>Si cambias el importe y el reparto anterior ya no cabe, la vista previa te lo dirá: ajusta aquí cuánto va a cada deuda.</Txt>
      {lines.length === 0 ? <Card><Txt muted>No hay deudas a las que aplicar: todo quedará como crédito.</Txt></Card> : lines.map((l) => (
        <Card key={l.id} outlined>
          <Txt bold size={14}>{l.label}</Txt>
          <Txt size={12} muted>{l.sub}</Txt>
          <MoneyField label={`Importe aplicado (pendiente ${formatSoles(l.pending)})`} value={current(l.id)} optional onChange={(v) => { setAlloc({ ...(alloc ?? Object.fromEntries(lines.map((x) => [x.id, current(x.id)]))), [l.id]: v }); flow.invalidate(); }} />
        </Card>
      ))}
      <Card><SwitchRow label="Dejar el sobrante como crédito libre (sin reservarlo para un servicio)" value={noReserve} onValueChange={touch(setNoReserve)} /></Card>
      <Notice tone="info">Se anula el cobro original y se registra uno nuevo con lo que elijas, en una sola operación. Corregir no es devolver dinero.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}

/** Revertir un cobro: anula el ingreso y las deudas vuelven a quedar pendientes. */
export function ReceiptReverseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const rc = useAsync(() => api.receipt(id), [id]);
  const [reason, setReason] = useState("");
  const flow = usePreviewFlow({
    preview: () => api.previewReceiptReversal(id),
    apply: (token, key) => api.reverseReceipt(id, { reason: reason.trim(), previewToken: token }, key),
  });
  return (
    <Screen title="Revertir cobro" subtitle={rc.data ? `${formatSoles(rc.data.amount)} · ${humanDate(rc.data.receivedOn)}` : undefined}
      footer={<PreviewFooter flow={flow} previewLabel="Ver efectos" confirmLabel="Revertir cobro" danger confirmDisabled={reason.trim().length === 0} onConfirm={async () => { if (await flow.confirm()) done(`/receipt/${id}`); }} />}>
      <Card><ReasonField value={reason} onChange={setReason} label="Motivo de la reversión" /></Card>
      <Notice tone="info">Revertir no es devolver dinero: el ingreso se anula y las deudas a las que se aplicó vuelven a quedar pendientes. Si tiene devoluciones programadas, cancélalas antes.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}
