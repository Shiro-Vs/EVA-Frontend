import { bankPreset, cardThemeById, normalizeCardPattern } from "../banks";

describe("bankPreset", () => {
  it("reconoce la entidad por su nombre, sin tildes ni mayúsculas", () => {
    expect(bankPreset("BCP")?.id).toBe("bcp");
    expect(bankPreset("Interbank")?.id).toBe("interbank");
    expect(bankPreset("BBVA Continental")?.id).toBe("bbva");
    expect(bankPreset("YAPE")?.id).toBe("yape");
    expect(bankPreset("Banco de la Nación")?.id).toBe("bn");
    expect(bankPreset("CMR Falabella")?.id).toBe("falabella");
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

describe("personalización de tarjetas", () => {
  it("resuelve temas por id y colores hex válidos", () => {
    expect(cardThemeById("obsidian")?.label).toBe("Black");
    expect(cardThemeById("gold")?.label).toBe("Oro");
    expect(cardThemeById("#123456")?.colors).toEqual(["#123456", "#123456"]);
    expect(cardThemeById(null)).toBeNull();
    expect(cardThemeById("desconocido")).toBeNull();
  });
  it("normaliza el patrón visual con circles por defecto", () => {
    expect(normalizeCardPattern("diagonal")).toBe("diagonal");
    expect(normalizeCardPattern("waves")).toBe("waves");
    expect(normalizeCardPattern("minimal")).toBe("minimal");
    expect(normalizeCardPattern(null)).toBe("circles");
    expect(normalizeCardPattern("otro")).toBe("circles");
  });
});
