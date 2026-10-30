// Paleta verificada con WCAG 2.x y APCA (auditoría de color de la sesión):
//  · todo token de TEXTO (textSecondary, muted, primary, incomeStrong, expenseStrong, warningStrong) cumple >=4.5:1 sobre fondo y tarjeta,
//    y APCA Lc>=60 (cuerpo) en claro; en oscuro Lc>=50-60 según el rol.
//  · income / expense / warning son para RELLENOS e ÍCONOS (>=3:1); para escribir con ese color se usa la variante «Strong».
//  · Los ajustes se hicieron moviendo solo la claridad en OKLCH, conservando matiz y croma.
const tintColorLight = "#0A71BC";
const tintColorDark = "#6CBFFE";

export const Colors = {
  light: {
    text: "#0C1B26",
    textSecondary: "#65717E",
    muted: "#607185",
    background: "#FFFFFF",
    card: "#F1F4F7",
    elevated: "#FFFFFF",
    border: "#E2E8F0",
    borderStrong: "#78899E",
    tint: tintColorLight,
    primary: "#0A71BC",
    primarySurface: "#1A6FB5",
    onPrimary: "#FFFFFF",
    onPrimaryTint: "#FFFFFF",
    onPrimaryMuted: "#EAF3FB",
    income: "#3CA042",
    incomeStrong: "#0C8133",
    warning: "#C47E10",
    warningStrong: "#B45309",
    expense: "#D62639",
    expenseStrong: "#C21F2C",
    dangerSurface: "#C21F2C",
    tabIconDefault: "#607185",
    tabIconSelected: tintColorLight,
    alert: {
      success: { bg: "rgba(60,160,66,0.12)", border: "rgba(60,160,66,0.35)", icon: "#0C8133" },
      error: { bg: "rgba(214,38,57,0.10)", border: "rgba(214,38,57,0.35)", icon: "#C21F2C" },
      warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", icon: "#B45309" },
      info: { bg: "rgba(10,113,188,0.10)", border: "rgba(10,113,188,0.30)", icon: "#0A71BC" },
    },
  },
  dark: {
    text: "#F1F5F9",
    textSecondary: "#ACBAC6",
    muted: "#96A9B9",
    background: "#0B141C",
    card: "#16222E",
    elevated: "#1E2C3A",
    border: "#2A3B4D",
    borderStrong: "#5E7B96",
    tint: tintColorDark,
    primary: "#6CBFFE",
    primarySurface: "#14568C",
    onPrimary: "#FFFFFF",
    onPrimaryTint: "#06121B",
    onPrimaryMuted: "#DCEBF7",
    income: "#62CE70",
    incomeStrong: "#7BD98A",
    warning: "#FBBF24",
    warningStrong: "#FBBF24",
    expense: "#FF7E87",
    expenseStrong: "#FF9CA2",
    dangerSurface: "#CF3F4F",
    tabIconDefault: "#96A9B9",
    tabIconSelected: tintColorDark,
    alert: {
      success: { bg: "rgba(98,206,112,0.14)", border: "rgba(98,206,112,0.35)", icon: "#7BD98A" },
      error: { bg: "rgba(255,126,135,0.14)", border: "rgba(255,126,135,0.35)", icon: "#FF9CA2" },
      warning: { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)", icon: "#FBBF24" },
      info: { bg: "rgba(108,191,254,0.12)", border: "rgba(108,191,254,0.30)", icon: "#6CBFFE" },
    },
  },
};

export type ThemeColors = typeof Colors.light;
