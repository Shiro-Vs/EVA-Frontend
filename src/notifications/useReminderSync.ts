import { useEffect } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { clearReminders, installHandlers, syncReminders } from "./scheduler";

/** Mantiene programados los avisos del teléfono: al abrir la app, al volver a ella y al cerrar sesión se limpian. */
export function useReminderSync() {
  const { user, isLoadingSession } = useAuth();
  const uid = user?.uid ?? null;
  const router = useRouter();

  useEffect(() => {
    if (isLoadingSession || !uid) return;
    let off = () => {};
    let alive = true;
    installHandlers((route) => router.push(route as never)).then((f) => { if (alive) off = f; else f(); }).catch(() => {});
    return () => { alive = false; off(); };
  }, [router, uid, isLoadingSession]);

  useEffect(() => {
    if (isLoadingSession) return;
    if (!uid) { clearReminders().catch(() => {}); return; }
    const run = () => { syncReminders().catch(() => {}); };
    run();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") run(); });
    return () => sub.remove();
  }, [uid, isLoadingSession]);
}
