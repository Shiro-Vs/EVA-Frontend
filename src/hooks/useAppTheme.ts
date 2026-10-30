import { Palettes } from "../constants/Colors";
import { FontFamilies, FontSizes } from "../constants/Fonts";
import { useAppThemeContext } from "../context/ThemeContext";

/**
 * Hook para obtener los colores y fuentes del tema actual
 * Útil para componentes que requieren estilos en sus props (como Ionicons o Text)
 */
export function useAppTheme() {
  const { theme, fontFamily, palette } = useAppThemeContext();

  const currentTheme = theme === "dark" ? "dark" : "light";
  // Obtener la familia de fuentes actual desde el contexto
  const currentFontFamily = FontFamilies[fontFamily] || FontFamilies.asap;
  
  return {
    colors: (Palettes[palette] ?? Palettes.slate)[currentTheme],
    fonts: {
      family: currentFontFamily,
      size: FontSizes
    },
    theme: currentTheme,
    isDark: currentTheme !== "light",
  };
}
