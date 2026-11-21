import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";
import { planNotifications } from "./plan";

// Notificaciones locales del teléfono. En la web no existen, y en Expo Go ni siquiera se carga el módulo (Expo Go lo rechaza
// con un error en pantalla): solo funcionan en la app instalada (APK / development build).
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const supported = () => (Platform.OS === "ios" || Platform.OS === "android") && !inExpoGo;
const lazy = () => import("expo-notifications");

// Nuevo canal con importancia HIGH para que Android muestre banner desplegable y sonido (Android no permite subir la
// importancia de un canal ya creado con DEFAULT).
const CHANNEL_ID = "eva_reminders";
const LEGACY_CHANNEL_ID = "reminders";
let channelReady = false;

async function ensureChannel(N: typeof import("expo-notifications")): Promise<void> {
  if (Platform.OS !== "android" || channelReady) return;
  await N.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID).catch(() => {});
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Recordatorios de EVA",
    importance: N.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 150, 250],
  });
  channelReady = true;
}

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
  await ensureChannel(N);
  const p = await N.requestPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/** Cómo se muestra una notificación con la app abierta, y qué pasa al tocarla (incluso si la app estaba cerrada). */
export async function installHandlers(open: (route: string) => void): Promise<() => void> {
  if (!supported()) return () => {};
  const N = await lazy();
  await ensureChannel(N);
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: N.AndroidNotificationPriority.HIGH,
    }),
  });

  let handledId: string | null = null;
  const dispatch = (r: import("expo-notifications").NotificationResponse | null | undefined) => {
    if (!r) return;
    const id = r.notification.request.identifier;
    if (handledId === id) return;
    const route = (r.notification.request.content.data as { route?: string } | undefined)?.route;
    if (route) {
      handledId = id;
      try { N.clearLastNotificationResponse(); } catch { /* noop */ }
      open(route);
    }
  };

  const sub = N.addNotificationResponseReceivedListener(dispatch);
  try {
    dispatch(N.getLastNotificationResponse());
  } catch {
    // En versiones anteriores del módulo nativo puede no estar disponible
  }
  return () => sub.remove();
}

/**
 * Deja programado exactamente lo que el servidor pide: agrega lo nuevo y cancela lo que ya no corresponde.
 * Devuelve null si no hay permiso o no es un teléfono.
 */
export async function syncReminders(now = new Date()): Promise<{ scheduled: number; cancelled: number; total: number } | null> {
  if (!supported() || (await permissionStatus()) !== "granted") return null;
  const N = await lazy();
  await ensureChannel(N);
  const data = await api.reminders(14);
  const existing = (await N.getAllScheduledNotificationsAsync())
    .filter((n) => !n.identifier.startsWith("eva:test:"))
    .map((n) => ({ identifier: n.identifier, body: n.content.body ?? null }));
  const plan = planNotifications(data.enabled ? data.items : [], existing, now);
  for (const id of plan.cancel) await N.cancelScheduledNotificationAsync(id);
  for (const p of plan.schedule) {
    await N.scheduleNotificationAsync({
      identifier: p.identifier,
      content: {
        title: p.title,
        body: p.body,
        sound: "default",
        data: { route: p.route },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
  return { scheduled: plan.schedule.length, cancelled: plan.cancel.length, total: plan.desired };
}

/** Cuántos recordatorios de EVA están realmente programados ahora mismo en el sistema operativo. */
export async function scheduledCount(): Promise<number> {
  if (!supported()) return 0;
  const N = await lazy();
  const all = await N.getAllScheduledNotificationsAsync();
  return all.filter((n) => n.identifier.startsWith("eva:") && !n.identifier.startsWith("eva:test:")).length;
}

/** TEMPORAL: programa una notificación de prueba local para verificar banner, sonido y navegación al tocarla. */
export async function scheduleTestNotification(opts: {
  title?: string;
  body: string;
  route: string;
  delaySeconds: number;
}): Promise<string> {
  if (!supported()) throw new Error("Las notificaciones solo funcionan en la app instalada en tu teléfono.");
  const perm = await requestPermission();
  if (perm !== "granted") throw new Error("Activa el permiso de notificaciones para poder probarlas.");
  const N = await lazy();
  await ensureChannel(N);
  const identifier = `eva:test:${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const seconds = Math.max(1, Math.round(opts.delaySeconds));
  await N.scheduleNotificationAsync({
    identifier,
    content: {
      title: opts.title ?? "EVA",
      body: opts.body,
      sound: "default",
      data: { route: opts.route },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
  return identifier;
}

/** Al cerrar sesión no debe quedar ningún aviso de esa cuenta en el teléfono (RN-OF04). */
export async function clearReminders(): Promise<void> {
  if (!supported()) return;
  const N = await lazy();
  for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith("eva:")) await N.cancelScheduledNotificationAsync(n.identifier);
}
