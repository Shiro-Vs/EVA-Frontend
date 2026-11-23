import AsyncStorage from "@react-native-async-storage/async-storage";

const ORDER_KEY = "eva_account_order";

/** Aplica el orden guardado por IDs; las cuentas nuevas que aún no estén en la lista quedan al final. */
export function applyAccountOrder<T extends { id: string }>(items: T[], orderIds: string[]): T[] {
  if (!orderIds.length || items.length <= 1) return items;
  const rank = new Map(orderIds.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0;
  });
}

/** Mueve el elemento de `fromIndex` a `toIndex` devolviendo una copia nueva. */
export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export async function loadAccountOrder(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveAccountOrder(orderIds: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(orderIds));
  } catch {
    // ignorar fallos de almacenamiento local
  }
}
