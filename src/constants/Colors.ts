// Sistema de color de EVA (verificado con WCAG 2.x y APCA; ver src/constants/__tests__/colors.test.ts).
//
// Capas (guía de la skill color-expert): referencia → semántica → componente.
//  · NEUTROS: la rampa de grises azulados elegida (#06141B · #11212D · #253745 · #4A5C6A · #9BA8AB · #CCD0CF) es la base de fondos,
//    tarjetas, bordes y textos. El tema claro se deriva de la misma rampa (mismo matiz, claridad invertida).
//  · MARCA: el azul queda para la acción principal (botones, enlaces, selección).
//  · SECCIONES: cada sección tiene su acento (misma claridad y croma en OKLCH, solo cambia el matiz) y se usa en íconos y fichas,
//    nunca en bloques grandes: el color es el 10% y los neutros el 90%.
//  · SEMÁNTICOS: ingreso (verde), gasto/peligro (rojo), advertencia (ámbar). income/expense/warning son para rellenos e íconos (>=3:1);
//    para escribir con ese color se usan las variantes «Strong» (>=4.5:1).

export type SectionKey = "home" | "money" | "services" | "people" | "plan" | "more";
export interface SectionColor { ink: string; tint: string }

const tintColorLight = "#0369B2";
const tintColorDark = "#68BCFB";

export const Colors = {
  light: {
    text: "#06141B",
    textSecondary: "#4A5C6A",
    muted: "#5A6A7E",
    background: "#F7F9F9",
    card: "#ECEFEF",
    elevated: "#FFFFFF",
    border: "#CCD0CF",
    borderStrong: "#6F8190",
    tint: tintColorLight,
    primary: "#0369B2",
    primarySurface: "#1A6FB5",
    onPrimary: "#FFFFFF",
    onPrimaryTint: "#FFFFFF",
    onPrimaryMuted: "#EAF3FB",
    income: "#34963A",
    incomeStrong: "#047029",
    warning: "#BA7403",
    warningStrong: "#A64A02",
    expense: "#CC1E32",
    expenseStrong: "#B91D2A",
    dangerSurface: "#B91D2A",
    tabIconDefault: "#5A6A7E",
    tabIconSelected: tintColorLight,
    sections: {
      home: { ink: "#0465AF", tint: "#E1EEFA" },
      money: { ink: "#02736E", tint: "#D9F3F0" },
      services: { ink: "#9B3B6E", tint: "#F8E6EF" },
      people: { ink: "#6A4FA9", tint: "#ECE8F8" },
      plan: { ink: "#716402", tint: "#F0EDD6" },
      more: { ink: "#576574", tint: "#E3E8EB" },
    } as Record<SectionKey, SectionColor>,
    alert: {
      success: { bg: "rgba(52,150,58,0.12)", border: "rgba(52,150,58,0.35)", icon: "#047029" },
      error: { bg: "rgba(204,30,50,0.10)", border: "rgba(204,30,50,0.35)", icon: "#B91D2A" },
      warning: { bg: "rgba(186,116,3,0.12)", border: "rgba(186,116,3,0.35)", icon: "#A64A02" },
      info: { bg: "rgba(3,105,178,0.10)", border: "rgba(3,105,178,0.30)", icon: "#0369B2" },
    },
  },
  dark: {
    text: "#CCD0CF",
    textSecondary: "#AEBBC6",
    muted: "#9BA8AB",
    background: "#06141B",
    card: "#11212D",
    elevated: "#253745",
    border: "#253745",
    borderStrong: "#5B7080",
    tint: tintColorDark,
    primary: "#68BCFB",
    primarySurface: "#14568C",
    onPrimary: "#FFFFFF",
    onPrimaryTint: "#06121B",
    onPrimaryMuted: "#DCEBF7",
    income: "#5FCB6E",
    incomeStrong: "#7BD98A",
    warning: "#FBBF24",
    warningStrong: "#FBBF24",
    expense: "#FF7E87",
    expenseStrong: "#FF979D",
    dangerSurface: "#CF3F4F",
    tabIconDefault: "#9BA8AB",
    tabIconSelected: tintColorDark,
    sections: {
      home: { ink: "#7EBDFD", tint: "#192F46" },
      money: { ink: "#3ED0C8", tint: "#033633" },
      services: { ink: "#F197C2", tint: "#412331" },
      people: { ink: "#BDA8FC", tint: "#302844" },
      plan: { ink: "#C9B957", tint: "#342E0D" },
      more: { ink: "#A9B9CA", tint: "#2A2E33" },
    } as Record<SectionKey, SectionColor>,
    alert: {
      success: { bg: "rgba(95,203,110,0.14)", border: "rgba(95,203,110,0.35)", icon: "#7BD98A" },
      error: { bg: "rgba(255,126,135,0.14)", border: "rgba(255,126,135,0.35)", icon: "#FF979D" },
      warning: { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)", icon: "#FBBF24" },
      info: { bg: "rgba(104,188,251,0.12)", border: "rgba(104,188,251,0.30)", icon: "#68BCFB" },
    },
  },
};

export type ThemeColors = typeof Colors.light;
