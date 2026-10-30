import { parseInline, parseRichText } from "../richText";

describe("Formato de las respuestas de la IA", () => {
  it("convierte **negritas** y *cursivas* sin dejar asteriscos", () => {
    expect(parseInline("**Hogar › Alquiler** con S/ 1200.00")).toEqual([
      { text: "Hogar › Alquiler", bold: true, italic: false },
      { text: " con S/ 1200.00", bold: false, italic: false },
    ]);
    expect(parseInline("un *matiz* aquí")[1]).toEqual({ text: "matiz", bold: false, italic: true });
  });

  it("deja tal cual lo que no cierra o no es formato", () => {
    expect(parseInline("2 * 3 = 6 y **sin cerrar")).toEqual([{ text: "2 * 3 = 6 y **sin cerrar", bold: false, italic: false }]);
    expect(parseInline("snake_case_name")).toEqual([{ text: "snake_case_name", bold: false, italic: false }]);
  });

  it("arma viñetas, numeración y títulos como la respuesta del análisis", () => {
    const b = parseRichText("Tu mayor gasto fue en:\n* **Hogar** S/ 1200.00\n* Comida\n\n**Notas:**\n1. Primero\n2) Segundo\n## Título");
    expect(b.map((x) => x.kind)).toEqual(["p", "bullet", "bullet", "gap", "p", "number", "number", "h"]);
    expect((b[1] as any).spans[0]).toEqual({ text: "Hogar", bold: true, italic: false });
    expect((b[6] as any).n).toBe("2");
  });

  it("detecta sangría en viñetas anidadas y limpia saltos al final", () => {
    const b = parseRichText("- uno\n  - dos\n\n\n");
    expect(b).toEqual([
      { kind: "bullet", level: 0, spans: [{ text: "uno", bold: false, italic: false }] },
      { kind: "bullet", level: 1, spans: [{ text: "dos", bold: false, italic: false }] },
    ]);
  });

  it("es seguro con texto vacío o con caracteres raros", () => {
    expect(parseRichText("")).toEqual([]);
    expect(() => parseRichText("<script>alert(1)</script> [x](http://a.b)")).not.toThrow();
  });
});
