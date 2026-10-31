import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { POPULAR_ICONS, PRESET_COLORS, ServiceIcon, getAdjustedColor } from "../../utils/serviceIcons";

/** Selector de ícono y color del servicio, con tus listas `POPULAR_ICONS` y `PRESET_COLORS`. */
export function ServiceStylePicker({ icon, color, onChange }: { icon: string; color: string; onChange: (v: { icon: string; color: string }) => void }) {
  const { colors, fonts, isDark } = useAppTheme();
  const label = { fontFamily: fonts.family.semiBold, color: colors.textSecondary, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 };
  return (
    <View>
      <Text style={label}>Ícono</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {POPULAR_ICONS.map((i) => (
          <TouchableOpacity
            key={i} onPress={() => onChange({ icon: i, color })} accessibilityRole="radio" accessibilityState={{ selected: icon === i }} accessibilityLabel={i}
            style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 6, borderWidth: 1,
              backgroundColor: icon === i ? colors.primary : colors.card, borderColor: icon === i ? colors.primary : `${colors.text}05` }}
          >
            <ServiceIcon name={i} size={20} color={icon === i ? "white" : colors.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={label}>Color</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {PRESET_COLORS.map((c) => (
          <TouchableOpacity
            key={c} onPress={() => onChange({ icon, color: c })} accessibilityRole="radio" accessibilityState={{ selected: color === c }} accessibilityLabel={c}
            style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: getAdjustedColor(c, isDark),
              borderWidth: color === c ? 3 : 0, borderColor: colors.text }}
          >
            {color === c && <Ionicons name="checkmark" size={16} color="white" />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
