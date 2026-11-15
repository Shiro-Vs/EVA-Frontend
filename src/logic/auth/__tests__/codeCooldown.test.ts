import { CODE_COOLDOWN_SECONDS, codeSecondsLeft, markCodeCooldown, markCodeSent } from "../codeCooldown";

describe("espera entre códigos de recuperación", () => {
  it("sin envíos previos no hay que esperar", () => {
    expect(codeSecondsLeft("nuevo@example.com", 1_000_000)).toBe(0);
  });

  it("tras enviar hay que esperar 30 segundos y baja con el tiempo", () => {
    const t0 = 1_000_000;
    markCodeSent("rosa@example.com", t0);
    expect(codeSecondsLeft("rosa@example.com", t0)).toBe(CODE_COOLDOWN_SECONDS);
    expect(codeSecondsLeft("rosa@example.com", t0 + 10_000)).toBe(20);
    expect(codeSecondsLeft("rosa@example.com", t0 + 29_500)).toBe(1);
    expect(codeSecondsLeft("rosa@example.com", t0 + 30_000)).toBe(0);
  });

  it("no distingue mayúsculas ni espacios en el correo, pero sí entre correos", () => {
    markCodeSent("  Ana@Example.com ", 5_000);
    expect(codeSecondsLeft("ana@example.com", 5_000)).toBe(CODE_COOLDOWN_SECONDS);
    expect(codeSecondsLeft("otra@example.com", 5_000)).toBe(0);
  });

  it("respeta la espera que pida el servidor", () => {
    markCodeCooldown("luis@example.com", 12, 9_000);
    expect(codeSecondsLeft("luis@example.com", 9_000)).toBe(12);
    expect(codeSecondsLeft("luis@example.com", 15_000)).toBe(6);
  });
});
