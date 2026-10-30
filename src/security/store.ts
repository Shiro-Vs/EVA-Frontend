import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { storage } from "../api/storage";
import { afterAttempt, freshAttempts, isValidPin, safeEqual, waitSeconds, type Attempts } from "./lock";

// El PIN nunca se guarda: solo un hash con sal aleatoria, en el almacenamiento seguro del teléfono.
// La web no tiene almacenamiento seguro: el bloqueo no está disponible allí.
export const lockAvailable = () => Platform.OS === "ios" || Platform.OS === "android";

const K = { pin: "eva.lock.pin", biometric: "eva.lock.bio", attempts: "eva.lock.attempts" } as const;
const ROUNDS = 1000;

interface Saved { salt: string; hash: string }

async function derive(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < ROUNDS; i++) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h + salt);
  return h;
}

async function readAttempts(): Promise<Attempts> {
  try { const raw = await storage.get(K.attempts); return raw ? { ...freshAttempts(), ...JSON.parse(raw) } : freshAttempts(); } catch { return freshAttempts(); }
}

export async function hasPin(): Promise<boolean> {
  if (!lockAvailable()) return false;
  return !!(await storage.get(K.pin));
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("El PIN debe tener 6 dígitos.");
  const salt = Array.from(await Crypto.getRandomBytesAsync(16), (b) => b.toString(16).padStart(2, "0")).join("");
  const saved: Saved = { salt, hash: await derive(pin, salt) };
  await storage.set(K.pin, JSON.stringify(saved));
  await storage.remove(K.attempts);
}

export type Verify = { ok: true } | { ok: false; waitSeconds: number; remaining: number };

export async function verifyPin(pin: string, now = Date.now()): Promise<Verify> {
  const att = await readAttempts();
  const wait = waitSeconds(att, now);
  if (wait > 0) return { ok: false, waitSeconds: wait, remaining: 0 };
  const raw = await storage.get(K.pin);
  const saved: Saved | null = raw ? JSON.parse(raw) : null;
  const ok = !!saved && isValidPin(pin) && safeEqual(await derive(pin, saved.salt), saved.hash);
  const next = afterAttempt(att, ok, now);
  await storage.set(K.attempts, JSON.stringify(next));
  if (ok) return { ok: true };
  return { ok: false, waitSeconds: waitSeconds(next, now), remaining: Math.max(0, 5 - next.failed) };
}

export async function clearLock(): Promise<void> {
  await Promise.all([storage.remove(K.pin), storage.remove(K.biometric), storage.remove(K.attempts)]);
}

export async function biometricEnabled(): Promise<boolean> {
  return (await storage.get(K.biometric)) === "1";
}
export async function setBiometricEnabled(v: boolean): Promise<void> {
  if (v) await storage.set(K.biometric, "1"); else await storage.remove(K.biometric);
}

/** ¿El teléfono tiene huella/rostro registrados? */
export async function biometricSupported(): Promise<boolean> {
  if (!lockAvailable()) return false;
  const LA = await import("expo-local-authentication");
  return (await LA.hasHardwareAsync()) && (await LA.isEnrolledAsync());
}

export async function promptBiometric(): Promise<boolean> {
  const LA = await import("expo-local-authentication");
  const r = await LA.authenticateAsync({ promptMessage: "Desbloquear EVA", cancelLabel: "Usar PIN", disableDeviceFallback: true });
  return r.success;
}
