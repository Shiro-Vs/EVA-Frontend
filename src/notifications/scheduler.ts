import { Platform } from "react-native";
import { api } from "../api/client";
import { planNotifications } from "./plan";

// Notificaciones locales del teléfono. En la web no existen: todo es un no-op.
const supported = () => Platform.OS === "ios" || Platform.OS === "android";
const lazy = () => import("expo-notifications");

export type Permission = "granted" | "denied" | "undetermined" | "unsupported";

export async function permissionStatus(): Promise<Permission> {
  if (!supported()) return "unsupported";
  const N = await lazy();
  const p = await N.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

export async function requestPermission(): Promise<Permission> {
  if (!supported()) return "unsupported";
  const N = await lazy();
  if (Platform.OS === "android") await N.setNotificationChannelAsync("reminders", { name: "Recordatorios", importance: N.AndroidImportance.DEFAULT });
  const p = await N.requestPermissionsAsync();
  return p.granted ? "granted" : "denied";
}

/** Cómo se muestra una notificación con la app abierta, y qué pasa al tocarla (abre la pantalla indicada por el servidor). */
export async function installHandlers(open: (route: string) => void): Promise<() => void> {
  if (!supported()) return () => {};
  const N = await lazy();
  N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  const sub = N.addNotificationResponseReceivedListener((r) => {
    const route = (r.notification.request.content.data as { route?: string } | undefined)?.route;
    if (route) open(route);
  });
  return () => sub.remove();
}

/**
 * Deja programado exactamente lo que el servidor pide: agrega lo nuevo y cancela lo que ya no corresponde.
 * Devuelve null si no hay permiso o no es un teléfono.
 */
export async function syncReminders(now = new Date()): Promise<{ scheduled: number; cancelled: number; total: number } | null> {
  if (!supported() || (await permissionStatus()) !== "granted") return null;
  const N = await lazy();
  const data = await api.reminders(14);
  const existing = (await N.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  const plan = planNotifications(data.enabled ? data.items : [], existing, now);
  for (const id of plan.cancel) await N.cancelScheduledNotificationAsync(id);
  for (const p of plan.schedule) {
    await N.scheduleNotificationAsync({
      identifier: p.identifier,
      content: { title: p.title, body: p.body, data: { route: p.route }, ...(Platform.OS === "android" ? { channelId: "reminders" } : {}) },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.at, ...(Platform.OS === "android" ? { channelId: "reminders" } : {}) },
    });
  }
  return { scheduled: plan.schedule.length, cancelled: plan.cancel.length, total: plan.desired };
}

/** Al cerrar sesión no debe quedar ningún aviso de esa cuenta en el teléfono (RN-OF04). */
export async function clearReminders(): Promise<void> {
  if (!supported()) return;
  const N = await lazy();
  for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith("eva:")) await N.cancelScheduledNotificationAsync(n.identifier);
}
