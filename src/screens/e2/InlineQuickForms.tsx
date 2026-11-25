import React, { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import type { Account, BankLoanListItem, Contact, Loan, Subscription } from "../../api/types";
import { AccountPicker, DateField, MoneyField } from "../../components/v1/forms";
import { Button, Card, Field, Loading, Notice, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput, suggestAllocation } from "../../utils/money";
import { getAdjustedColor, ServiceIcon } from "../../utils/serviceIcons";

export type ExpenseSubtype = "normal" | "service" | "loan" | "card";
export type IncomeSubtype = "normal" | "receipt" | "loan";

function PickerRow({
  selected,
  onPress,
  left,
  title,
  subtitle,
  right,
  rightColor,
}: {
  selected: boolean;
  onPress: () => void;
  left?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: string;
  rightColor?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: selected ? `${colors.primary}16` : `${colors.text}06`,
        borderWidth: 1,
        borderColor: selected ? colors.primary : "transparent",
      }}
    >
      {left}
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <Text style={{ color: rightColor ?? colors.text, fontSize: 13.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
          {right}
        </Text>
      ) : null}
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? colors.primary : colors.muted} />
    </TouchableOpacity>
  );
}

// ───────────────────────── 1. Pago de servicio (inline en Gasto) ─────────────────────────

