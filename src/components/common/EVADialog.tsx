import React, { useEffect } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { Button } from "../v1/ui";

const LOGO_LIGHT = require("../../../assets/LogoEVA_Fclaro.png");
const LOGO_DARK = require("../../../assets/LogoEVA_Foscuro.png");

export type DialogKind = "confirm" | "danger" | "success" | "error" | "blocked" | "info";

export interface DialogSpec {
  kind: DialogKind;
  title: string;
  message?: string;
  /** Lista de motivos o datos («Está en uso: 3 movimientos…»). */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Cierra solo tras N milisegundos (para los de éxito). */
  autoCloseMs?: number;
}

/** Ficha de cada tipo: ícono de estado sobre el logo y color. */
function look(kind: DialogKind, c: ReturnType<typeof useAppTheme>["colors"]) {
  switch (kind) {
    case "success": return { icon: "checkmark" as const, color: c.incomeStrong, tint: `${c.income}22` };
    case "error": return { icon: "close" as const, color: c.expenseStrong, tint: `${c.expense}22` };
    case "blocked": return { icon: "hand-left" as const, color: c.warningStrong, tint: `${c.warning}26` };
    case "danger": return { icon: "trash" as const, color: c.expenseStrong, tint: `${c.expense}22` };
    case "info": return { icon: "information" as const, color: c.primary, tint: `${c.primary}1F` };
    default: return { icon: "help" as const, color: c.primary, tint: `${c.primary}1F` };
  }
}

/** Diálogo de EVA: el logo al centro con una insignia que indica de qué se trata, título, motivo y botones. */
export default function EVADialog({ spec, onResult }: { spec: DialogSpec | null; onResult: (confirmed: boolean) => void }) {
  const { colors, isDark } = useAppTheme();
  useEffect(() => {
    if (!spec?.autoCloseMs) return;
    const t = setTimeout(() => onResult(true), spec.autoCloseMs);
    return () => clearTimeout(t);
  }, [spec, onResult]);
  if (!spec) return null;
  const l = look(spec.kind, colors);
  const asks = spec.kind === "confirm" || spec.kind === "danger";

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => onResult(false)}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(15,8,35,0.5)" }} onPress={() => (asks ? onResult(false) : onResult(true))} accessibilityLabel="Cerrar" />
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 380, borderRadius: 28, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, alignItems: "center" }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: l.tint, alignItems: "center", justifyContent: "center" }}>
            <Image source={isDark ? LOGO_DARK : LOGO_LIGHT} style={{ width: 52, height: 52 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: l.color, borderWidth: 3, borderColor: colors.elevated, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={l.icon} size={15} color="#FFFFFF" />
            </View>
          </View>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 19, fontFamily: "AsapBold", textAlign: "center", marginTop: 14 }}>{spec.title}</Text>
          {spec.message ? <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "Asap", textAlign: "center", marginTop: 6, lineHeight: 20 }}>{spec.message}</Text> : null}
          {spec.details && spec.details.length > 0 ? (
            <View style={{ alignSelf: "stretch", marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.card, gap: 4 }}>
              {spec.details.map((d, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={{ color: l.color, fontSize: 14, fontFamily: "AsapBold" }}>•</Text>
                  <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "Asap", lineHeight: 18 }}>{d}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {spec.autoCloseMs ? null : (
            <View style={{ alignSelf: "stretch", flexDirection: asks ? "row" : "column", gap: 8, marginTop: 16 }}>
              {asks && <View style={{ flex: 1 }}><Button title={spec.cancelLabel ?? "Cancelar"} variant="secondary" onPress={() => onResult(false)} /></View>}
              <View style={{ flex: asks ? 1 : undefined }}>
                <Button title={spec.confirmLabel ?? (asks ? "Confirmar" : "Entendido")} variant={spec.kind === "danger" ? "danger" : "primary"} onPress={() => onResult(true)} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
