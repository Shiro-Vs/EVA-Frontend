import { passwordProblem } from "../passwordRules";

describe("reglas de la contraseña nueva", () => {
  it("exige 8 caracteres, una mayúscula y un número", () => {
    expect(passwordProblem("Ab1")).toBe("Mínimo 8 caracteres");
    expect(passwordProblem("abcdefgh1")).toBe("Usa una mayúscula y un número");
    expect(passwordProblem("Abcdefgh")).toBe("Usa una mayúscula y un número");
    expect(passwordProblem("Abcdefg1")).toBe("");
  });
});
