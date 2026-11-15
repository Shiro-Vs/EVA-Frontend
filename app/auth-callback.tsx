import { Redirect } from "expo-router";

/**
 * Destino del enlace eva://auth-callback con el que Google devuelve a la app. La sesión ya la toma el navegador de
 * autenticación; esta ruta solo evita la pantalla «Unmatched Route» y lleva al inicio (sin sesión, el inicio es el login).
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
