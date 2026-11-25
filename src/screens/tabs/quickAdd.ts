import { useSyncExternalStore } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { SectionKey } from "../../constants/Colors";

// Estado de la hoja de acciones rápidas del botón «+» (la barra inferior la abre, el layout la dibuja).
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const quickAdd = {
  get: () => open,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  open() { if (!open) { open = true; emit(); } },
  close() { if (open) { open = false; emit(); } },
};

export const useQuickAddOpen = () => useSyncExternalStore(quickAdd.subscribe, quickAdd.get, quickAdd.get);

export type QuickIcon = keyof typeof Ionicons.glyphMap;
export type QuickTone = "expense" | "income" | "primary";

export interface PrimaryQuickAction {
  id: string;
  icon: QuickIcon;
  title: string;
  to: string;
  tone: QuickTone;
}

export interface QuickAction {
  icon: QuickIcon;
  title: string;
  text: string;
  to: string;
  section: SectionKey;
}

/** Movimientos del día a día: 1 toque directo al tipo elegido. */
export const PRIMARY_MOVEMENTS: PrimaryQuickAction[] = [
  { id: "expense", icon: "arrow-up-circle-outline", title: "Gasto", to: "/operation/new?kind=expense", tone: "expense" },
  { id: "income", icon: "arrow-down-circle-outline", title: "Ingreso", to: "/operation/new?kind=income", tone: "income" },
  { id: "transfer", icon: "swap-horizontal-outline", title: "Transferir", to: "/operation/new?kind=transfer", tone: "primary" },
];

/** Acciones frecuentes de registro asistido y cobros. */
export const FEATURED_ACTIONS: QuickAction[] = [
  { icon: "scan-outline", title: "Subir comprobante", text: "Foto, PDF o texto con IA", to: "/capture/new", section: "plan" },
  { icon: "cash-outline", title: "Registrar cobro", text: "Alguien que te pagó", to: "/contacts", section: "people" },
];

/** Crear elementos nuevos, en grilla compacta de 2 columnas. */
export const CREATE_ACTIONS: QuickAction[] = [
  { icon: "calendar-outline", title: "Servicio", text: "Suscripción y ciclos", to: "/service/new", section: "services" },
  { icon: "wallet-outline", title: "Cuenta", text: "Banco, efectivo o tarjeta", to: "/account/new", section: "money" },
  { icon: "speedometer-outline", title: "Presupuesto", text: "Tope de gasto por mes", to: "/budgets/new", section: "plan" },
  { icon: "flag-outline", title: "Meta de ahorro", text: "Reserva para un objetivo", to: "/goals/new", section: "plan" },
  { icon: "repeat-outline", title: "Recurrente", text: "Sueldo, alquiler u otro", to: "/recurring/new", section: "plan" },
  { icon: "person-add-outline", title: "Contacto", text: "Persona o participante", to: "/contacts?action=add", section: "people" },
  { icon: "people-outline", title: "Préstamo", text: "Con una persona", to: "/loans/new", section: "money" },
  { icon: "business-outline", title: "Préstamo banco", text: "Cuotas y cronograma", to: "/bank-loans/new", section: "money" },
];
