import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { Card, Chip, Empty, ErrorBox, Heading, Loading, Money, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { cmpMoney } from "../../utils/money";

const TYPE_LABEL: Record<string, string> = { bank: "Cuenta bancaria", savings: "Ahorro", cash: "Efectivo", wallet: "Billetera", credit: "Tarjeta de crédito" };
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bank: "business", savings: "save", cash: "cash", wallet: "phone-portrait", credit: "card" };

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const accounts = useAsync(() => api.accounts(), []);
  const contacts = useAsync(() => api.contacts(), []);
  const subs = useAsync(() => api.subscriptions(), []);
  const reload = React.useCallback(() => { void accounts.reload(); void contacts.reload(); void subs.reload(); }, [accounts.reload, contacts.reload, subs.reload]);
  useFocusReload(reload);

  const owed = (contacts.data ?? []).filter((c) => cmpMoney(c.totals.pending, "0.00") > 0);
  const upcoming = [...(subs.data ?? [])].filter((s) => s.currentCycle).sort((a, b) => (a.currentCycle!.endDate < b.currentCycle!.endDate ? -1 : 1));

  return (
    <Screen title={`Hola, ${profile?.displayName ?? ""}`} back={false}>
      <Heading>Mis cuentas</Heading>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : (
        <>
          {(accounts.data ?? []).length === 0 && (
            <Empty icon="wallet-outline" title="Crea tu primera cuenta" text="Registra dónde está tu dinero con su saldo actual. No cuenta como ingreso." />
          )}
          {(accounts.data ?? []).map((a) => (
            <RowLink key={a.id} onPress={() => router.push(`/account/${a.id}`)}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}1A`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={TYPE_ICON[a.type] ?? "wallet"} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt bold>{a.name}</Txt>
                <Txt size={12} muted>{a.type === "credit" ? "Deuda de la tarjeta" : TYPE_LABEL[a.type]}</Txt>
              </View>
              <Money value={a.balance} tone={cmpMoney(a.balance, "0.00") < 0 ? "expense" : undefined} />
            </RowLink>
          ))}
          <TouchableOpacity onPress={() => router.push("/account/new")} style={{ alignSelf: "flex-start", paddingVertical: 6 }} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontFamily: "AsapBold" }}>+ Nueva cuenta</Text>
          </TouchableOpacity>
        </>
      )}

      <Heading>Por cobrar</Heading>
      {contacts.loading && !contacts.data ? <Loading /> : owed.length === 0 ? (
        <Card><Txt muted>Nadie te debe nada ahora mismo.</Txt></Card>
      ) : owed.map((c) => (
        <RowLink key={c.id} onPress={() => router.push(`/contact/${c.id}`)}>
          <View style={{ flex: 1 }}>
            <Txt bold>{c.name}</Txt>
            <Txt size={12} muted>{c.services} servicio{c.services === 1 ? "" : "s"} · {c.activeSeats} plaza{c.activeSeats === 1 ? "" : "s"}</Txt>
          </View>
          {cmpMoney(c.totals.overdue, "0.00") > 0 && <Chip status="overdue" />}
          <Money value={c.totals.pending} tone="expense" />
        </RowLink>
      ))}

      <Heading>Próximas renovaciones</Heading>
      {subs.loading && !subs.data ? <Loading /> : upcoming.length === 0 ? (
        <Card><Txt muted>Todavía no tienes servicios. Crea el primero en la pestaña Planes.</Txt></Card>
      ) : upcoming.map((s) => (
        <RowLink key={s.id} onPress={() => router.push(`/service/${s.id}`)}>
          <View style={{ flex: 1 }}>
            <Txt bold>{s.name}</Txt>
            <Txt size={12} muted>Se renueva el {humanDate(s.currentCycle!.endDate)}</Txt>
          </View>
          <Money value={s.terms?.announcedPrice ?? "0.00"} bold={false} tone="muted" />
        </RowLink>
      ))}
    </Screen>
  );
}
