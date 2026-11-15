import { useCallback, useEffect, useState } from "react";

/** Segundos que hay que esperar antes de pedir otro código de recuperación al mismo correo. */
export const CODE_COOLDOWN_SECONDS = 30;

// En memoria: se comparte entre la pantalla de «Olvidé mi contraseña» y la del código, así volver atrás no salta la espera.
const sentAt = new Map<string, number>();
const keyOf = (email: string) => email.trim().toLowerCase();

export function markCodeSent(email: string, now = Date.now()): void {
  sentAt.set(keyOf(email), now);
}

/** El servidor puede pedir esperar más (límite propio de Supabase): se respeta lo que diga. */
export function markCodeCooldown(email: string, seconds: number, now = Date.now()): void {
  sentAt.set(keyOf(email), now - (CODE_COOLDOWN_SECONDS - seconds) * 1000);
}

export function codeSecondsLeft(email: string, now = Date.now()): number {
  const t = sentAt.get(keyOf(email));
  if (t === undefined) return 0;
  return Math.max(0, Math.ceil(CODE_COOLDOWN_SECONDS - (now - t) / 1000));
}

/** Segundos que faltan para poder pedir otro código; baja solo cada segundo. `refresh` recalcula tras enviar. */
export function useCodeCooldown(email: string): { left: number; refresh: () => void } {
  const [left, setLeft] = useState(() => codeSecondsLeft(email));
  const refresh = useCallback(() => setLeft(codeSecondsLeft(email)), [email]);
  useEffect(() => {
    setLeft(codeSecondsLeft(email));
    const id = setInterval(() => setLeft(codeSecondsLeft(email)), 1000);
    return () => clearInterval(id);
  }, [email]);
  return { left, refresh };
}
