import AsyncStorage from "@react-native-async-storage/async-storage";

// Caché de consulta (09 §5): guarda la última respuesta de cada lectura para poder VER los datos sin conexión.
// Nunca guarda escrituras ni inventa confirmaciones (RN-OF01, RN-OF05) y se borra al cerrar sesión (RN-OF04).

const PREFIX = "eva.cache:";
const INDEX = "eva.cache.index";
const MAX_ENTRIES = 150;
const MAX_BYTES = 400_000; // una respuesta más grande no se guarda

export interface CacheEntry { at: string; version?: number; data: unknown }

let index: string[] | null = null;

async function loadIndex(): Promise<string[]> {
  if (index) return index;
  try { index = JSON.parse((await AsyncStorage.getItem(INDEX)) ?? "[]") as string[]; } catch { index = []; }
  return index;
}

/** Guarda la lectura. Si el almacenamiento falla, la app sigue funcionando sin caché. */
export async function cacheWrite(key: string, entry: CacheEntry): Promise<void> {
  try {
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_BYTES) return;
    const idx = await loadIndex();
    const next = [...idx.filter((k) => k !== key), key];
    const drop = next.length > MAX_ENTRIES ? next.splice(0, next.length - MAX_ENTRIES) : [];
    index = next;
    await AsyncStorage.setItem(PREFIX + key, raw);
    await AsyncStorage.setItem(INDEX, JSON.stringify(next));
    if (drop.length) await AsyncStorage.multiRemove(drop.map((k) => PREFIX + k));
  } catch { /* sin caché */ }
}

export async function cacheRead(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch { return null; }
}

/** Borra todo lo guardado: al cerrar sesión o al entrar otro usuario (RN-OF04). */
export async function cacheClear(): Promise<void> {
  try {
    const idx = await loadIndex();
    index = [];
    await AsyncStorage.multiRemove([INDEX, ...idx.map((k) => PREFIX + k)]);
  } catch { /* nada que borrar */ }
}

export const _cacheReset = () => { index = null; };
