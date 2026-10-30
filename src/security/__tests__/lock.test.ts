import { afterAttempt, freshAttempts, isValidPin, isWeakPin, MAX_ATTEMPTS, safeEqual, shouldLock, waitSeconds } from "../lock";

describe("Bloqueo de la app", () => {
  it("valida el formato del PIN y rechaza los triviales", () => {
    expect(isValidPin("483920")).toBe(true);
    expect(isValidPin("1234")).toBe(false);
    expect(isValidPin("12345a")).toBe(false);
    for (const weak of ["111111", "123456", "654321", "000000", "abc"]) expect(isWeakPin(weak)).toBe(true);
    expect(isWeakPin("483920")).toBe(false);
    expect(isWeakPin("135792")).toBe(false);
  });

  it("decide cuándo volver a pedir el desbloqueo", () => {
    const base = { enabled: true, now: 1_000_000, lockAfterSeconds: 60 };
    expect(shouldLock({ ...base, backgroundedAt: null })).toBe(false);
    expect(shouldLock({ ...base, backgroundedAt: 1_000_000 - 30_000 })).toBe(false);
    expect(shouldLock({ ...base, backgroundedAt: 1_000_000 - 60_000 })).toBe(true);
    expect(shouldLock({ ...base, enabled: false, backgroundedAt: 0 })).toBe(false);
    expect(shouldLock({ ...base, lockAfterSeconds: 0, backgroundedAt: 1_000_000 })).toBe(true); // «al salir de la app»
  });

  it("tras varios fallos seguidos exige esperar, y la espera crece", () => {
    let a = freshAttempts();
    let t = 1_000;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) { a = afterAttempt(a, false, t); expect(waitSeconds(a, t)).toBe(0); }
    a = afterAttempt(a, false, t);
    expect(waitSeconds(a, t)).toBe(30);
    expect(waitSeconds(a, t + 31_000)).toBe(0);
    t += 40_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) a = afterAttempt(a, false, t);
    expect(waitSeconds(a, t)).toBe(60);
  });

  it("un acierto reinicia los intentos", () => {
    let a = afterAttempt(freshAttempts(), false, 0);
    a = afterAttempt(a, false, 0);
    expect(afterAttempt(a, true, 0)).toEqual(freshAttempts());
  });

  it("compara cadenas sin atajos", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
