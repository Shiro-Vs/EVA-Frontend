import { Platform } from "react-native";

/** Convierte base64 en bytes (sin depender de Buffer, que no existe en el móvil). */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return globalThis.btoa(bin);
}

/**
 * Entrega un archivo al usuario: en la web lo descarga; en el teléfono lo guarda en la caché y abre el menú de compartir
 * (de ahí se guarda en Archivos, Drive o se envía).
 */
export async function saveAndShare(bytes: Uint8Array, filename: string, mime: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Este dispositivo no permite compartir archivos.");
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: filename });
}
