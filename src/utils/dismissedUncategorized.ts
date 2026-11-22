import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "eva_dismissed_uncategorized_ids";

/** IDs de movimientos sin categoría que el usuario decidió omitir (no quiere categorizarlos). */
export async function getDismissedUncategorized(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export async function dismissUncategorized(ids: string[]): Promise<Set<string>> {
  const cur = await getDismissedUncategorized();
  for (const id of ids) cur.add(id);
  // Límite sano de almacenamiento local (últimos 500 omitidos).
  const next = [...cur].slice(-500);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return new Set(next);
}

export async function undismissUncategorized(id: string): Promise<Set<string>> {
  const cur = await getDismissedUncategorized();
  cur.delete(id);
  const next = [...cur];
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return new Set(next);
}

export async function clearDismissedUncategorized(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
