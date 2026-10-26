import { useSyncExternalStore } from "react";

// Estado de conexión visible para toda la app (09 §5, RN-OF02): sin conexión solo se consulta lo ya cargado y se muestra de cuándo son los datos.
export interface Connectivity { offline: boolean; /** Momento (ISO) de los datos que se están mostrando desde la caché. */ dataAt: string | null }

let state: Connectivity = { offline: false, dataAt: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const connectivity = {
  get: () => state,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Se sirvió una respuesta desde la caché porque no hubo red. Conserva la fecha más antigua mostrada. */
  setOffline(dataAt: string) {
    const older = state.dataAt && state.dataAt < dataAt ? state.dataAt : dataAt;
    if (state.offline && state.dataAt === older) return;
    state = { offline: true, dataAt: older }; emit();
  },
  setOnline() { if (!state.offline) return; state = { offline: false, dataAt: null }; emit(); },
  _reset() { state = { offline: false, dataAt: null }; listeners.clear(); },
};

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(connectivity.subscribe, connectivity.get, connectivity.get);
}
