import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AI_GRADIENT } from "./GeminiMark";

/** Marco con el degradado de la IA (azul → violeta → rosa) y un fondo apenas teñido: lo que «habla» la IA se ve distinto de lo demás. */
export default function AIFrame({ children, radius = 22, tint = true }: { children: React.ReactNode; radius?: number; tint?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <LinearGradient colors={[...AI_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius, padding: 1.5 }}>
      <View style={{ borderRadius: radius - 1.5, backgroundColor: colors.card, overflow: "hidden" }}>
        {tint && <LinearGradient colors={["rgba(66,133,244,0.16)", "rgba(155,114,203,0.10)", "rgba(217,101,112,0.00)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        {children}
      </View>
    </LinearGradient>
  );
}
