import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PaletteId } from "../constants/Colors";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ResolvedTheme;
  themePreference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  /** Paleta de color elegida (cada una tiene tema claro y oscuro). */
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
  isDark: boolean;
  /** Ya se leyeron el modo y la paleta guardados (antes de eso los colores pueden ser los de por defecto). */
  loaded: boolean;
  fontFamily: "asap" | "roboto";
  setFontFamily: (font: "asap" | "roboto") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "eva.theme_preference";
const PALETTE_KEY = "eva.palette";

const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference === "system") {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  }
  return preference;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [theme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme("system"));
  const [fontFamily, setFontFamilyState] = useState<"asap" | "roboto">("asap");
  const [palette, setPaletteState] = useState<PaletteId>("slate");
  const [loaded, setLoaded] = useState(false);

  // Cargar el modo y la paleta guardados al arrancar; hasta entonces `loaded` es falso.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY).catch(() => null), AsyncStorage.getItem(PALETTE_KEY).catch(() => null)]).then(([pref, pal]) => {
      if (pref === "light" || pref === "dark" || pref === "system") {
        setThemePreferenceState(pref);
        setResolvedTheme(resolveTheme(pref));
      }
      if (pal === "slate" || pal === "violet") setPaletteState(pal);
      setLoaded(true);
    });
  }, []);

  // Si la preferencia es "system", seguir los cambios del SO en vivo
  useEffect(() => {
    if (themePreference !== "system") return;
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setResolvedTheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, [themePreference]);

  const setTheme = (newPreference: ThemePreference) => {
    setThemePreferenceState(newPreference);
    setResolvedTheme(resolveTheme(newPreference));
    AsyncStorage.setItem(STORAGE_KEY, newPreference);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const setPalette = (next: PaletteId) => {
    setPaletteState(next);
    AsyncStorage.setItem(PALETTE_KEY, next).catch(() => {});
  };

  const setFontFamily = (newFont: "asap" | "roboto") => setFontFamilyState(newFont);

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider
      value={{ theme, themePreference, setTheme, toggleTheme, palette, setPalette, isDark, loaded, fontFamily, setFontFamily }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useAppThemeContext must be used within a ThemeProvider");
  }
  return context;
}
