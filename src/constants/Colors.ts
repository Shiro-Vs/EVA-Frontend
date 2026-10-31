// Sistema de color de EVA (verificado con WCAG 2.x y APCA; ver src/constants/__tests__/colors.test.ts).
//
// Hay DOS paletas, cada una con tema claro y oscuro (se elige en Más → Apariencia):
//  · Paleta 1 «Pizarra»: neutros de la rampa de grises azulados #06141B · #11212D · #253745 · #4A5C6A · #9BA8AB · #CCD0CF, azul como marca.
//  · Paleta 2 «Violeta»: base #1F0B44 · #3D256A, violeta #A64AEE como marca y naranja #F69A36 como acento cálido.
//
// Capas (guía de la skill color-expert): referencia → semántica → componente.
//  · NEUTROS: fondos, tarjetas, bordes y textos. El tema claro se deriva de la misma rampa (mismo matiz, claridad invertida).
//  · MARCA: acción principal (botones, enlaces, selección). SECCIONES: un acento por sección (misma claridad y croma en OKLCH, solo
//    cambia el matiz) en íconos y fichas, nunca en bloques grandes. FAB: el botón «+» central.
//  · SEMÁNTICOS: ingreso (verde), gasto/peligro (rojo), advertencia (ámbar). income/expense/warning son para rellenos e íconos (>=3:1);
//    para escribir con ese color se usan las variantes «Strong» (>=4.5:1). accent/accentStrong: lo mismo para el acento cálido.
//  · Todo ajuste se hizo moviendo solo la claridad en OKLCH, conservando matiz y croma (recorte de croma si sale de gamut).

export type SectionKey = "home" | "money" | "services" | "people" | "plan" | "more";
export interface SectionColor { ink: string; tint: string }
export type Sections = Record<SectionKey, SectionColor>;

// ───────────────────────── Paleta 1 · Pizarra ─────────────────────────
const slateLight = {
  text: "#06141B",
  textSecondary: "#4A5C6A",
  muted: "#5A6A7E",
  background: "#F7F9F9",
  card: "#ECEFEF",
  elevated: "#FFFFFF",
  border: "#CCD0CF",
  borderStrong: "#6F8190",
  tint: "#0369B2",
  primary: "#0369B2",
  primarySurface: "#1A6FB5",
  onPrimary: "#FFFFFF",
  onPrimaryTint: "#FFFFFF",
  onPrimaryMuted: "#EAF3FB",
  fab: "#0369B2",
  onFab: "#FFFFFF",
  accent: "#E8A317",
  onAccent: "#06141B",
  accentStrong: "#A64A02",
  income: "#34963A",
  incomeStrong: "#047029",
  warning: "#BA7403",
  warningStrong: "#A64A02",
  expense: "#CC1E32",
  expenseStrong: "#B91D2A",
  dangerSurface: "#B91D2A",
  successSurface: "#047029",
  warningSurface: "#A64A02",
  onWarning: "#FFFFFF",
  tabIconDefault: "#5A6A7E",
  tabIconSelected: "#0369B2",
  sections: {
    home: { ink: "#0465AF", tint: "#E1EEFA" },
    money: { ink: "#02736E", tint: "#D9F3F0" },
    services: { ink: "#9B3B6E", tint: "#F8E6EF" },
    people: { ink: "#6A4FA9", tint: "#ECE8F8" },
    plan: { ink: "#716402", tint: "#F0EDD6" },
    more: { ink: "#576574", tint: "#E3E8EB" },
  } as Sections,
  alert: {
    success: { bg: "rgba(52,150,58,0.12)", border: "rgba(52,150,58,0.35)", icon: "#047029" },
    error: { bg: "rgba(204,30,50,0.10)", border: "rgba(204,30,50,0.35)", icon: "#B91D2A" },
    warning: { bg: "rgba(186,116,3,0.12)", border: "rgba(186,116,3,0.35)", icon: "#A64A02" },
    info: { bg: "rgba(3,105,178,0.10)", border: "rgba(3,105,178,0.30)", icon: "#0369B2" },
  },
};

const slateDark: typeof slateLight = {
  text: "#CCD0CF",
  textSecondary: "#AEBBC6",
  muted: "#9BA8AB",
  background: "#06141B",
  card: "#11212D",
  elevated: "#253745",
  border: "#253745",
  borderStrong: "#5B7080",
  tint: "#68BCFB",
  primary: "#68BCFB",
  primarySurface: "#14568C",
  onPrimary: "#FFFFFF",
  onPrimaryTint: "#06121B",
  onPrimaryMuted: "#DCEBF7",
  fab: "#68BCFB",
  onFab: "#06121B",
  accent: "#FBBF24",
  onAccent: "#06141B",
  accentStrong: "#FBBF24",
  income: "#5FCB6E",
  incomeStrong: "#7BD98A",
  warning: "#FBBF24",
  warningStrong: "#FBBF24",
  expense: "#FF7E87",
  expenseStrong: "#FF979D",
  dangerSurface: "#C42D40",
  successSurface: "#1F7A3A",
  warningSurface: "#FBBF24",
  onWarning: "#06141B",
  tabIconDefault: "#9BA8AB",
  tabIconSelected: "#68BCFB",
  sections: {
    home: { ink: "#7EBDFD", tint: "#192F46" },
    money: { ink: "#3ED0C8", tint: "#033633" },
    services: { ink: "#F197C2", tint: "#412331" },
    people: { ink: "#BDA8FC", tint: "#302844" },
    plan: { ink: "#C9B957", tint: "#342E0D" },
    more: { ink: "#A9B9CA", tint: "#2A2E33" },
  },
  alert: {
    success: { bg: "rgba(95,203,110,0.14)", border: "rgba(95,203,110,0.35)", icon: "#7BD98A" },
    error: { bg: "rgba(255,126,135,0.14)", border: "rgba(255,126,135,0.35)", icon: "#FF979D" },
    warning: { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)", icon: "#FBBF24" },
    info: { bg: "rgba(104,188,251,0.12)", border: "rgba(104,188,251,0.30)", icon: "#68BCFB" },
  },
};

