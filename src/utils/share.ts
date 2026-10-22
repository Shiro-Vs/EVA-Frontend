import { Platform, Share } from "react-native";

/** Comparte un texto preparado por el usuario. EVA nunca envía mensajes por su cuenta (docs 09 §7). */
export async function shareText(text: string): Promise<void> {
  if (Platform.OS === "web") {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
    await nav?.clipboard?.writeText(text);
    return;
  }
  await Share.share({ message: text });
}
