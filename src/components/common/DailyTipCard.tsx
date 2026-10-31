import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { plainText } from "../../utils/richText";
import RichText from "./RichText";

/** Consejo del día con IA, basado en tus gastos. Uno por día; resumido en 3 líneas y se despliega al tocarlo. Si no hay datos o la IA no está disponible, no estorba. */
export default function DailyTipCard() {
  const { colors } = useAppTheme();
  const tip = useAsync(() => api.tipToday(), []);
  const [open, setOpen] = useState(false);

  const box = { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 12 } as const;
  if (tip.loading && !tip.data) return <View style={{ ...box, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  if (tip.error) return null; // sin conexión o sin IA: el inicio sigue funcionando
  const d = tip.data;
  if (!d) return null;
  if (!d.tip) {
    if (d.reason !== "AI_ERROR") return null; // sin datos suficientes / IA no disponible / tope diario: no se muestra nada
    return (
      <TouchableOpacity onPress={tip.reload} accessibilityRole="button" style={{ ...box, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>No pudimos preparar el consejo de hoy. Toca para reintentar.</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel="Consejo del día" accessibilityState={{ expanded: open }} style={box}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.accent}33` }}>
          <Ionicons name="sparkles" size={15} color={colors.accentStrong} />
        </View>
        <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>Consejo del día</Text>
        {d.tip.focusLabel ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", maxWidth: "45%" }}>{d.tip.focusLabel}</Text> : null}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </View>
      {open ? (
        <>
          <RichText text={d.tip.text} size={14} />
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", marginTop: 8 }}>Generado con IA a partir de tus registros. Es orientativo, no asesoría financiera.</Text>
        </>
      ) : (
        <Text numberOfLines={3} style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: "Asap" }}>{plainText(d.tip.text)}</Text>
      )}
    </TouchableOpacity>
  );
}
