import React, { useState } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { useDone } from "../../hooks/useDone";
import { DateField } from "../../components/v1/forms";
import { isIsoDate } from "../../utils/dates";
import { api } from "../../api/client";
import type { AccountType } from "../../api/types";
import { Button, Card, Field, Notice, Screen, Txt, SwitchRow } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubmit } from "../../hooks/useAsync";
import { normalizeMoneyInput } from "../../utils/money";

const TYPES: Array<{ id: AccountType; label: string }> = [
  { id: "bank", label: "Banco" }, { id: "savings", label: "Ahorro" }, { id: "cash", label: "Efectivo" }, { id: "wallet", label: "Billetera" }, { id: "credit", label: "Tarjeta de crédito" },
];

export default function AccountNewScreen() {
  const { colors } = useAppTheme();
  const done = useDone();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [amountText, setAmountText] = useState("");
  const [institution, setInstitution] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [exclude, setExclude] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isCredit = type === "credit";
  const create = useSubmit(async (key: string) => {
    const amount = amountText.trim() === "" ? null : normalizeMoneyInput(amountText);
    if (!name.trim()) throw Object.assign(new Error("Escribe un nombre para la cuenta."), { code: "VALIDATION" });
    if (amountText.trim() !== "" && amount === null) throw Object.assign(new Error("El importe no es válido. Usa números con hasta 2 decimales."), { code: "VALIDATION" });
    // En una tarjeta de crédito lo que se escribe es la DEUDA; la API la guarda como saldo negativo.
    const signed = amount === null || amount === "0.00" ? undefined : isCredit ? `-${amount}` : amount;
    if (openingDate && !isIsoDate(openingDate)) throw Object.assign(new Error("La fecha del saldo debe ser AAAA-MM-DD."), { code: "VALIDATION" });
    return api.createAccount({
      name: name.trim(), type, ...(institution.trim() ? { institution: institution.trim() } : {}), ...(isDefault ? { isDefault: true } : {}), ...(exclude ? { excludeFromTotal: true } : {}),
      ...(signed ? { openingBalance: { amount: signed, ...(openingDate ? { date: openingDate } : {}) } } : {}),
    }, key);
  });

  const save = async () => {
    setFormError(null);
    const r = await create.submit();
    if (r) done("/");
  };

  return (
    <Screen title="Nueva cuenta" footer={<Button title="Crear cuenta" onPress={save} busy={create.busy} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); create.resetKey(); }} placeholder="BCP, Efectivo, Yape…" autoCapitalize="words" />
        <Txt size={12} muted style={{ marginBottom: 6 }}>TIPO</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {TYPES.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => { setType(t.id); create.resetKey(); }} accessibilityRole="radio" accessibilityState={{ selected: type === t.id }}
              style={{ paddingHorizontal: 12, minHeight: 32, justifyContent: "center", borderRadius: 99, borderWidth: 1, borderColor: type === t.id ? colors.primary : colors.border, backgroundColor: type === t.id ? `${colors.primary}1A` : "transparent" }}>
              <Text style={{ color: type === t.id ? colors.primary : colors.text, fontFamily: "AsapMedium" }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Entidad (opcional)" value={institution} onChangeText={(t) => { setInstitution(t); create.resetKey(); }} placeholder="BCP, Interbank, Yape…" autoCapitalize="words" />
        <Field label={isCredit ? "Deuda actual de la tarjeta (S/)" : "Saldo actual (S/)"} value={amountText} onChangeText={(t) => { setAmountText(t); create.resetKey(); }} placeholder="0.00" keyboardType="decimal-pad" />
        <DateField label="Fecha del saldo" value={openingDate} optional onChange={(t) => { setOpeningDate(t); create.resetKey(); }} />
        <SwitchRow label="Usarla como cuenta predeterminada" value={isDefault} onValueChange={(v) => { setIsDefault(v); create.resetKey(); }} />
        <SwitchRow label="Excluir del saldo total" value={exclude} onValueChange={(v) => { setExclude(v); create.resetKey(); }} />
      </Card>
      <Notice tone="info">El saldo inicial no cuenta como ingreso ni gasto del mes: es solo el punto de partida de esta cuenta.</Notice>
      {(formError || create.error) && <Notice tone="err">{formError ?? create.error}</Notice>}
    </Screen>
  );
}
