import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Recarga los datos cada vez que la pantalla vuelve a estar en primer plano (p. ej. tras registrar un cobro).
 * El callback se guarda en una referencia: pasar una función nueva en cada render no provoca recargas en bucle.
 */
export function useFocusReload(reload: () => void | Promise<void>) {
  const first = useRef(true);
  const latest = useRef(reload);
  latest.current = reload;
  useFocusEffect(
    useCallback(() => {
      if (first.current) { first.current = false; return; } // la primera carga ya la hace useAsync
      void latest.current();
    }, []),
  );
}
