import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { PALETTE_INFO, Palettes, type PaletteId } from "../../constants/Colors";
import { useAppThemeContext } from "../../context/ThemeContext";
import { useAppTheme } from "../../hooks/useAppTheme";

const MODES: Array<["light" | "dark" | "system", string]> = [["light", "Claro"], ["dark", "Oscuro"], ["system", "Sistema"]];

/** Elige la paleta (1 o 2) y el modo (claro, oscuro o el del teléfono). Cada paleta trae su tema claro y su tema oscuro. */
export default function AppearanceCard({ bare }: { bare?: boolean }) {
  const { colors } = useAppTheme();
  const { palette, setPalette, themePreference, setTheme, theme } = useAppThemeContext();

  return (
    <View style={bare ? { gap: 14, paddingBottom: 8 } : { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 }}>
      <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Paleta de color</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {(Object.keys(PALETTE_INFO) as PaletteId[]).map((id) => {
          const sample = Palettes[id][theme === "dark" ? "dark" : "light"];
          const on = palette === id;
          return (
            <TouchableOpacity key={id} onPress={() => setPalette(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={PALETTE_INFO[id].label}
              activeOpacity={0.8} style={{ width: "48%", flexGrow: 1, minWidth: 136, borderRadius: 18, padding: 10, gap: 8, backgroundColor: colors.background, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.borderStrong }}>
              <View style={{ flexDirection: "row", height: 34, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                {[sample.background, sample.card, sample.primarySurface, sample.fab, sample.accent].map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
              </View>
              <View>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold" }}>{PALETTE_INFO[id].label}</Text>
                <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{PALETTE_INFO[id].text}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Modo</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {MODES.map(([id, label]) => {
          const on = themePreference === id;
          return (
            <TouchableOpacity key={id} onPress={() => setTheme(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} activeOpacity={0.8}
              style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.primarySurface : `${colors.primary}14` }}>
              <Text style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 13, fontFamily: "AsapBold" }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
