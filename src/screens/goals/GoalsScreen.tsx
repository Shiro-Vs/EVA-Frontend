import React from "react";
import { Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { Button, Empty, ErrorBox, Loading } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";

/** Pestaña de metas: el diseño de la tarjeta con barra de progreso, ahora con tus metas reales (reservas sobre tus cuentas). */
export default function GoalsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const goals = useAsync(() => api.goals(), []);
  const overview = useAsync(() => api.goalsOverview(), []);
  useFocusReload(() => { void goals.reload(); void overview.reload(); });

  return (
    <SafeAreaView className="flex-1 px-6" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className="font-asap-bold text-2xl mt-6" style={{ color: colors.text }}>Metas de Ahorro</Text>
        <Text className="font-asap mb-6" style={{ color: colors.textSecondary }}>
          {overview.data ? `Libre para gastar: ${formatSoles(overview.data.totals.free)} · Reservado: ${formatSoles(overview.data.totals.reserved)}` : "Tu progreso financiero"}
        </Text>

        {goals.loading && !goals.data ? <Loading /> : goals.error ? <ErrorBox message={goals.error} onRetry={goals.reload} /> : (goals.data ?? []).length === 0 ? (
          <Empty icon="flag-outline" title="Aún no tienes metas" text="Crea una y reserva dinero que ya tienes en tus cuentas: reservar no lo mueve." />
        ) : (goals.data ?? []).map((g) => {
          const pct = Math.max(0, Math.min(100, g.percent));
          const tone = g.achieved ? colors.incomeStrong : "#F59E0B";
          return (
            <TouchableOpacity key={g.id} activeOpacity={0.8} onPress={() => router.push(`/goals/${g.id}` as never)} accessibilityRole="button"
              className="p-6 rounded-3xl border mb-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <View className="flex-row justify-between mb-4">
                <View style={{ flex: 1 }}>
                  <Text className="font-asap-bold text-lg" style={{ color: colors.text }}>{g.name}</Text>
                  <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>
                    Objetivo: {formatSoles(g.targetAmount)}{g.targetDate ? ` · hasta ${humanDate(g.targetDate)}` : ""}
                  </Text>
                </View>
                <View className="p-2 rounded-xl" style={{ backgroundColor: `${tone}1A` }}>
                  <Ionicons name={g.achieved ? "checkmark-circle-outline" : "flag-outline"} size={24} color={tone} />
                </View>
              </View>
              <View className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: colors.border }}>
                <View className="h-full" style={{ backgroundColor: tone, width: `${pct}%` }} />
              </View>
              <View className="flex-row justify-between">
                <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>{g.achieved ? "¡Meta cumplida!" : `${g.percent}% completado`}</Text>
                <Text className="font-asap-bold text-xs" style={{ color: colors.text }}>{formatSoles(g.saved)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ gap: 8, marginTop: 8 }}>
          <Button title="Nueva meta" icon="add" onPress={() => router.push("/goals/new" as never)} />
          <Button title="Ver reservas por cuenta" variant="secondary" onPress={() => router.push("/goals/accounts" as never)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
