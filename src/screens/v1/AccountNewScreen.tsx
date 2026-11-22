import React, { useState } from "react";
import { View } from "react-native";
import { useDone } from "../../hooks/useDone";
import { BankCardCustomizer } from "../../components/v1/BankCard";
import { SelectField } from "../../components/v1/Select";
import { DateInput } from "../../components/v1/DatePicker";
import { isIsoDate, todayLocalIso } from "../../utils/dates";
import { api } from "../../api/client";
import type { AccountType } from "../../api/types";
import { Button, Card, Field, Heading, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { BANK_PRESETS, bankPreset, type CardPattern } from "../../constants/banks";
import { useSubmit } from "../../hooks/useAsync";
import { cmpMoney, normalizeMoneyInput } from "../../utils/money";

const TYPES: Array<{ id: AccountType; label: string }> = [
  { id: "bank", label: "Banco" }, { id: "savings", label: "Ahorro" }, { id: "cash", label: "Efectivo" }, { id: "wallet", label: "Billetera" }, { id: "credit", label: "Tarjeta de crédito" },
];

export default function AccountNewScreen() {
  const done = useDone();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [typeTouched, setTypeTouched] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [institution, setInstitution] = useState("");
  const [other, setOther] = useState(false);
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [cardPattern, setCardPattern] = useState<CardPattern>("circles");
  const preset = bankPreset(institution);
  const pickEntity = (id: string) => {
    create.resetKey();
    if (id === "other") { setOther(true); setInstitution(""); return; }
    const b = BANK_PRESETS.find((x) => x.id === id);
    if (!b) return;
    setOther(false); setInstitution(b.label);
    if (!typeTouched) setType(b.type);
    if (!name.trim()) setName(b.label);
  };
  const [openingDate, setOpeningDate] = useState("");
  const [creditLine, setCreditLine] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [exclude, setExclude] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isCredit = type === "credit";
  const previewNorm = normalizeMoneyInput(amountText) ?? "0.00";
  const previewBalance = isCredit && previewNorm !== "0.00" ? `-${previewNorm}` : previewNorm;
  const previewLineNorm = isCredit ? normalizeMoneyInput(creditLine) : null;
  const previewCredit = isCredit && previewLineNorm && cmpMoney(previewLineNorm, "0.00") > 0
    ? {
        creditLine: previewLineNorm,
        used: previewNorm,
        available: (Math.max(0, Number(previewLineNorm) - Number(previewNorm))).toFixed(2),
      }
    : null;

  const create = useSubmit(async (key: string) => {
    const amount = amountText.trim() === "" ? null : normalizeMoneyInput(amountText);
    if (!name.trim()) throw Object.assign(new Error("Escribe un nombre para la cuenta."), { code: "VALIDATION" });
    if (amountText.trim() !== "" && amount === null) throw Object.assign(new Error("El importe no es válido. Usa números con hasta 2 decimales."), { code: "VALIDATION" });
    // En una tarjeta de crédito lo que se escribe es la DEUDA; la API la guarda como saldo negativo.
    const signed = amount === null || amount === "0.00" ? undefined : isCredit ? `-${amount}` : amount;
    if (openingDate && !isIsoDate(openingDate)) throw Object.assign(new Error("La fecha del saldo debe ser AAAA-MM-DD."), { code: "VALIDATION" });
    if (openingDate && openingDate > todayLocalIso()) throw Object.assign(new Error("La fecha del saldo no puede ser posterior a hoy."), { code: "FUTURE_DATE_NOT_ALLOWED" });

    let creditDetailsPayload: { creditLine: string | null; cutoffDay: number; dueDay: number } | null = null;
    if (isCredit && (creditLine.trim() || cutoffDay.trim() || dueDay.trim())) {
      const normLine = creditLine.trim() === "" ? null : normalizeMoneyInput(creditLine);
      if (creditLine.trim() !== "" && (!normLine || cmpMoney(normLine, "0.00") <= 0)) {
        throw Object.assign(new Error("La línea de crédito debe ser un monto positivo."), { code: "VALIDATION" });
      }
      const cut = Number.parseInt(cutoffDay.trim(), 10);
      const due = Number.parseInt(dueDay.trim(), 10);
      if (!Number.isInteger(cut) || cut < 1 || cut > 31) {
        throw Object.assign(new Error("Indica el día de corte de la tarjeta (un número entre 1 y 31)."), { code: "VALIDATION" });
      }
      if (!Number.isInteger(due) || due < 1 || due > 31) {
        throw Object.assign(new Error("Indica el día límite de pago de la tarjeta (un número entre 1 y 31)."), { code: "VALIDATION" });
      }
      creditDetailsPayload = { creditLine: normLine, cutoffDay: cut, dueDay: due };
    }

    const created = await api.createAccount({
      name: name.trim(), type,
      ...(institution.trim() ? { institution: institution.trim() } : {}),
      ...(cardColor ? { color: cardColor } : {}),
      ...(cardPattern !== "circles" ? { icon: cardPattern } : {}),
      ...(isDefault ? { isDefault: true } : {}),
      ...(exclude ? { excludeFromTotal: true } : {}),
      ...(signed ? { openingBalance: { amount: signed, ...(openingDate ? { date: openingDate } : {}) } } : {}),
    }, key);

    if (creditDetailsPayload) {
      try {
        await api.setCreditDetails(created.id, creditDetailsPayload);
      } catch {
        // Si ya se creó la cuenta, se puede completar corte/pago desde el detalle de la tarjeta.
      }
    }
    return created;
  });

  const save = async () => {
    setFormError(null);
    const r = await create.submit();
    if (r) done("/money");
  };

  return (
    <Screen title="Nueva cuenta" footer={<Button title="Crear cuenta" onPress={save} busy={create.busy} />}>
      <Card>
        <BankCardCustomizer
          account={{ name, type, institution: institution.trim() || null, balance: previewBalance, color: cardColor, icon: cardPattern, credit: previewCredit }}
          color={cardColor}
          pattern={cardPattern}
          onChangeColor={(c) => { setCardColor(c); create.resetKey(); }}
          onChangePattern={(p) => { setCardPattern(p); create.resetKey(); }}
        />
      </Card>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); create.resetKey(); }} placeholder="Ej. BCP, Efectivo, Yape…" autoCapitalize="words" />
        <SelectField label="Tipo" value={type} onChange={(v) => { setType(v); setTypeTouched(true); create.resetKey(); }} options={TYPES} />
        <SelectField label="Entidad" value={other ? "other" : preset?.id ?? null} onChange={pickEntity} placeholder="Elegir" options={[...BANK_PRESETS.map((b) => ({ id: b.id, label: b.label })), { id: "other", label: "Otra o ninguna" }]} />
        {other && <Field label="Nombre de la entidad (opcional)" value={institution} onChangeText={(t) => { setInstitution(t); create.resetKey(); }} placeholder="Ej. Banco, billetera…" autoCapitalize="words" />}
        <Field label={isCredit ? "Deuda actual (S/)" : "Saldo actual (S/)"} value={amountText} onChangeText={(t) => { setAmountText(t); create.resetKey(); }} placeholder="Ej. 0.00" keyboardType="decimal-pad" />
        <DateInput label="Fecha del saldo" optional value={openingDate} onChange={(t) => { setOpeningDate(t); create.resetKey(); }} />
        <SwitchRow label="Usarla como cuenta predeterminada" value={isDefault} onValueChange={(v) => { setIsDefault(v); create.resetKey(); }} />
        <SwitchRow label="Excluir del saldo total" value={exclude} onValueChange={(v) => { setExclude(v); create.resetKey(); }} />
      </Card>
      {isCredit && (
        <>
          <Heading>Datos de la tarjeta</Heading>
          <Card>
            <Field
              label="Línea de crédito (S/ · opcional)"
              value={creditLine}
              onChangeText={(t) => { setCreditLine(t); create.resetKey(); }}
              placeholder="Ej. 3000.00"
              keyboardType="decimal-pad"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Día de corte (1–31)"
                  value={cutoffDay}
                  onChangeText={(t) => { setCutoffDay(t.replace(/\D/g, "").slice(0, 2)); create.resetKey(); }}
                  placeholder="Ej. 15"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Día límite de pago (1–31)"
                  value={dueDay}
                  onChangeText={(t) => { setDueDay(t.replace(/\D/g, "").slice(0, 2)); create.resetKey(); }}
                  placeholder="Ej. 5"
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <Txt size={12} muted>
              Opcional ahora (también puedes configurarlo luego). La línea de crédito es informativa y no suma a tu saldo propio; con los días de corte y pago EVA calcula qué tarjeta conviene usar cada día.
            </Txt>
          </Card>
        </>
      )}
      <Notice tone="info">El saldo inicial no cuenta como ingreso ni gasto del mes: es solo el punto de partida de esta cuenta.</Notice>
      {(formError || create.error) && <Notice tone="err">{formError ?? create.error}</Notice>}
    </Screen>
  );
}
