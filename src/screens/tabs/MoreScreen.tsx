import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Heading, MenuRow, Screen, Txt } from "../../components/v1/ui";
import type { SectionKey } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useAppThemeContext } from "../../context/ThemeContext";
import { useAppTheme } from "../../hooks/useAppTheme";

type Row = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; to: string };
const GROUPS: Array<{ title: string; section: SectionKey; rows: Row[] }> = [
  { title: "Inteligencia", section: "plan", rows: [
    { icon: "sparkles-outline", title: "Análisis con IA", text: "Pregunta sobre tus gastos por periodo, cuentas o servicios", to: "/analysis" },
    { icon: "chatbubbles-outline", title: "Chats guardados", text: "Conversaciones sobre tus datos", to: "/analysis/chats" },
  ] },
  { title: "Captura", section: "people", rows: [
    { icon: "scan-outline", title: "Bandeja de captura", text: "Comprobantes y correos por revisar", to: "/capture" },
    { icon: "funnel-outline", title: "Reglas por remitente", text: "Qué cuenta o categoría usar según quién envía", to: "/capture/rules" },
  ] },
  { title: "Informes", section: "money", rows: [
    { icon: "bar-chart-outline", title: "Resumen mensual", text: "Flujo de dinero, resultado, versiones y PDF", to: "/reports" },
    { icon: "download-outline", title: "Exportar", text: "CSV, Excel y PDF con lo que elijas", to: "/export" },
    { icon: "return-down-back-outline", title: "Devoluciones", text: "Dinero que debes devolver a alguien", to: "/refunds" },
  ] },
  { title: "Seguridad y datos", section: "more", rows: [
    { icon: "lock-closed-outline", title: "PIN y huella", text: "Bloquear la app en este teléfono", to: "/settings/lock" },
    { icon: "notifications-outline", title: "Avisos y recordatorios", text: "Qué avisar, cuándo y con qué detalle", to: "/settings/notifications" },
    { icon: "cloud-done-outline", title: "Respaldos", text: "Copias, restaurar y exportar", to: "/settings/backups" },
    { icon: "apps-outline", title: "Panel y tarjetas", text: "Elige y ordena lo que ves", to: "/settings/dashboard" },
    { icon: "options-outline", title: "Bloqueo y captura", text: "Re-bloqueo, revisión de propuestas y duplicados", to: "/settings/general" },
  ] },
  { title: "Cuenta", section: "more", rows: [
    { icon: "cash-outline", title: "Ajustes de cobro", text: "Días gratis al incorporar y límite en bajas", to: "/settings/billing" },
    { icon: "shield-checkmark-outline", title: "Cuenta y privacidad", text: "Eliminar mi cuenta y mis datos", to: "/settings/account" },
  ] },
];

/** Pestaña Más: tu perfil y todo lo que no vive en las otras pestañas, agrupado. */
export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useAppThemeContext();

  return (
    <Screen title="Más" back={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.text}08` }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}15` }}>
          <Ionicons name="person" size={28} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt bold size={18} numberOfLines={1}>{profile?.displayName ?? "Mi cuenta"}</Txt>
          <Txt size={12} muted numberOfLines={1}>{profile?.email ?? ""}</Txt>
        </View>
        <TouchableOpacity onPress={toggleTheme} accessibilityRole="button" accessibilityLabel={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12` }}>
          <Ionicons name={theme === "dark" ? "sunny-outline" : "moon-outline"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {GROUPS.map((g) => (
        <React.Fragment key={g.title}>
          <Heading>{g.title}</Heading>
          {g.rows.map((r) => <MenuRow key={r.to} section={g.section} icon={r.icon} title={r.title} text={r.text} onPress={() => router.push(r.to as never)} />)}
        </React.Fragment>
      ))}

      <TouchableOpacity onPress={async () => { await logout(); router.replace("/"); }} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, marginTop: 8 }}>
        <Ionicons name="log-out-outline" size={20} color={colors.expenseStrong} />
        <Text style={{ color: colors.expenseStrong, fontSize: 15, fontFamily: "AsapBold" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </Screen>
  );
}
