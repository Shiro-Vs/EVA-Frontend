import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";
import { useConnectivity } from "../api/connectivity";
import { newKey } from "../api/http";

const RECONNECT_COOLDOWN_MS = 10_000;

/** Carga datos al montar y cuando cambian las dependencias; permite recargar a mano. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const lastLoad = useRef(0);
  const reload = useCallback(async () => {
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      const r = await fnRef.current();
      if (alive.current) { setData(r); setError(null); }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // Al volver la conexión, lo que se mostraba desde la caché se refresca solo.
  const { offline } = useConnectivity();
  const wasOffline = useRef(false);
  useEffect(() => {
    // Con enfriamiento: si un endpoint falla y otro acierta, la conexión «parpadea» y sin esto todo se recargaría en bucle.
    if (wasOffline.current && !offline && Date.now() - lastLoad.current > RECONNECT_COOLDOWN_MS) void reload();
    wasOffline.current = offline;
  }, [offline, reload]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/**
 * Envío con efectos financieros. La clave de idempotencia se crea UNA vez por intento del usuario y se reutiliza si el
 * mismo intento se reenvía (doble toque, pérdida de conexión). Tras un éxito se renueva para la siguiente acción.
 */
export function useSubmit<A extends unknown[], R>(fn: (key: string, ...args: A) => Promise<R>) {
  const keyRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (...args: A): Promise<R | undefined> => {
    if (busyRef.current) return undefined; // un solo envío a la vez (doble toque)
    busyRef.current = true;
    setBusy(true);
    setError(null);
    if (!keyRef.current) keyRef.current = newKey();
    try {
      const r = await fn(keyRef.current, ...args);
      keyRef.current = null; // éxito: la próxima acción es otra
      return r;
    } catch (e) {
      setError(errorMessage(e)); // se conserva la clave: reintentar es seguro
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [fn]);

  /** Cambiar los datos del formulario es una acción distinta: nueva clave. */
  const resetKey = useCallback(() => { keyRef.current = null; }, []);
  return { submit, busy, error, setError, resetKey };
}
