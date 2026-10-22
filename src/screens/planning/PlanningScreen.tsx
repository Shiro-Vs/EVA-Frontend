import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../hooks/useAppTheme";
import { EVALoading } from "../../components/common/EVALoading";
import { ErrorBox } from "../../components/v1/ui";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { getAdjustedColor, ServiceIcon } from "../../utils/serviceIcons";
import { humanDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";

export default function PlanningScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();

  const subs = useAsync(() => api.subscriptions(), []);
  const summary = useAsync(() => api.summary(), []);
  const reload = React.useCallback(() => { void subs.reload(); void summary.reload(); }, [subs.reload, summary.reload]);
  useFocusReload(reload);

  if ((subs.loading && !subs.data) || (summary.loading && !summary.data)) {
    return <EVALoading message="Cargando planificación..." />;
  }
  if (subs.error || summary.error) {
    return (
      <SafeAreaView className="flex-1 px-6 justify-center" style={{ backgroundColor: colors.background }}>
        <ErrorBox message={(subs.error ?? summary.error)!} onRetry={reload} />
      </SafeAreaView>
    );
  }
  const subscriptions = subs.data ?? [];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} className="px-6">
        {/* Header Section */}
        <View className="mt-6 mb-8">
          <Text className="font-asap-bold text-3xl" style={{ color: colors.text }}>Planificación</Text>
          <Text className="font-asap text-base" style={{ color: colors.textSecondary }}>Tus compromisos del ciclo</Text>
        </View>

        {/* Monthly Summary Card - Compact Version */}
        <View
          className="p-5 rounded-[28px] border mb-8 shadow-sm flex-row items-center justify-between"
          style={{ backgroundColor: colors.card, borderColor: `${colors.text}10` }}
        >
          <View>
            <Text className="font-asap-medium text-[10px] uppercase tracking-wider" style={{ color: colors.textSecondary }}>Total Comprometido</Text>
            <Text className="font-asap-bold text-2xl mt-0.5" style={{ color: colors.text }}>{formatSoles(summary.data?.subscriptions.currentCycleTotal)}</Text>

            <View className="flex-row mt-2">
              <View className="flex-row items-center mr-4">
                <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: colors.primary }} />
                <Text className="font-asap text-[10px]" style={{ color: colors.textSecondary }}>
                  {summary.data?.subscriptions.active ?? 0} {(summary.data?.subscriptions.active ?? 0) === 1 ? "servicio" : "servicios"}
                </Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: colors.muted }} />
                <Text className="font-asap text-[10px]" style={{ color: colors.textSecondary }}>Por cobrar: {formatSoles(summary.data?.receivable.pending)}</Text>
              </View>
            </View>
          </View>

          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: `${colors.primary}15` }}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
        </View>

        {/* Community & Contacts Access */}
        <TouchableOpacity
          onPress={() => router.push("/contacts")}
          className="p-4 rounded-3xl border mb-8 flex-row items-center justify-between"
          style={{ backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}15` }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
            <View>
              <Text className="font-asap-bold text-base" style={{ color: colors.text }}>Mis Contactos</Text>
              <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>Gestiona tu comunidad y deudas</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Subscriptions Section */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-asap-bold text-xl" style={{ color: colors.text }}>Suscripciones</Text>
            <TouchableOpacity
              onPress={() => router.push("/service/new")}
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${colors.primary}15` }}
              accessibilityRole="button"
            >
              <Text className="font-asap-semibold text-xs" style={{ color: colors.primary }}>+ Añadir</Text>
            </TouchableOpacity>
          </View>

          {subscriptions.length === 0 && (
            <View className="items-center py-10">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: `${colors.muted}15` }}>
                <Ionicons name="calendar-outline" size={32} color={colors.muted} />
              </View>
              <Text className="font-asap-bold text-base" style={{ color: colors.text }}>Crea tu primer servicio</Text>
              <Text className="font-asap text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                Netflix, Spotify… Registra el plan, su calendario y quién participa.
              </Text>
            </View>
          )}

          {subscriptions.map((sub) => {
            const adjustedColor = getAdjustedColor(sub.color || colors.primary, isDark);

            return (
              <TouchableOpacity
                key={sub.id}
                onPress={() => router.push(`/service/${sub.id}`)}
                className="p-4 rounded-3xl border flex-row items-center mb-4"
                style={{ backgroundColor: `${colors.card}80`, borderColor: `${colors.text}10` }}
                activeOpacity={0.7}
              >
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: `${adjustedColor}15` }}
                >
                  <ServiceIcon name={sub.icon || "receipt"} size={22} color={adjustedColor} />
                </View>

                <View className="flex-1 ml-4">
                  <View className="flex-row items-center">
                    <Text className="font-asap-bold text-base" style={{ color: colors.text }}>
                      {sub.name}
                    </Text>
                    {sub.mode === "shared" && (
                      <View
                        className="ml-2 px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: `${colors.primary}15` }}
                      >
                        <Text className="font-asap text-[8px] font-bold" style={{ color: colors.primary }}>
                          COMPARTIDO
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>
                    {sub.currentCycle ? `Se renueva el ${humanDate(sub.currentCycle.endDate)}` : "Sin ciclo en curso"}
                    {sub.mode === "shared" ? ` · ${sub.occupiedSeats}/${sub.capacity} plazas` : ""}
                  </Text>
                </View>

                <Text className="font-asap-bold text-base" style={{ color: colors.text }}>
                  {formatSoles(sub.terms?.announcedPrice)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
