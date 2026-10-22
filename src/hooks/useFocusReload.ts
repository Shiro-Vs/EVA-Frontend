import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/** Recarga los datos cada vez que la pantalla vuelve a estar en primer plano (p. ej. tras registrar un cobro). */
export function useFocusReload(reload: () => void | Promise<void>) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) { first.current = false; return; } // la primera carga ya la hace useAsync
      void reload();
    }, [reload]),
  );
}
