import { Platform } from "react-native";

// Inicio de sesión con Google «nativo»: la hoja del sistema con tus cuentas de Google (sin abrir el navegador).
// Solo existe en el APK, que trae el módulo nativo. En Expo Go y en la web no está: ahí se usa el navegador.

type Modulo = typeof import("@react-native-google-signin/google-signin");
let cache: Modulo | null | undefined;

function modulo(): Modulo | null {
  if (cache !== undefined) return cache;
  try {
    // require diferido: si el módulo nativo no está en esta app, no debe romper el resto.
    cache = require("@react-native-google-signin/google-signin") as Modulo;
  } catch {
    cache = null;
  }
  return cache;
}

const webClientId = () => process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** Hay módulo nativo y se conoce el ID de cliente web de Google (el mismo que usa Supabase). */
export function nativeGoogleAvailable(): boolean {
  return Platform.OS !== "web" && webClientId() !== "" && modulo() !== null;
}

/** Marca de «no hay módulo nativo»: quien llama cae al navegador. */
export const NO_NATIVE = "no_native";

/** Abre la hoja de cuentas de Google. Devuelve el ID token, o `null` si la persona la cerró sin elegir. */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const m = modulo();
  if (!m || !webClientId()) throw new Error(NO_NATIVE);
  const { GoogleSignin, statusCodes, isErrorWithCode } = m;
  try {
    GoogleSignin.configure({ webClientId: webClientId(), scopes: ["email", "profile"] });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Con una sola cuenta en el teléfono (y ya autorizada), Google entra sin preguntar. Quitar la sesión y el permiso previos
    // obliga a mostrar la hoja con la cuenta y su confirmación. Si no había sesión, esto falla sin consecuencias.
    try { await GoogleSignin.signOut(); } catch { /* sin sesión previa */ }
    try { await GoogleSignin.revokeAccess(); } catch { /* sin permiso previo */ }
    const res = await GoogleSignin.signIn();
    if (res.type !== "success") return null;
    return res.data.idToken ?? null;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    // El módulo está pero el sistema no lo puede usar (Expo Go): se vuelve al navegador.
    if (/RNGoogleSignin|TurboModule|native module/i.test(String((e as Error)?.message))) throw new Error(NO_NATIVE);
    throw e;
  }
}