// ───────────────────────── Paleta 2 · Violeta ─────────────────────────
const violetLight: typeof slateLight = {
  text: "#1F0B44",
  textSecondary: "#5B4C82",
  muted: "#6A5C8E",
  background: "#FBF9FF",
  card: "#F1ECFA",
  elevated: "#FFFFFF",
  border: "#DDD3F0",
  borderStrong: "#8F80B1",
  tint: "#9839DE",
  primary: "#9839DE",
  primarySurface: "#8A2BD0",
  onPrimary: "#FFFFFF",
  onPrimaryTint: "#FFFFFF",
  onPrimaryMuted: "#EBDDFB",
  fab: "#F69A36",
  onFab: "#1F0B44",
  accent: "#F69A36",
  onAccent: "#1F0B44",
  accentStrong: "#9E5B04",
  income: "#34963A",
  incomeStrong: "#007D2F",
  warning: "#BE7800",
  warningStrong: "#B04F01",
  expense: "#D11F35",
  expenseStrong: "#C21F2C",
  dangerSurface: "#C21F2C",
  successSurface: "#007D2F",
  warningSurface: "#B04F01",
  onWarning: "#FFFFFF",
  tabIconDefault: "#6A5C8E",
  tabIconSelected: "#9839DE",
  sections: {
    home: { ink: "#764AA2", tint: "#F4ECFF" },
    money: { ink: "#925002", tint: "#FFECDE" },
    services: { ink: "#9B3B6E", tint: "#FFE9F2" },
    people: { ink: "#2063B0", tint: "#E7F1FF" },
    plan: { ink: "#09736A", tint: "#DBF7F3" },
    more: { ink: "#665F75", tint: "#F2EDFF" },
  },
  alert: {
    success: { bg: "rgba(52,150,58,0.12)", border: "rgba(52,150,58,0.35)", icon: "#007D2F" },
    error: { bg: "rgba(209,31,53,0.10)", border: "rgba(209,31,53,0.35)", icon: "#C21F2C" },
    warning: { bg: "rgba(190,120,0,0.12)", border: "rgba(190,120,0,0.35)", icon: "#B04F01" },
    info: { bg: "rgba(152,57,222,0.10)", border: "rgba(152,57,222,0.30)", icon: "#9839DE" },
  },
};

const violetDark: typeof slateLight = {
  text: "#F6F2FC",
  textSecondary: "#CBBFE3",
  muted: "#B3A3D3",
  background: "#1F0B44",
  card: "#2A1558",
  elevated: "#3D256A",
  border: "#3D256A",
  borderStrong: "#6D5C96",
  tint: "#D0A4FE",
  primary: "#D0A4FE",
  primarySurface: "#7A2DC2",
  onPrimary: "#FFFFFF",
  onPrimaryTint: "#1F0B44",
  onPrimaryMuted: "#E9DCFB",
  fab: "#F69A36",
  onFab: "#1F0B44",
  accent: "#F69A36",
  onAccent: "#1F0B44",
  accentStrong: "#F69A36",
  income: "#60CC6F",
  incomeStrong: "#7BD98A",
  warning: "#FBBF24",
  warningStrong: "#FBBF24",
  expense: "#FE8189",
  expenseStrong: "#FD9BA1",
  dangerSurface: "#C42D40",
  successSurface: "#1F7A3A",
  warningSurface: "#FBBF24",
  onWarning: "#1F0B44",
  tabIconDefault: "#B3A3D3",
  tabIconSelected: "#D0A4FE",
  sections: {
    home: { ink: "#C9A3F5", tint: "#342742" },
    money: { ink: "#EFA464", tint: "#402712" },
    services: { ink: "#F197C2", tint: "#412331" },
    people: { ink: "#85BAFF", tint: "#1C2F46" },
    plan: { ink: "#44D0C1", tint: "#053631" },
    more: { ink: "#BAB3CB", tint: "#302A3D" },
  },
  alert: {
    success: { bg: "rgba(96,204,111,0.14)", border: "rgba(96,204,111,0.35)", icon: "#7BD98A" },
    error: { bg: "rgba(254,129,137,0.14)", border: "rgba(254,129,137,0.35)", icon: "#FD9BA1" },
    warning: { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)", icon: "#FBBF24" },
    info: { bg: "rgba(208,164,254,0.12)", border: "rgba(208,164,254,0.30)", icon: "#D0A4FE" },
  },
};

export type PaletteId = "slate" | "violet";
export type ThemeColors = typeof slateLight;
export type ThemeMode = "light" | "dark";

export const Palettes: Record<PaletteId, Record<ThemeMode, ThemeColors>> = {
  slate: { light: slateLight, dark: slateDark },
  violet: { light: violetLight, dark: violetDark },
};

export const PALETTE_INFO: Record<PaletteId, { label: string; text: string }> = {
  slate: { label: "Paleta 1 · Pizarra", text: "Grises azulados con azul de marca" },
  violet: { label: "Paleta 2 · Violeta", text: "Violeta profundo con acento naranja" },
};

/** Paleta por defecto (la 1). Se conserva por compatibilidad con código que importa `Colors` directamente. */
export const Colors = Palettes.slate;
