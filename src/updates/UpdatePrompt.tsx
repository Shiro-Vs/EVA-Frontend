import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";
import { useDialog } from "../context/DialogContext";
import { shouldCheckForUpdate } from "./throttle";

/**
 * Actualizaciones por internet (EAS Update). Al abrir la app, Expo ya descarga en segundo plano la versión nueva (checkAutomatically: ON_LOAD);
 * aquí además se busca al volver a la app y, cuando una versión nueva está lista, se ofrece reiniciar para estrenarla.
 * No hace nada en desarrollo (Expo Go) porque ahí `Updates.isEnabled` es falso.
 */
export function UpdatePrompt() {
  const dialog = useDialog();
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  const lastCheck = useRef<number | null>(null);
  const askedId = useRef<string | null>(null);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !shouldCheckForUpdate(lastCheck.current, Date.now())) return;
      lastCheck.current = Date.now();
      void (async () => {
        try {
          const r = await Updates.checkForUpdateAsync();
          if (r.isAvailable) await Updates.fetchUpdateAsync();
        } catch {
          // Sin internet o sin versión nueva: no es un error para quien usa la app.
        }
      })();
    });
    return () => sub.remove();
  }, []);

  const pendingKey = isUpdatePending ? (downloadedUpdate?.updateId ?? "__pending__") : null;

  useEffect(() => {
    if (!pendingKey || askedId.current === pendingKey) return;
    askedId.current = pendingKey;
    void (async () => {
      const ok = await dialog.confirm({
        title: "Hay una versión nueva de EVA",
        message: "Ya está lista. Actualiza para ver las mejoras; si eliges «Más tarde», se aplicará al reiniciar la app o desde Más → Acerca de EVA.",
        confirmLabel: "Actualizar ahora",
        cancelLabel: "Más tarde",
      });
      if (ok) await Updates.reloadAsync();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  return null;
}
