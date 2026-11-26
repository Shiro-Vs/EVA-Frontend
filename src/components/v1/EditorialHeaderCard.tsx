import React from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../../hooks/useAppTheme";

/**
 * Tarjeta editorial de cabecera sin borde: fondo limpio (`colors.card`) con un patrón
 * muy sutil de líneas curvas finas en la esquina superior derecha tintadas con la paleta activa.
 */
export function EditorialHeaderCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, isDark } = useAppTheme();
  const baseOpacity = isDark ? 0.14 : 0.10;

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: 18,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, right: 0, width: 190, height: 150 }}
      >
        <Svg width="190" height="150" viewBox="0 0 190 150" fill="none">
          <Path d="M40 -10 C 85 38, 130 62, 200 68" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity * 0.55} />
          <Path d="M62 -10 C 102 32, 142 52, 200 56" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity * 0.72} />
          <Path d="M84 -10 C 118 26, 154 42, 200 44" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity * 0.9} />
          <Path d="M106 -10 C 134 20, 165 32, 200 33" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity} />
          <Path d="M128 -10 C 150 14, 174 22, 200 22" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity * 0.85} />
          <Path d="M150 -10 C 166 8, 182 13, 200 13" stroke={colors.primary} strokeWidth="1" strokeOpacity={baseOpacity * 0.65} />
        </Svg>
      </View>
      {children}
    </View>
  );
}
