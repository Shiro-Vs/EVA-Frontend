import { bankPreset } from "../banks";

describe("bankPreset", () => {
  it("reconoce la entidad por su nombre, sin tildes ni mayúsculas", () => {
    expect(bankPreset("BCP")?.id).toBe("bcp");
    expect(bankPreset("Interbank")?.id).toBe("interbank");
    expect(bankPreset("BBVA Continental")?.id).toBe("bbva");
    expect(bankPreset("YAPE")?.id).toBe("yape");
  });
  it("si la entidad no se reconoce usa el nombre de la cuenta", () => {
    expect(bankPreset(null, "Mastercard Interbank")?.id).toBe("interbank");
    expect(bankPreset("", "Scotiabank sueldo")?.id).toBe("scotiabank");
  });
  it("devuelve null con entidades desconocidas o vacías", () => {
    expect(bankPreset("Caja Huancayo", "Ahorros")).toBeNull();
    expect(bankPreset(null, null)).toBeNull();
  });
  it("la entidad manda sobre el nombre", () => {
    expect(bankPreset("BCP", "Yape de respaldo")?.id).toBe("bcp");
  });
});
