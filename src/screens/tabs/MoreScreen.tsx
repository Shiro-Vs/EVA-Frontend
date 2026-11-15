import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import BottomSheet from "../../components/common/BottomSheet";
import { Screen, Txt } from "../../components/v1/ui";
import { PALETTE_INFO, type SectionKey } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useAppThemeContext } from "../../context/ThemeContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import AppearanceCard from "./AppearanceCard";
import { useDialog } from "../../context/DialogContext";

type Row = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; to: string };
const GROUPS: Array<{ title: string; section: SectionKey; rows: Row[] }> = [
  { title: "Inteligencia", section: "plan", rows: [
    { icon: "sparkles-outline", title: "Análisis con IA", text: "Pregunta sobre tus gastos", to: "/analysis" },
    { icon: "chatbubbles-outline", title: "Conversaciones guardadas", text: "Tus conversaciones con la IA", to: "/analysis/chats" },
  ] },
  { title: "Captura", section: "people", rows: [
    { icon: "scan-outline", title: "Bandeja de captura", text: "Comprobantes y correos por revisar", to: "/capture" },
    { icon: "funnel-outline", title: "Reglas por remitente", text: "Cuenta o categoría según quién envía", to: "/capture/rules" },
  ] },
  { title: "Informes", section: "money", rows: [
    { icon: "bar-chart-outline", title: "Resumen mensual", text: "Flujo, resultado y PDF", to: "/reports" },
    { icon: "download-outline", title: "Exportar", text: "CSV, Excel y PDF", to: "/export" },
    { icon: "return-down-back-outline", title: "Devoluciones", text: "Dinero que debes devolver", to: "/refunds" },
  ] },
  { title: "Seguridad y datos", section: "more", rows: [
    { icon: "lock-closed-outline", title: "PIN y huella", text: "Bloquear la app en este teléfono", to: "/settings/lock" },
    { icon: "notifications-outline", title: "Avisos y recordatorios", text: "Qué avisar y cuándo", to: "/settings/notifications" },
    { icon: "cloud-done-outline", title: "Respaldos", text: "Copias y restaurar", to: "/settings/backups" },
    { icon: "apps-outline", title: "Panel y tarjetas", text: "Elige y ordena lo que ves", to: "/settings/dashboard" },
    { icon: "options-outline", title: "Bloqueo y captura", text: "Re-bloqueo, propuestas y duplicados", to: "/settings/general" },
  ] },
  { title: "Cuenta", section: "more", rows: [
    { icon: "key-outline", title: "Cambiar contraseña", text: "Elige una contraseña nueva", to: "/settings/password" },
    { icon: "cash-outline", title: "Ajustes de cobro", text: "Días gratis y límite en bajas", to: "/settings/billing" },
    { icon: "shield-checkmark-outline", title: "Cuenta y privacidad", text: "Eliminar mi cuenta y datos", to: "/settings/account" },
  ] },
];

const MODE_LABEL = { light: "Claro", dark: "Oscuro", system: "Sistema" } as const;

/** Fila plana: ícono con tinte, título y una línea de apoyo, separada de la siguiente por un divisor (sin tarjeta). */
function FlatRow({ icon, title, text, tint, ink, last, danger, onPress }: { icon: Row["icon"]; title: string; text?: string; tint: string; ink: string; last?: boolean; danger?: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: tint }}>
        <Ionicons name={icon} size={19} color={ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: danger ? colors.expenseStrong : colors.text, fontSize: 15, fontFamily: "AsapSemiBold" }}>{title}</Text>
        {text ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{text}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={17} color={colors.muted} />}
    </TouchableOpacity>
  );
}

/** Pestaña Más: tu perfil y todo lo que no vive en las otras pestañas, en listas planas por grupo. */
export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, logout } = useAuth();
  const dialog = useDialog();
  const { palette, themePreference } = useAppThemeContext();
  const [look, setLook] = useState(false);
  const name = profile?.displayName ?? "Mi cuenta";

  return (
    <Screen title="Más" back={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 4 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
          <Text style={{ color: colors.onPrimary, fontSize: 22, fontFamily: "AsapBold" }}>{name.trim().charAt(0).toUpperCase() || "E"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Txt bold size={18} numberOfLines={1}>{name}</Txt>
          <Txt size={13} muted numberOfLines={1}>{profile?.email ?? ""}</Txt>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <Label>Apariencia</Label>
        <FlatRow icon="color-palette-outline" title="Paleta y modo" text={`${PALETTE_INFO[palette].label} · ${MODE_LABEL[themePreference]}`} tint={`${colors.primary}12`} ink={colors.primary} last onPress={() => setLook(true)} />
      </View>

      {GROUPS.map((g) => {
        const a = colors.sections[g.section];
        return (
          <View key={g.title} style={{ gap: 2 }}>
            <Label>{g.title}</Label>
            {g.rows.map((r, i) => <FlatRow key={r.to} icon={r.icon} title={r.title} text={r.text} tint={a.tint} ink={a.ink} last={i === g.rows.length - 1} onPress={() => router.push(r.to as never)} />)}
          </View>
        );
      })}

      <FlatRow icon="log-out-outline" title="Cerrar sesión" tint={`${colors.expense}22`} ink={colors.expenseStrong} danger last
        onPress={async () => { if (await dialog.confirm({ title: "¿Cerrar sesión?", message: "Tendrás que volver a iniciar sesión para ver tus datos.", confirmLabel: "Cerrar sesión", cancelLabel: "Quedarme", danger: true })) await logout(); /* el guardián de sesión (Stack.Protected) lleva solo al inicio de sesión */ }} />

      <BottomSheet visible={look} onClose={() => setLook(false)} title="Apariencia" maxHeight={0.8}>
        <AppearanceCard bare />
      </BottomSheet>
    </Screen>
  );
}

function Label({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapBold", letterSpacing: 1, textTransform: "uppercase", marginTop: 6 }}>{children}</Text>;
}
