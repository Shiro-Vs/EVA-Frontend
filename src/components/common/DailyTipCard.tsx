import React, { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { todayLocalIso } from "../../utils/dates";
import GeminiMark, { AI_GRADIENT } from "./GeminiMark";
import RichText from "./RichText";

/**
 * Consejo del día de la IA: destello Gemini, borde con degradado suave y texto directo.
 * Acepta `refreshKey` para recargar cuando el usuario desliza hacia abajo en el Inicio.
 */
export default function DailyTipCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const tip = useAsync(() => api.tipToday(), []);

  useFocusReload(() => {
    if (!tip.data?.tip || tip.data.date !== todayLocalIso()) void tip.reload();
  });

  useEffect(() => {
    if (refreshKey > 0) void tip.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={[...AI_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 1.5 }}>
      <View style={{ borderRadius: 20.5, backgroundColor: colors.card, overflow: "hidden" }}>
        <LinearGradient colors={["rgba(66,133,244,0.14)", "rgba(155,114,203,0.09)", "rgba(217,101,112,0.00)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        {children}
      </View>
    </LinearGradient>
  );

  const goAnalysis = () => router.push("/analysis" as never);
  const goChats = () => router.push("/analysis/chats" as never);

  const ActionPill = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: `${colors.primary}15` }}
    >
      <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={13} color={colors.primary} />
    </TouchableOpacity>
  );

  if (tip.loading && !tip.data) {
    return (
      <Frame>
        <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GeminiMark size={20} id="load" />
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Preparando tu consejo…</Text>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Frame>
    );
  }

  const d = tip.data;
  if (!d || !d.tip || tip.error) {
    const reason = tip.error ? "AI_ERROR" : d?.reason;
    const message = reason === "NOT_ENOUGH_DATA"
      ? "Registra al menos 5 movimientos en los últimos 30 días para recibir tu consejo diario. Mientras tanto, puedes preguntarle a la IA sobre tus registros."
      : reason === "AI_LIMIT_REACHED"
        ? "Alcanzaste el tope diario de consultas con IA. Mañana se renueva."
        : reason === "AI_UNAVAILABLE"
          ? "El consejo automático no está disponible en este momento, pero puedes abrir el análisis cuando quieras."
          : "No pudimos cargar el consejo de hoy.";
    const canRetry = reason === "AI_ERROR" || !!tip.error;
    return (
      <Frame>
        <View style={{ padding: 14, gap: 8 }} accessibilityLabel="Asistente con IA">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GeminiMark size={21} id="tip-empty" />
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Asistente IA</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", lineHeight: 19 }}>{message}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
            {canRetry ? (
              <TouchableOpacity onPress={tip.reload} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="refresh" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapBold" }}>Reintentar</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", flex: 1 }}>Orientativo, no es asesoría financiera.</Text>
            )}
            <ActionPill
              label={reason === "AI_LIMIT_REACHED" ? "Ver conversaciones" : "Preguntar a la IA"}
              onPress={reason === "AI_LIMIT_REACHED" ? goChats : goAnalysis}
            />
          </View>
        </View>
      </Frame>
    );
  }

  return (
    <Frame>
      <View style={{ padding: 14, gap: 8 }} accessibilityLabel="Consejo del día">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <GeminiMark size={21} id="tip" />
          <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Consejo del día</Text>
          {d.tip.focusLabel ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${colors.primary}14`, maxWidth: "50%" }}>
              <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 11, fontFamily: "AsapSemiBold" }}>{d.tip.focusLabel}</Text>
            </View>
          ) : null}
        </View>
        <RichText text={d.tip.text} size={14} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", flex: 1 }}>Orientativo, no es asesoría financiera.</Text>
          <ActionPill label="Preguntar a la IA" onPress={goAnalysis} />
        </View>
      </View>
    </Frame>
  );
}
