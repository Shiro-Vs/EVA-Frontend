import type { AccountType } from "../api/types";

/**
 * Diseños predeterminados para las tarjetas de cuenta: colores de marca de las entidades más usadas.
 * Son colores de marca (como los de los servicios), por eso están fijos y no salen de la paleta de la app.
 * No se usan logos: solo el nombre de la entidad sobre sus colores.
 */
export interface BankPreset {
  id: string;
  label: string;
  /** Degradado de la tarjeta (de arriba a la izquierda a abajo a la derecha). */
  colors: [string, string];
  /** Texto sobre la tarjeta y su versión atenuada. */
  ink: string;
  soft: string;
  /** Tipo de cuenta más probable, para sugerirlo al elegir la entidad. */
  type: AccountType;
  /** Fragmentos (en minúsculas y sin tildes) con los que se reconoce la entidad en el nombre o la entidad de una cuenta. */
  match: string[];
}

export const BANK_PRESETS: BankPreset[] = [
  { id: "bcp", label: "BCP", colors: ["#0A3FA8", "#002A8D"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)", type: "bank", match: ["bcp", "credito del peru"] },
  { id: "interbank", label: "Interbank", colors: ["#00B14F", "#00813A"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)", type: "bank", match: ["interbank", "ibk"] },
  { id: "bbva", label: "BBVA", colors: ["#1464A5", "#072146"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)", type: "bank", match: ["bbva", "continental"] },
  { id: "scotiabank", label: "Scotiabank", colors: ["#EC111A", "#B00D14"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)", type: "bank", match: ["scotia"] },
  { id: "yape", label: "Yape", colors: ["#8A2BA0", "#5C1873"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)", type: "wallet", match: ["yape"] },
  { id: "plin", label: "Plin", colors: ["#19D3C5", "#0A9C94"], ink: "#04302E", soft: "rgba(4,48,46,0.72)", type: "wallet", match: ["plin"] },
  { id: "mercadopago", label: "Mercado Pago", colors: ["#00A8E8", "#0077B6"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)", type: "wallet", match: ["mercado pago", "mercadopago"] },
  { id: "bn", label: "Banco de la Nación", colors: ["#C8102E", "#7F091D"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)", type: "bank", match: ["nacion", "banco de la nacion"] },
  { id: "falabella", label: "Banco Falabella", colors: ["#65A30D", "#3F6212"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)", type: "credit", match: ["falabella", "cmr"] },
  { id: "ripley", label: "Banco Ripley", colors: ["#6D28D9", "#3B0764"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)", type: "credit", match: ["ripley"] },
];

export interface CardColorTheme {
  id: string;
  label: string;
  colors: [string, string];
  ink: string;
  soft: string;
}

/** Acabados de color personalizables para cualquier tarjeta de cuenta (se guarda el `id` en `account.color`). */
export const CARD_THEMES: CardColorTheme[] = [
  { id: "obsidian", label: "Black", colors: ["#242A36", "#0D1017"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.72)" },
  { id: "titanium", label: "Titanio", colors: ["#64748B", "#334155"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)" },
  { id: "gold", label: "Oro", colors: ["#C99A3B", "#855C14"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)" },
  { id: "ocean", label: "Azul", colors: ["#0A47B5", "#00246B"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)" },
  { id: "emerald", label: "Esmeralda", colors: ["#059669", "#065F46"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)" },
  { id: "crimson", label: "Rubí", colors: ["#DC2626", "#991B1B"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)" },
  { id: "violet", label: "Violeta", colors: ["#7C3AED", "#4C1D95"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.80)" },
  { id: "teal", label: "Turquesa", colors: ["#0D9488", "#115E59"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)" },
  { id: "sunset", label: "Naranja", colors: ["#EA580C", "#9A3412"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)" },
  { id: "rose", label: "Rosa", colors: ["#DB2777", "#9D174D"], ink: "#FFFFFF", soft: "rgba(255,255,255,0.82)" },
];

export type CardPattern = "circles" | "diagonal" | "waves" | "minimal";

export const CARD_PATTERNS: Array<{ id: CardPattern; label: string }> = [
  { id: "circles", label: "Clásico" },
  { id: "diagonal", label: "Metálico" },
  { id: "waves", label: "Ondas" },
  { id: "minimal", label: "Minimal" },
];

export function cardThemeById(color?: string | null): CardColorTheme | null {
  if (!color) return null;
  const hit = CARD_THEMES.find((t) => t.id === color);
  if (hit) return hit;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { id: color, label: "Personalizado", colors: [color, color], ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)" };
  }
  return null;
}

export function normalizeCardPattern(icon?: string | null): CardPattern {
  if (icon === "diagonal" || icon === "waves" || icon === "minimal") return icon;
  return "circles";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Diseño de una cuenta según su entidad o, si no la tiene, según su nombre. `null` si no es una entidad conocida. */
export function bankPreset(institution?: string | null, name?: string | null): BankPreset | null {
  for (const text of [institution, name]) {
    if (!text) continue;
    const t = norm(text);
    const hit = BANK_PRESETS.find((b) => b.match.some((m) => t.includes(m)));
    if (hit) return hit;
  }
  return null;
}
