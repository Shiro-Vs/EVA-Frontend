import { useRouter } from "expo-router";

/**
 * Sale de un formulario tras guardar: vuelve atrás si hay historial y, si no (p. ej. se abrió por enlace directo),
 * va a la pantalla indicada. Así nunca queda el formulario visible listo para reenviarse por error.
 */
export function useDone() {
  const router = useRouter();
  return (fallback: string) => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };
}
