import { useSyncExternalStore } from "react";

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

/** Lo que se crea o registra desde el «+»: solo acciones; navegar entre secciones se hace con las pestañas. */
export interface QuickAction { icon: string; title: string; text: string; to: string }
export interface QuickGroup { title: string; items: QuickAction[] }

export const QUICK_GROUPS: QuickGroup[] = [
  {
    title: "Registrar",
    items: [
      { icon: "swap-vertical-outline", title: "Gasto, ingreso o transferencia", text: "Un movimiento de tus cuentas", to: "/operation/new" },
      { icon: "cash-outline", title: "Cobro", text: "Elige a la persona que te pagó", to: "/people" },
      { icon: "scan-outline", title: "Subir comprobante", text: "Foto, PDF o texto para revisar", to: "/capture/new" },
    ],
  },
  {
    title: "Crear",
    items: [
      { icon: "calendar-outline", title: "Servicio", text: "Netflix, Spotify… con su calendario", to: "/service/new" },
      { icon: "wallet-outline", title: "Cuenta", text: "Banco, efectivo, billetera o tarjeta", to: "/account/new" },
      { icon: "person-add-outline", title: "Contacto", text: "Alguien que comparte un servicio", to: "/people" },
      { icon: "flag-outline", title: "Meta de ahorro", text: "Reserva dinero para un objetivo", to: "/goals/new" },
      { icon: "cash", title: "Préstamo", text: "Que diste o que recibiste", to: "/loans/new" },
    ],
  },
];
