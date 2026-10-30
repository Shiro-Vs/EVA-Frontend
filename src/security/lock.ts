// Lógica pura del bloqueo de la app (PIN / huella). No toca el teléfono: se prueba sin dispositivo.

export const PIN_LENGTH = 6;
export const MAX_ATTEMPTS = 5;
/** Tras agotar los intentos, espera creciente (segundos) antes de poder volver a probar. */
const COOLDOWN = [30, 60, 300, 900];

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** PIN triviales que no se aceptan (111111, 123456, 654321…). */
export function isWeakPin(pin: string): boolean {
  if (!isValidPin(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = d[1]! - d[0]!;
  return Math.abs(step) === 1 && d.every((v, i) => i === 0 || v - d[i - 1]! === step);
}

/** ¿Hay que pedir el desbloqueo al volver a la app? lockAfterSeconds = 0 → siempre al salir. */
export function shouldLock(opts: { enabled: boolean; now: number; backgroundedAt: number | null; lockAfterSeconds: number }): boolean {
  if (!opts.enabled) return false;
  if (opts.backgroundedAt == null) return false; // aún no salió de la app
  return opts.now - opts.backgroundedAt >= opts.lockAfterSeconds * 1000;
}

export interface Attempts { failed: number; lockedUntil: number | null; rounds: number }
export const freshAttempts = (): Attempts => ({ failed: 0, lockedUntil: null, rounds: 0 });

export function waitSeconds(a: Attempts, now: number): number {
  return a.lockedUntil && a.lockedUntil > now ? Math.ceil((a.lockedUntil - now) / 1000) : 0;
}

/** Registra el resultado de un intento. Si falla MAX_ATTEMPTS veces seguidas, bloquea con espera creciente. */
export function afterAttempt(a: Attempts, ok: boolean, now: number): Attempts {
  if (ok) return freshAttempts();
  const failed = a.failed + 1;
  if (failed < MAX_ATTEMPTS) return { ...a, failed };
  const secs = COOLDOWN[Math.min(a.rounds, COOLDOWN.length - 1)]!;
  return { failed: 0, rounds: a.rounds + 1, lockedUntil: now + secs * 1000 };
}

/** Comparación en tiempo constante (evita filtrar por tiempo cuántos caracteres coinciden). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
