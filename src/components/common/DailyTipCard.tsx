import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useAppTheme } from "../../hooks/useAppTheme";

/** Consejo del día con IA, basado en tus gastos. Uno por día; si no hay datos o la IA no está disponible, no estorba. */
export default function DailyTipCard() {
  const { colors } = useAppTheme();
  const tip = useAsync(() => api.tipToday(), []);

  if (tip.loading && !tip.data) {
    return (
      <View className="mt-8 rounded-3xl p-5 border items-center" style={{ backgroundColor: colors.card, borderColor: `${colors.border}4D` }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (tip.error) return null; // sin conexión o sin IA: el inicio sigue funcionando
  const d = tip.data;
  if (!d) return null;
  if (!d.tip) {
    if (d.reason !== "AI_ERROR") return null; // sin datos suficientes / IA no disponible / tope diario: no se muestra nada
    return (
      <TouchableOpacity onPress={tip.reload} accessibilityRole="button" className="mt-8 rounded-3xl p-4 border flex-row items-center" style={{ backgroundColor: colors.card, borderColor: `${colors.border}4D` }}>
        <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        <Text className="font-asap text-sm ml-2" style={{ color: colors.textSecondary }}>No pudimos preparar el consejo de hoy. Toca para reintentar.</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View className="mt-8 rounded-3xl p-5 border" style={{ backgroundColor: colors.card, borderColor: `${colors.primary}33` }} accessibilityLabel="Consejo del día">
      <View className="flex-row items-center mb-2">
        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: `${colors.primary}18` }}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <Text className="font-asap-bold text-sm ml-2 flex-1" style={{ color: colors.text }}>Consejo del día</Text>
        {d.tip.focusLabel && <Text className="font-asap text-xs" style={{ color: colors.textSecondary }}>{d.tip.focusLabel}</Text>}
      </View>
      <Text className="font-asap text-base" style={{ color: colors.text, lineHeight: 22 }}>{d.tip.text}</Text>
      <Text className="font-asap text-xs mt-3" style={{ color: colors.textSecondary }}>Generado con IA a partir de tus registros. Es orientativo, no asesoría financiera.</Text>
    </View>
  );
}