export function InlineServicePay({ onDone }: { onDone: () => void }) {
  const { colors, isDark } = useAppTheme();
  const subs = useAsync(() => api.subscriptions("active"), []);
  const [subId, setSubId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const list = useMemo(() => {
    const raw = (subs.data ?? []).filter((s) => s.currentCycle);
    // Primero los que aún están por pagar en el ciclo actual
    return [...raw].sort((a, b) => Number(!!a.currentCyclePaid) - Number(!!b.currentCyclePaid) || a.name.localeCompare(b.name));
  }, [subs.data]);

  const selected: Subscription | null = list.find((s) => s.id === subId) ?? null;

  const pickService = (s: Subscription) => {
    setSubId(s.id);
    setAmount(s.currentCycle?.announcedPrice ?? s.terms?.announcedPrice ?? "");
    if (s.preferredAccountId) setAccountId(s.preferredAccountId);
    submit.resetKey();
  };

  const amtNorm = normalizeMoneyInput(amount);
  const submit = useSubmit(async (key: string) => {
    if (!selected?.currentCycle) throw new Error("Elige un servicio con ciclo activo.");
    return api.paySupplier(
      selected.currentCycle.id,
      {
        accountId: accountId!,
        amount: amtNorm!,
        paidOn: date || todayLocalIso(),
      },
      key,
    );
  });

  const ready = !!selected?.currentCycle && !selected.currentCyclePaid && !!accountId && !!amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (date === "" || isIsoDate(date));

  if (subs.loading && !subs.data) return <Loading />;
  if (list.length === 0) {
    return <Notice tone="info">No tienes servicios activos con ciclo en curso.</Notice>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>
          ¿Qué servicio pagaste?
        </Text>
        <View style={{ gap: 6 }}>
          {list.map((s) => {
            const paid = !!s.currentCyclePaid;
            const tone = getAdjustedColor(s.color || colors.primary, isDark);
            return (
              <PickerRow
                key={s.id}
                selected={subId === s.id}
                onPress={() => pickService(s)}
                left={<ServiceIcon name={s.icon || "receipt"} size={20} color={tone} />}
                title={s.name}
                subtitle={paid ? "Ciclo actual ya pagado" : s.currentCycle ? `Ciclo hasta ${humanDate(s.currentCycle.endDate)}` : undefined}
                right={formatSoles(s.currentCycle?.announcedPrice ?? s.terms?.announcedPrice)}
                rightColor={paid ? colors.incomeStrong : colors.text}
              />
            );
          })}
        </View>
      </View>

      {selected && selected.currentCyclePaid && (
        <Notice tone="ok">El ciclo actual de {selected.name} ya está marcado como pagado.</Notice>
      )}

      {selected && !selected.currentCyclePaid && (
        <Card>
          <AccountPicker label="Pagado con" value={accountId} onChange={(v) => { setAccountId(v); submit.resetKey(); }} />
          <MoneyField label="Importe cobrado" value={amount} onChange={(v) => { setAmount(v); submit.resetKey(); }} />
          <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={(v) => { setDate(v); submit.resetKey(); }} />
        </Card>
      )}

      {submit.error && <Notice tone="err">{submit.error}</Notice>}
      {selected && !selected.currentCyclePaid && (
        <Button title="Registrar pago de servicio" icon="checkmark-circle-outline" busy={submit.busy} disabled={!ready} onPress={async () => { if (await submit.submit()) onDone(); }} />
      )}
    </View>
  );
}

// ───────────────────────── 2. Pago de tarjeta de crédito (inline en Gasto) ─────────────────────────

export function InlineCardPay({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const accounts = useAsync(() => api.accounts(), []);
  const [cardId, setCardId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const cards = useMemo(() => (accounts.data ?? []).filter((a) => a.status === "active" && a.type === "credit"), [accounts.data]);
  const selectedCard: Account | null = cards.find((c) => c.id === cardId) ?? null;

  const pickCard = (c: Account) => {
    setCardId(c.id);
    const owes = cmpMoney(c.balance, "0.00") < 0;
    setAmount(owes ? c.balance.replace("-", "") : "");
    submit.resetKey();
  };

  const amtNorm = normalizeMoneyInput(amount);
  const submit = useSubmit(async (key: string) => {
    return api.createOperation(
      {
        kind: "transfer",
        accountId: fromId!,
        toAccountId: cardId!,
        amount: amtNorm!,
        ...(date ? { date } : {}),
        description: selectedCard ? `Pago de tarjeta ${selectedCard.name}` : "Pago de tarjeta",
      },
      key,
    );
  });

  const ready = !!cardId && !!fromId && cardId !== fromId && !!amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (date === "" || isIsoDate(date));

  if (accounts.loading && !accounts.data) return <Loading />;
  if (cards.length === 0) {
    return <Notice tone="info">No tienes tarjetas de crédito activas registradas.</Notice>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>
          ¿Qué tarjeta estás pagando?
        </Text>
        <View style={{ gap: 6 }}>
          {cards.map((c) => {
            const owes = cmpMoney(c.balance, "0.00") < 0;
            const debt = owes ? c.balance.replace("-", "") : "0.00";
            return (
              <PickerRow
                key={c.id}
                selected={cardId === c.id}
                onPress={() => pickCard(c)}
                left={<Ionicons name="card-outline" size={20} color={colors.primary} />}
                title={c.name}
                subtitle={owes ? "Deuda actual" : "Sin deuda"}
                right={owes ? formatSoles(debt) : "Al día"}
                rightColor={owes ? colors.expenseStrong : colors.incomeStrong}
              />
            );
          })}
        </View>
      </View>

      {selectedCard && (
        <Card>
          <AccountPicker label="Pagas desde" value={fromId} onChange={(v) => { setFromId(v); submit.resetKey(); }} exclude={cardId} excludeTypes={["credit"]} />
          <MoneyField label="Importe a pagar" value={amount} onChange={(v) => { setAmount(v); submit.resetKey(); }} />
          <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={(v) => { setDate(v); submit.resetKey(); }} />
        </Card>
      )}

      {submit.error && <Notice tone="err">{submit.error}</Notice>}
      {selectedCard && (
        <Button title="Registrar pago de tarjeta" icon="card-outline" busy={submit.busy} disabled={!ready} onPress={async () => { if (await submit.submit()) onDone(); }} />
      )}
    </View>
  );
}

// ───────────────────────── 3. Pago de préstamo (inline en Gasto: Persona o Banco) ─────────────────────────

export function InlineLoanExpense({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const loansQ = useAsync(() => api.loans(), []);
  const bankQ = useAsync(() => api.bankLoans("active"), []);
  const [source, setSource] = useState<"person" | "bank" | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const borrowedLoans = useMemo(
    () => (loansQ.data ?? []).filter((l) => l.status === "open" && l.direction === "borrowed" && l.engine === "ledger"),
    [loansQ.data],
  );
  const activeBankLoans = useMemo(
    () => (bankQ.data ?? []).filter((b) => b.status === "active"),
    [bankQ.data],
  );

  // Elegir automáticamente la pestaña que tenga datos para no abrumar
  const activeSource: "person" | "bank" = source ?? (borrowedLoans.length > 0 ? "person" : activeBankLoans.length > 0 ? "bank" : "person");

  const selectedLoan: Loan | null = borrowedLoans.find((l) => l.id === loanId) ?? null;
  const selectedBank: BankLoanListItem | null = activeBankLoans.find((b) => b.id === bankId) ?? null;
  const amtNorm = normalizeMoneyInput(amount);

  const submit = useSubmit(async (key: string) => {
    if (activeSource === "person" && selectedLoan) {
      const body = { amount: amtNorm!, accountId: accountId!, ...(date ? { paidOn: date } : {}), onRemainder: "keep" as const };
      const prev = await api.previewLoanPayment(selectedLoan.id, body);
      if (!prev?.previewToken) throw new Error("No se pudo preparar el pago del préstamo.");
      return api.payLoan(selectedLoan.id, { ...body, previewToken: prev.previewToken }, key);
    }
    if (activeSource === "bank" && selectedBank) {
      const body = {
        accountId: accountId!,
        amount: amtNorm!,
        paidOn: date || todayLocalIso(),
        ...(selectedBank.nextDue ? { installmentNumber: selectedBank.nextDue.number } : {}),
      };
      const prev = await api.previewBankPayment(selectedBank.id, body);
      if (!prev?.previewToken) throw new Error("No se pudo preparar el pago de la cuota.");
      return api.payBankLoan(selectedBank.id, { ...body, previewToken: prev.previewToken }, key);
    }
    throw new Error("Elige un préstamo.");
  });

  const ready = (activeSource === "person" ? !!selectedLoan : !!selectedBank) && !!accountId && !!amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (date === "" || isIsoDate(date));

  if ((loansQ.loading && !loansQ.data) || (bankQ.loading && !bankQ.data)) return <Loading />;

  return (
    <View style={{ gap: 12 }}>
      {/* Selector limpio Persona / Banco */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {([
          ["person", "De persona", "people-outline", borrowedLoans.length],
          ["bank", "De banco", "business-outline", activeBankLoans.length],
        ] as const).map(([id, label, icon, count]) => {
          const on = activeSource === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => { setSource(id); setLoanId(null); setBankId(null); setAmount(""); submit.resetKey(); }}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: on ? colors.primarySurface : `${colors.text}08`,
              }}
            >
              <Ionicons name={icon} size={15} color={on ? colors.onPrimary : colors.textSecondary} />
              <Text style={{ color: on ? colors.onPrimary : colors.text, fontSize: 13, fontFamily: "AsapBold" }}>
                {label}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeSource === "person" ? (
        borrowedLoans.length === 0 ? (
          <Notice tone="info">No tienes préstamos activos recibidos de personas.</Notice>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>¿A quién le estás pagando?</Text>
            {borrowedLoans.map((l) => (
              <PickerRow
                key={l.id}
                selected={loanId === l.id}
                onPress={() => { setLoanId(l.id); setAmount(l.pending); submit.resetKey(); }}
                left={<Ionicons name="arrow-down-circle-outline" size={20} color={colors.expenseStrong} />}
                title={l.contactName}
                subtitle={`Te prestó · desde ${humanDate(l.openedOn)}`}
                right={formatSoles(l.pending)}
                rightColor={colors.expenseStrong}
              />
            ))}
          </View>
        )
      ) : activeBankLoans.length === 0 ? (
        <Notice tone="info">No tienes préstamos bancarios activos.</Notice>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>¿Qué préstamo bancario estás pagando?</Text>
          {activeBankLoans.map((b) => (
            <PickerRow
              key={b.id}
              selected={bankId === b.id}
              onPress={() => { setBankId(b.id); setAmount(b.nextDue?.remaining ?? b.remainingScheduled); submit.resetKey(); }}
              left={<Ionicons name="business-outline" size={20} color={colors.primary} />}
              title={b.name}
              subtitle={b.nextDue ? `Cuota ${b.nextDue.number} · vence ${humanDate(b.nextDue.dueDate)}` : b.entity ?? "Préstamo bancario"}
              right={formatSoles(b.nextDue?.remaining ?? b.remainingScheduled)}
              rightColor={colors.expenseStrong}
            />
          ))}
        </View>
      )}

      {((activeSource === "person" && selectedLoan) || (activeSource === "bank" && selectedBank)) && (
        <Card>
          <AccountPicker label="Sale de la cuenta" value={accountId} onChange={(v) => { setAccountId(v); submit.resetKey(); }} />
          <MoneyField label="Importe del pago" value={amount} onChange={(v) => { setAmount(v); submit.resetKey(); }} />
          <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={(v) => { setDate(v); submit.resetKey(); }} />
        </Card>
      )}

      {submit.error && <Notice tone="err">{submit.error}</Notice>}
      {((activeSource === "person" && selectedLoan) || (activeSource === "bank" && selectedBank)) && (
        <Button title="Registrar pago de préstamo" icon="checkmark-circle-outline" busy={submit.busy} disabled={!ready} onPress={async () => { if (await submit.submit()) onDone(); }} />
      )}
    </View>
  );
}

// ───────────────────────── 4. Cobro a persona (inline en Ingreso) ─────────────────────────

export function InlineContactReceipt({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const contactsQ = useAsync(() => api.contacts(), []);
  const [contactId, setContactId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const stmtQ = useAsync(async () => (contactId ? api.contactStatement(contactId) : null), [contactId]);

  const people = useMemo(() => {
    const active = (contactsQ.data ?? []).filter((c) => c.status === "active");
    return [...active].sort((a, b) => cmpMoney(b.totals.pending, a.totals.pending) || a.name.localeCompare(b.name));
  }, [contactsQ.data]);

  const pickContact = (c: Contact) => {
    setContactId(c.id);
    setAmount(cmpMoney(c.totals.pending, "0.00") > 0 ? c.totals.pending : "");
    submit.resetKey();
  };

  const payables = useMemo(() => {
    if (!stmtQ.data) return [];
    const charges = stmtQ.data.services.flatMap((s) => s.charges).filter((c) => cmpMoney(c.pending, "0.00") > 0);
    const loanComps = (stmtQ.data.loans ?? []).flatMap((l) => l.components).filter((c) => cmpMoney(c.pending, "0.00") > 0);
    return [
      ...charges.map((c) => ({ id: c.obligationId, pending: c.pending, dueDate: c.dueDate })),
      ...loanComps.map((c) => ({ id: c.obligationId, pending: c.pending, dueDate: c.dueDate ?? "9999-12-31" })),
    ];
  }, [stmtQ.data]);

  const amtNorm = normalizeMoneyInput(amount);
  const suggestedAlloc = useMemo(() => {
    if (!amtNorm || cmpMoney(amtNorm, "0.00") <= 0 || payables.length === 0) return {};
    return suggestAllocation(amtNorm, payables);
  }, [amtNorm, payables]);
  const appliedCount = Object.values(suggestedAlloc).filter((v) => cmpMoney(v, "0.00") > 0).length;

  const submit = useSubmit(async (key: string) => {
    const allocations = Object.entries(suggestedAlloc)
      .map(([obligationId, v]) => ({ obligationId, amount: v }))
      .filter((a) => cmpMoney(a.amount, "0.00") > 0);
    const body = {
      contactId: contactId!,
      accountId: accountId!,
      amount: amtNorm!,
      receivedOn: date || todayLocalIso(),
      ...(note.trim() ? { note: note.trim() } : {}),
      allocations,
    };
    const prev = await api.previewReceipt(body);
    if (!prev.valid || !prev.previewToken) throw new Error("No se pudo validar el cobro; revisa el importe.");
    return api.createReceipt({ ...body, previewToken: prev.previewToken }, key);
  });

  const ready = !!contactId && !stmtQ.loading && !!accountId && !!amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (date === "" || isIsoDate(date));

  if (contactsQ.loading && !contactsQ.data) return <Loading />;
  if (people.length === 0) {
    return <Notice tone="info">Aún no tienes personas registradas. Crea una desde la pestaña Personas.</Notice>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>
          ¿Quién te pagó?
        </Text>
        <View style={{ gap: 6 }}>
          {people.map((c) => {
            const owes = cmpMoney(c.totals.pending, "0.00") > 0;
            return (
              <PickerRow
                key={c.id}
                selected={contactId === c.id}
                onPress={() => pickContact(c)}
                left={<Ionicons name="person-circle-outline" size={22} color={owes ? colors.expenseStrong : colors.primary} />}
                title={c.name}
                subtitle={owes ? `${c.services} ${c.services === 1 ? "servicio" : "servicios"} · pendiente` : "Al día (quedará como saldo a favor)"}
                right={owes ? formatSoles(c.totals.pending) : "Al día"}
                rightColor={owes ? colors.expenseStrong : colors.incomeStrong}
              />
            );
          })}
        </View>
      </View>

      {contactId && (
        <Card>
          <AccountPicker label="Entró a la cuenta" value={accountId} onChange={(v) => { setAccountId(v); submit.resetKey(); }} excludeTypes={["credit"]} />
          <MoneyField label="Importe recibido" value={amount} onChange={(v) => { setAmount(v); submit.resetKey(); }} />
          <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={(v) => { setDate(v); submit.resetKey(); }} />
          <Field label="Nota (opcional)" value={note} onChangeText={(v) => { setNote(v); submit.resetKey(); }} placeholder="Ej. Yape Netflix noviembre" autoCapitalize="sentences" maxLength={200} />
          {!stmtQ.loading && amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (
            <Txt size={12} muted>
              {appliedCount > 0
                ? `Se aplicará automáticamente a ${appliedCount} ${appliedCount === 1 ? "cargo pendiente" : "cargos pendientes"} (del más antiguo al más reciente).`
                : "Sin cargos pendientes: el importe quedará guardado como saldo a favor de esta persona."}
            </Txt>
          )}
        </Card>
      )}

      {submit.error && <Notice tone="err">{submit.error}</Notice>}
      {contactId && (
        <Button title="Registrar cobro" icon="cash-outline" busy={submit.busy} disabled={!ready} onPress={async () => { if (await submit.submit()) onDone(); }} />
      )}
    </View>
  );
}

// ───────────────────────── 5. Cobro de préstamo otorgado (inline en Ingreso) ─────────────────────────

export function InlineLoanIncome({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const loansQ = useAsync(() => api.loans(), []);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const lentLoans = useMemo(
    () => (loansQ.data ?? []).filter((l) => l.status === "open" && l.direction !== "borrowed"),
    [loansQ.data],
  );
  const selected: Loan | null = lentLoans.find((l) => l.id === loanId) ?? null;
  const amtNorm = normalizeMoneyInput(amount);

  const submit = useSubmit(async (key: string) => {
    if (!selected) throw new Error("Elige un préstamo.");
    if (selected.engine === "ledger") {
      const body = { amount: amtNorm!, accountId: accountId!, ...(date ? { paidOn: date } : {}), onRemainder: "keep" as const };
      const prev = await api.previewLoanPayment(selected.id, body);
      if (!prev?.previewToken) throw new Error("No se pudo preparar el cobro del préstamo.");
      return api.payLoan(selected.id, { ...body, previewToken: prev.previewToken }, key);
    }
    // Préstamo por conversión de deuda: se cobra mediante receipt sobre sus componentes
    const comps = selected.components.filter((c) => cmpMoney(c.pending, "0.00") > 0);
    const allocMap = suggestAllocation(amtNorm!, comps.map((c) => ({ id: c.obligationId, pending: c.pending, dueDate: c.dueDate ?? "9999-12-31" })));
    const allocations = Object.entries(allocMap).map(([obligationId, v]) => ({ obligationId, amount: v })).filter((a) => cmpMoney(a.amount, "0.00") > 0);
    const body = { contactId: selected.contactId, accountId: accountId!, amount: amtNorm!, receivedOn: date || todayLocalIso(), allocations };
    const prev = await api.previewReceipt(body);
    if (!prev.valid || !prev.previewToken) throw new Error("No se pudo validar el cobro del préstamo.");
    return api.createReceipt({ ...body, previewToken: prev.previewToken }, key);
  });

  const ready = !!selected && !!accountId && !!amtNorm && cmpMoney(amtNorm, "0.00") > 0 && (date === "" || isIsoDate(date));

  if (loansQ.loading && !loansQ.data) return <Loading />;
  if (lentLoans.length === 0) {
    return <Notice tone="info">No tienes préstamos activos pendientes de cobro.</Notice>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", marginLeft: 2 }}>
          ¿De qué préstamo te pagaron?
        </Text>
        <View style={{ gap: 6 }}>
          {lentLoans.map((l) => (
            <PickerRow
              key={l.id}
              selected={loanId === l.id}
              onPress={() => { setLoanId(l.id); setAmount(l.pending); submit.resetKey(); }}
              left={<Ionicons name="arrow-up-circle-outline" size={20} color={colors.incomeStrong} />}
              title={l.contactName}
              subtitle={`Le prestaste · desde ${humanDate(l.openedOn)}`}
              right={formatSoles(l.pending)}
              rightColor={colors.incomeStrong}
            />
          ))}
        </View>
      </View>

      {selected && (
        <Card>
          <AccountPicker label="Entró a la cuenta" value={accountId} onChange={(v) => { setAccountId(v); submit.resetKey(); }} excludeTypes={["credit"]} />
          <MoneyField label="Importe recibido" value={amount} onChange={(v) => { setAmount(v); submit.resetKey(); }} />
          <DateField label="Fecha (hoy si la dejas vacía)" value={date} optional onChange={(v) => { setDate(v); submit.resetKey(); }} />
        </Card>
      )}

      {submit.error && <Notice tone="err">{submit.error}</Notice>}
      {selected && (
        <Button title="Registrar cobro de préstamo" icon="checkmark-circle-outline" busy={submit.busy} disabled={!ready} onPress={async () => { if (await submit.submit()) onDone(); }} />
      )}
    </View>
  );
}
