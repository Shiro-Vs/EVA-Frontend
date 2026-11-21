import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { POPULAR_ICONS, PRESET_COLORS, ServiceIcon, getAdjustedColor } from "../../utils/serviceIcons";

const isLightHex = (hex: string) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
};

/** Selector de ícono y color del servicio, con tus listas `POPULAR_ICONS` y `PRESET_COLORS`. */
export function ServiceStylePicker({ icon, color, onChange }: { icon: string; color: string; onChange: (v: { icon: string; color: string }) => void }) {
  const { colors, fonts, isDark } = useAppTheme();
  const label = { fontFamily: fonts.family.semiBold, color: colors.textSecondary, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 };
  return (
    <View>
      <Text style={label}>Ícono</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingRight: 8 }}>
        {POPULAR_ICONS.map((i) => (
          <TouchableOpacity
            key={i} onPress={() => onChange({ icon: i, color })} accessibilityRole="radio" accessibilityState={{ selected: icon === i }} accessibilityLabel={i}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 6, borderWidth: 1,
              backgroundColor: icon === i ? colors.primarySurface : colors.card, borderColor: icon === i ? colors.primarySurface : colors.border }}
          >
            <ServiceIcon name={i} size={20} color={icon === i ? colors.onPrimary : colors.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={label}>Color</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 8 }}>
        {PRESET_COLORS.map((c) => {
          const shown = getAdjustedColor(c, isDark);
          const checkColor = isLightHex(shown) ? "#06141B" : "#FFFFFF";
          return (
            <TouchableOpacity
              key={c} onPress={() => onChange({ icon, color: c })} accessibilityRole="radio" accessibilityState={{ selected: color === c }} accessibilityLabel={c}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: shown,
                borderWidth: color === c ? 3 : 0, borderColor: colors.text }}
            >
              {color === c && <Ionicons name="checkmark" size={16} color={checkColor} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
