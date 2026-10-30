import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../hooks/useAppTheme";
import { api } from "../../api/client";
import type { Summary } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { ErrorBox } from "../../components/v1/ui";
import DailyTipCard from "../../components/common/DailyTipCard";
import type { SectionKey } from "../../constants/Colors";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const { width } = Dimensions.get("window");

const KIND: Record<Summary["recent"][number]["kind"], { icon: keyof typeof Ionicons.glyphMap; label: string; tone: "income" | "warning" | "primary" | "muted" }> = {
  income: { icon: "cash", label: "Ingreso", tone: "income" },
  expense: { icon: "cart", label: "Gasto", tone: "warning" },
  transfer: { icon: "swap-horizontal", label: "Transferencia", tone: "primary" },
  adjustment: { icon: "construct", label: "Ajuste", tone: "muted" },
  reversal: { icon: "refresh", label: "Reversión", tone: "muted" },
};

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const data = useAsync(() => api.summary(), []);
  useFocusReload(data.reload);

  if (data.loading && !data.data) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (data.error || !data.data) {
    return (
      <SafeAreaView className="flex-1 px-6 justify-center" style={{ backgroundColor: colors.background }}>
        <ErrorBox message={data.error ?? "No se pudo cargar el inicio."} onRetry={data.reload} />
      </SafeAreaView>
    );
  }
  const s = data.data;
  const owed = cmpMoney(s.receivable.pending, "0.00") > 0;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} className="px-6">
        {/* Header */}
        <View className="flex-row justify-between items-center mt-6 mb-8">
          <View>
            <Text className="font-asap text-base" style={{ color: colors.textSecondary }}>
              Bienvenido de nuevo,
            </Text>
            <Text className="font-asap-bold text-2xl" style={{ color: colors.text }}>
              {profile?.displayName} 👋
            </Text>
          </View>
          <TouchableOpacity
            className="w-12 h-12 rounded-2xl items-center justify-center border"
            style={{ backgroundColor: colors.card, borderColor: `${colors.border}80` }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {s.receivable.debtors > 0 && (
              <View className="absolute top-3 right-3 w-2 h-2 rounded-full border-2" style={{ backgroundColor: colors.expense, borderColor: colors.card }} />
            )}
          </TouchableOpacity>
        </View>

        {/* Balance Card - Premium Design */}
        <View
          className="rounded-[32px] p-8 shadow-xl relative overflow-hidden"
          style={{ width: width - 48, backgroundColor: colors.primarySurface }}
        >
          {/* Círculos decorativos de fondo */}
          <View className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <View className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.1)" }} />

          <View className="flex-row justify-between items-start">
            <View>
              <Text className="font-asap-medium text-sm uppercase tracking-widest" style={{ color: colors.onPrimaryMuted }}>
                Saldo Total
              </Text>
              <Text className="font-asap-bold text-4xl mt-1" style={{ color: colors.onPrimary }}>
                {formatSoles(s.balance.net)}
              </Text>
            </View>
            <View className="p-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Ionicons name="wallet-outline" size={24} color={colors.onPrimary} />
            </View>
          </View>

          <View className="mt-8 flex-row items-center">
            <View className="flex-row items-center px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Ionicons name={owed ? "people" : "checkmark-circle"} size={16} color={colors.income} />
              <Text className="font-asap-semibold text-xs ml-1" style={{ color: colors.onPrimary }}>
                {owed ? `Por cobrar ${formatSoles(s.receivable.pending)}` : "Todo al día"}
              </Text>
            </View>
            <Text className="font-asap-medium text-xs ml-3" style={{ color: colors.onPrimaryMuted }}>
              {s.balance.accounts} {s.balance.accounts === 1 ? "cuenta" : "cuentas"}
            </Text>
          </View>
        </View>

        <DailyTipCard />

        {/* Quick Actions */}
        <View className="flex-row justify-between mt-10">
          {[
            { label: "Cobrar", icon: "cash-outline", section: "money", to: "/people" },
            { label: "Servicios", icon: "calendar-outline", section: "services", to: "/planning" },
            { label: "Capturar", icon: "scan-outline", section: "people", to: "/capture/new" },
            { label: "Análisis", icon: "sparkles-outline", section: "plan", to: "/analysis" },
          ].map((action, index) => (
            <View key={index} className="items-center">
              <TouchableOpacity
                onPress={() => router.push(action.to as never)}
                className="w-16 h-16 rounded-2xl items-center justify-center shadow-sm border"
                style={{ backgroundColor: colors.sections[action.section as SectionKey].tint, borderColor: "transparent" }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Ionicons name={action.icon as any} size={26} color={colors.sections[action.section as SectionKey].ink} />
              </TouchableOpacity>
              <Text className="font-asap-medium text-xs mt-2" style={{ color: colors.textSecondary }}>
                {action.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Mis cuentas */}
        <AccountsSection />

        {/* Recent Transactions Section */}
        <View className="mt-10 mb-10">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-asap-bold text-xl" style={{ color: colors.text }}>
              Actividad Reciente
            </Text>
          </View>

          {s.recent.length === 0 && (
            <View className="items-center py-8">
              <Text className="font-asap text-sm" style={{ color: colors.textSecondary }}>
                Aún no hay movimientos. Registra un cobro o un pago y aparecerá aquí.
              </Text>
            </View>
          )}

          {s.recent.map((tx) => {
            const meta = KIND[tx.kind];
            const iconColor = meta.tone === "income" ? colors.income : meta.tone === "warning" ? colors.warning : meta.tone === "primary" ? colors.primary : colors.muted;
            const positive = cmpMoney(tx.amount, "0.00") > 0;
            const reversed = tx.status === "reversed";
            return (
              <View
                key={tx.id}
                className="flex-row items-center mb-4 p-4 rounded-3xl border"
                style={{ backgroundColor: `${colors.card}66`, borderColor: `${colors.border}33`, opacity: reversed ? 0.55 : 1 }}
              >
                <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
                  <Ionicons name={meta.icon} size={22} color={iconColor} />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="font-asap-bold text-base" style={{ color: colors.text }} numberOfLines={1}>
                    {tx.description || meta.label}
                  </Text>
                  <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>
                    {meta.label} · {tx.account.name}{reversed ? " · revertido" : ""}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-asap-bold text-base" style={{ color: positive ? colors.incomeStrong : colors.text }}>
                    {positive ? "+" : "-"}{formatSoles(tx.amount.replace("-", ""))}
                  </Text>
                  <Text className="font-asap text-[10px]" style={{ color: colors.textSecondary }}>
                    {tx.occurredOn === s.asOf ? "Hoy" : humanDate(tx.occurredOn)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Cuentas con su saldo, con el mismo estilo de tarjetas de la app. */
function AccountsSection() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const accounts = useAsync(() => api.accounts(), []);
  useFocusReload(accounts.reload);
  const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bank: "business", savings: "save", cash: "cash", wallet: "phone-portrait", credit: "card" };

  return (
    <View className="mt-10">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="font-asap-bold text-xl" style={{ color: colors.text }}>Mis Cuentas</Text>
        <TouchableOpacity onPress={() => router.push("/account/new")} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: `${colors.primary}15` }} accessibilityRole="button">
          <Text className="font-asap-semibold text-xs" style={{ color: colors.primary }}>+ Añadir</Text>
        </TouchableOpacity>
      </View>
      {(accounts.data ?? []).length === 0 && !accounts.loading && (
        <Text className="font-asap text-sm mb-2" style={{ color: colors.textSecondary }}>
          Crea tu primera cuenta con su saldo actual. No cuenta como ingreso del mes.
        </Text>
      )}
      {(accounts.data ?? []).filter((a) => a.status === "active").map((a) => (
        <TouchableOpacity
          key={a.id}
          onPress={() => router.push(`/account/${a.id}`)}
          className="p-4 rounded-3xl border flex-row items-center mb-4"
          style={{ backgroundColor: `${colors.card}80`, borderColor: `${colors.text}10` }}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: `${colors.primary}15` }}>
            <Ionicons name={ICON[a.type] ?? "wallet"} size={22} color={colors.primary} />
          </View>
          <View className="flex-1 ml-4">
            <Text className="font-asap-bold text-base" style={{ color: colors.text }}>{a.name}</Text>
            <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>{a.type === "credit" ? "Deuda de la tarjeta" : "Saldo disponible"}</Text>
          </View>
          <Text className="font-asap-bold text-base" style={{ color: cmpMoney(a.balance, "0.00") < 0 ? colors.expenseStrong : colors.text }}>
            {formatSoles(a.balance)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
