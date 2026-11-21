import React from "react";
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
 * Consejo del día de la IA. Tiene aspecto de asistente: destello con degradado, borde con degradado azul-violeta-rosa y un
 * fondo apenas teñido. El texto va completo (son pocas líneas). Si no hay datos o la IA no está disponible, no estorba.
 */
export default function DailyTipCard() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const tip = useAsync(() => api.tipToday(), []);
  useFocusReload(() => {
    if (!tip.data?.tip || tip.data.date !== todayLocalIso()) void tip.reload();
  });

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={[...AI_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 1.5 }}>
      <View style={{ borderRadius: 20.5, backgroundColor: colors.card, overflow: "hidden" }}>
        <LinearGradient colors={["rgba(66,133,244,0.16)", "rgba(155,114,203,0.10)", "rgba(217,101,112,0.00)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        {children}
      </View>
    </LinearGradient>
  );

  if (tip.loading && !tip.data) {
    return <Frame><View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}><GeminiMark size={20} id="load" /><Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Preparando tu consejo…</Text><ActivityIndicator color={colors.primary} /></View></Frame>;
  }
  if (tip.error) return null; // sin conexión o sin IA: el inicio sigue funcionando
  const d = tip.data;
  if (!d) return null;
  if (!d.tip) {
    if (d.reason !== "AI_ERROR") return null; // sin datos suficientes / IA no disponible / tope diario: no se muestra nada
    return (
      <TouchableOpacity onPress={tip.reload} accessibilityRole="button">
        <Frame><View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="refresh" size={18} color={colors.textSecondary} /><Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>No pudimos preparar el consejo de hoy. Toca para reintentar.</Text></View></Frame>
      </TouchableOpacity>
    );
  }
  return (
    <Frame>
      <View style={{ padding: 14, gap: 8 }} accessibilityLabel="Consejo del día">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <GeminiMark size={22} id="tip" />
          <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Consejo del día</Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(155,114,203,0.20)" }}>
            <Text style={{ color: colors.text, fontSize: 11, fontFamily: "AsapBold", letterSpacing: 0.6 }}>IA · GEMINI</Text>
          </View>
          <View style={{ flex: 1 }} />
          {d.tip.focusLabel ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", maxWidth: "36%" }}>{d.tip.focusLabel}</Text> : null}
        </View>
        <RichText text={d.tip.text} size={14} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", flex: 1 }}>Orientativo, no es asesoría financiera.</Text>
          <TouchableOpacity onPress={() => router.push("/analysis" as never)} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Preguntar a la IA ›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Frame>
  );
}
