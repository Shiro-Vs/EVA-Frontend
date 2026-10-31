import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../api/client";
import { Button, Card, ErrorBox, Field, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { DateInput } from "../../components/v1/DatePicker";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { isIsoDate, todayLocalIso } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";

export default function SupplierPayScreen() {
  const { colors } = useAppTheme();
  const { cycleId, serviceId, announced } = useLocalSearchParams<{ cycleId: string; serviceId: string; announced: string }>();
  const accounts = useAsync(() => api.accounts(), []);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState(announced ?? "");
  const [date, setDate] = useState(todayLocalIso());

  const pay = useSubmit(async (key: string) => {
    const amt = normalizeMoneyInput(amount);
    if (!accountId) throw new Error("Elige la cuenta o tarjeta con la que se pagó.");
    if (!amt || amt === "0.00") throw new Error("Escribe el importe que realmente cobró el banco.");
    if (!isIsoDate(date)) throw new Error("La fecha debe ser AAAA-MM-DD.");
    return api.paySupplier(cycleId, { accountId, amount: amt, paidOn: date }, key);
  });
  const done = useDone();
  const save = async () => { if (await pay.submit()) done(`/service/${serviceId}`); };

  const list = (accounts.data ?? []).filter((a) => a.status === "active");
  // Cuenta por defecto: la predeterminada o la primera.
  useEffect(() => {
    if (!accountId && list.length) setAccountId((list.find((a) => a.isDefault) ?? list[0]!).id);
  }, [accountId, list]);

  return (
    <Screen title="Pago al proveedor" footer={<Button title="Registrar pago" onPress={save} busy={pay.busy} />}>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : (
        <>
          <Card>
            <Txt size={12} muted style={{ marginBottom: 6 }}>PAGADO CON</Txt>
            <View style={{ gap: 8, marginBottom: 14 }}>
              {list.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => { setAccountId(a.id); pay.resetKey(); }} accessibilityRole="radio" accessibilityState={{ selected: accountId === a.id }}
                  style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: accountId === a.id ? colors.primary : colors.border, backgroundColor: accountId === a.id ? `${colors.primary}14` : "transparent", flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontFamily: "AsapMedium" }}>{a.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Asap" }}>{formatSoles(a.balance)}</Text>
                </TouchableOpacity>
              ))}
              {list.length === 0 && <Notice tone="warn">Primero crea una cuenta desde Inicio.</Notice>}
            </View>
            <Field label="Importe realmente cobrado (S/)" value={amount} onChangeText={(t) => { setAmount(t); pay.resetKey(); }} keyboardType="decimal-pad" />
            <DateInput label="Fecha del pago" value={date} onChange={(t) => { setDate(t); pay.resetKey(); }} />
          </Card>
          <Notice tone="info">Puede diferir del precio anunciado (por ejemplo 47 en vez de 45). Pagar tarde no mueve la renovación del servicio. Si pagas con una tarjeta de crédito, aumenta la deuda de la tarjeta.</Notice>
        </>
      )}
      {pay.error && <Notice tone="err">{pay.error}</Notice>}
    </Screen>
  );
}
