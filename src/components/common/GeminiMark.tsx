import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/** Colores del destello de la IA (azul → violeta → rosa). */
export const AI_GRADIENT = ["#4285F4", "#9B72CB", "#D96570"] as const;

/** Destello de cuatro puntas con degradado: la marca visual de «esto lo hizo la IA». */
export default function GeminiMark({ size = 20, id = "g" }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`ai-${id}`} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={AI_GRADIENT[0]} />
          <Stop offset="0.55" stopColor={AI_GRADIENT[1]} />
          <Stop offset="1" stopColor={AI_GRADIENT[2]} />
        </LinearGradient>
      </Defs>
      <Path d="M12 0C12.7 6.7 17.3 11.3 24 12C17.3 12.7 12.7 17.3 12 24C11.3 17.3 6.7 12.7 0 12C6.7 11.3 11.3 6.7 12 0Z" fill={`url(#ai-${id})`} />
    </Svg>
  );
}
