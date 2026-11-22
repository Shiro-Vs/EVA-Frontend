import { Linking, Platform, Share } from "react-native";

/** Comparte un texto preparado por el usuario. EVA nunca envía mensajes por su cuenta (docs 09 §7). */
export async function shareText(text: string): Promise<void> {
  if (Platform.OS === "web") {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
    await nav?.clipboard?.writeText(text);
    return;
  }
  await Share.share({ message: text });
}

/** Normaliza un número de teléfono para enlaces de WhatsApp (asume +51 si son 9 dígitos móviles de Perú). */
export function normalizeWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.length === 9 && digits.startsWith("9")) return `51${digits}`;
  return digits;
}

/** Abre WhatsApp con el mensaje prellenado (directo al chat si el contacto tiene teléfono guardado). */
export async function openWhatsApp(text: string, phone?: string | null): Promise<boolean> {
  const digits = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(text);
  const webUrl = digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

  if (Platform.OS === "web") {
    const win = (globalThis as { open?: (u: string, t?: string) => unknown }).open;
    win?.(webUrl, "_blank");
    return true;
  }

  const appUrl = digits ? `whatsapp://send?phone=${digits}&text=${encoded}` : `whatsapp://send?text=${encoded}`;
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return true;
    }
  } catch {
    // Fallback a wa.me si el esquema nativo no está disponible o bloqueado en Android 11+
  }
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch {
    return false;
  }
}
