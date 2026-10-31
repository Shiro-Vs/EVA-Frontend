// Lectura mínima de Markdown para las respuestas de la IA (negritas, viñetas, numeración y títulos).
// Es lógica pura: no ejecuta nada ni interpreta enlaces, solo separa la estructura para dibujarla como texto.

export interface Span { text: string; bold: boolean; italic: boolean }
export type Block =
  | { kind: "p"; spans: Span[] }
  | { kind: "h"; spans: Span[] }
  | { kind: "bullet"; spans: Span[]; level: number }
  | { kind: "number"; n: string; spans: Span[] }
  | { kind: "gap" };

/** «**negrita**» y «*cursiva*». Lo que no cierra (o los guiones bajos de nombres como snake_case) se deja tal cual. */
export function parseInline(src: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), bold: false, italic: false });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, italic: false });
    else out.push({ text: m[2]!, bold: false, italic: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last), bold: false, italic: false });
  return out.length ? out : [{ text: "", bold: false, italic: false }];
}

/** El texto sin formato Markdown (para mostrar un resumen en pocas líneas). */
export function plainText(input: string): string {
  return parseRichText(input).map((b) => (b.kind === "gap" ? " " : b.spans.map((s) => s.text).join(""))).join(" ").replace(/\s+/g, " ").trim();
}

export function parseRichText(input: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of input.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") { if (blocks.length && blocks[blocks.length - 1]!.kind !== "gap") blocks.push({ kind: "gap" }); continue; }
    const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (h) { blocks.push({ kind: "h", spans: parseInline(h[1]!).map((s) => ({ ...s, bold: true })) }); continue; }
    const b = /^(\s*)[*\-•]\s+(.*)$/.exec(line);
    if (b) { blocks.push({ kind: "bullet", level: Math.min(2, Math.floor(b[1]!.length / 2)), spans: parseInline(b[2]!) }); continue; }
    const n = /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(line);
    if (n) { blocks.push({ kind: "number", n: n[1]!, spans: parseInline(n[2]!) }); continue; }
    blocks.push({ kind: "p", spans: parseInline(line.trim()) });
  }
  while (blocks.length && blocks[blocks.length - 1]!.kind === "gap") blocks.pop();
  return blocks;
}
