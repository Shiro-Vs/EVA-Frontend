import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { parseRichText, type Span } from "../../utils/richText";

function Inline({ spans, size, color }: { spans: Span[]; size: number; color: string }) {
  return (
    <>
      {spans.map((s, i) => (
        <Text key={i} style={{ color, fontSize: size, lineHeight: size * 1.45, fontFamily: s.bold ? "AsapBold" : s.italic ? "AsapItalic" : "Asap" }}>{s.text}</Text>
      ))}
    </>
  );
}

/** Texto con formato sencillo (negritas, viñetas, numeración, títulos), para las respuestas de la IA. */
export default function RichText({ text, size = 14 }: { text: string; size?: number }) {
  const { colors } = useAppTheme();
  const blocks = parseRichText(text);
  return (
    <View style={{ gap: 4 }}>
      {blocks.map((b, i) => {
        if (b.kind === "gap") return <View key={i} style={{ height: 6 }} />;
        if (b.kind === "bullet") {
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 + b.level * 14 }}>
              <Text style={{ color: colors.primary, fontSize: size, lineHeight: size * 1.45, fontFamily: "AsapBold" }}>•</Text>
              <Text style={{ flex: 1, fontFamily: "Asap", fontSize: size, lineHeight: size * 1.45, color: colors.text }}><Inline spans={b.spans} size={size} color={colors.text} /></Text>
            </View>
          );
        }
        if (b.kind === "number") {
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}>
              <Text style={{ color: colors.primary, fontSize: size, lineHeight: size * 1.45, fontFamily: "AsapBold", minWidth: 18 }}>{b.n}.</Text>
              <Text style={{ flex: 1, fontFamily: "Asap", fontSize: size, lineHeight: size * 1.45, color: colors.text }}><Inline spans={b.spans} size={size} color={colors.text} /></Text>
            </View>
          );
        }
        const hSize = b.kind === "h" ? size + 1 : size;
        return <Text key={i} style={{ fontFamily: "Asap", fontSize: hSize, lineHeight: hSize * 1.45, color: colors.text }}><Inline spans={b.spans} size={hSize} color={colors.text} /></Text>;
      })}
    </View>
  );
}
