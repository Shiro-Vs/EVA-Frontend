import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// El token de sesión va en el almacenamiento seguro del dispositivo (09 RN-SE05).
// En web no existe SecureStore: se usa AsyncStorage (solo para desarrollo).
const isNative = Platform.OS !== "web";

export const storage = {
  async get(key: string): Promise<string | null> {
    return isNative ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (isNative) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (isNative) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  },
};

export const KEYS = { token: "eva.token", apiUrl: "eva.api_url" } as const;
