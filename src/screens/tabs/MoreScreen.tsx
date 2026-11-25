import React, { useCallback, useMemo, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import BottomSheet from "../../components/common/BottomSheet";
import GeminiMark from "../../components/common/GeminiMark";
import { Badge, Card, Empty, Screen, Txt } from "../../components/v1/ui";
import { PALETTE_INFO, Palettes, type SectionKey } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { MODULE_PRESETS, useModules } from "../../context/ModulesContext";
import { useAppThemeContext } from "../../context/ThemeContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { useLock } from "../../security/LockGate";
import { channelLabel } from "../../updates/aboutInfo";
import { SuggestionSheet } from "../../components/v1/SuggestionSheet";
import AppearanceCard from "./AppearanceCard";

type IconName = keyof typeof Ionicons.glyphMap;
type BadgeTone = "danger" | "warn" | "info" | "ok";

interface Item {
  id: string;
  icon: IconName;
  title: string;
  text: string;
  keywords: string;
  section?: SectionKey;
  badge?: { text: string; tone?: BadgeTone } | null;
  right?: React.ReactNode;
  onPress: () => void;
}

const MODE_OPTIONS: Array<{ id: "light" | "dark" | "system"; label: string; icon: IconName }> = [
  { id: "light", label: "Claro", icon: "sunny-outline" },
  { id: "dark", label: "Oscuro", icon: "moon-outline" },
  { id: "system", label: "Sistema", icon: "phone-portrait-outline" },
];

const MODE_LABEL = { light: "Claro", dark: "Oscuro", system: "Sistema" } as const;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function SectionLabel({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapBold", letterSpacing: 1, textTransform: "uppercase", marginTop: 4, marginLeft: 4 }}>
      {children}
    </Text>
  );
}

/** Fila dentro de una tarjeta agrupada, con ícono limpio sin fondo, estado opcional y divisor suave. */
function SettingRow({
  icon,
  title,
  text,
  ink,
  last,
  danger,
  badge,
  right,
  onPress,
}: {
  icon: IconName;
  title: string;
  text?: string;
  ink: string;
  last?: boolean;
  danger?: boolean;
  badge?: { text: string; tone?: BadgeTone } | null;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 26, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={21} color={ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: danger ? colors.expenseStrong : colors.text, fontSize: 15, fontFamily: "AsapSemiBold" }}>
          {title}
        </Text>
        {text ? (
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
            {text}
          </Text>
        ) : null}
      </View>
      {right}
      {badge ? <Badge text={badge.text} tone={badge.tone} /> : null}
      {!danger && <Ionicons name="chevron-forward" size={17} color={colors.muted} />}
    </TouchableOpacity>
  );
}

/** Tarjeta compacta de acceso rápido (grilla 2×2 de herramientas). */
function ToolTile({
  title,
  text,
  icon,
  customIcon,
  ink,
  badge,
  onPress,
}: {
  title: string;
  text: string;
  icon?: IconName;
  customIcon?: React.ReactNode;
  ink: string;
  badge?: { text: string; tone?: BadgeTone } | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: `${colors.text}0A`,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
          {customIcon ?? (icon ? <Ionicons name={icon} size={23} color={ink} /> : null)}
        </View>
        {badge ? <Badge text={badge.text} tone={badge.tone} /> : <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
      </View>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>
          {title}
        </Text>
        <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", lineHeight: 16 }}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Pestaña Más: perfil, herramientas frecuentes en 2×2 y configuración agrupada en tarjetas con estado en vivo. */
export default function MoreScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { profile, logout } = useAuth();
  const dialog = useDialog();
  const lock = useLock();
  const { palette, themePreference, setTheme } = useAppThemeContext();
  const { modules, preset } = useModules();
  const { isUpdatePending, currentlyRunning } = Updates.useUpdates();
  const presetLabel = preset === "custom" ? "Personalizado" : MODULE_PRESETS[preset].label;

  const [look, setLook] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const [query, setQuery] = useState("");

  // Estados vivos ligeros (se refrescan al volver a la pestaña; fallan en silencio si no hay red).
  const pendingProposals = useAsync(() => api.proposals("pending").then((xs) => xs.length).catch(() => 0), []);
  const prefs = useAsync(() => api.preferences().catch(() => null), []);
  const reloadMeta = useCallback(() => {
    void pendingProposals.reload();
    void prefs.reload();
  }, [pendingProposals.reload, prefs.reload]);
  useFocusReload(reloadMeta);

  const pendingCount = pendingProposals.data ?? 0;
  const notif = prefs.data?.notifications;
  const notifBadge: { text: string; tone?: BadgeTone } | null = notif
    ? (notif.enabled ? { text: notif.time, tone: "ok" } : { text: "Apagados" })
    : null;
  const lockBadge: { text: string; tone?: BadgeTone } = lock.enabled
    ? { text: "Activo", tone: "ok" }
    : { text: "Inactivo" };

  const name = profile?.displayName ?? "Mi cuenta";
  const appVersion = Constants.expoConfig?.version ?? "1.0.2";
  const channel = channelLabel(currentlyRunning.channel ?? Updates.channel, Updates.isEnabled);
  const aboutText = isUpdatePending ? "Hay una actualización lista para aplicar" : `Versión ${appVersion} · ${channel}`;

  const activeSample = Palettes[palette][isDark ? "dark" : "light"];
  const swatchColors = [activeSample.primarySurface, activeSample.fab, activeSample.accent, activeSample.card];

  const swatchPreview = (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 2 }}>
      {swatchColors.map((hex, idx) => (
        <View
          key={idx}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: hex,
            borderWidth: 1.5,
            borderColor: colors.card,
            marginLeft: idx === 0 ? 0 : -4,
          }}
        />
      ))}
    </View>
  );

  const go = (to: string) => router.push(to as never);

  const groups = useMemo<Array<{ title: string; items: Item[] }>>(() => [
    {
      title: "Personalización",
      items: [
        {
          id: "appearance",
          icon: "color-palette-outline",
          title: "Paleta y colores",
          text: `${PALETTE_INFO[palette].label} · ${MODE_LABEL[themePreference]}`,
          keywords: "apariencia tema paleta color claro oscuro modo",
          right: swatchPreview,
          onPress: () => setLook(true),
        },
        {
          id: "modules",
          icon: "layers-outline",
          title: "Módulos de EVA",
          text: "Elige qué apartados quieres activar",
          keywords: "modulos apartados servicios personas prestamos plan personalizar ocultar",
          section: "more",
          badge: { text: presetLabel, tone: "info" },
          onPress: () => go("/settings/modules"),
        },
        {
          id: "dashboard",
          icon: "apps-outline",
          title: "Panel y tarjetas",
          text: "Elige y ordena lo que ves en Inicio",
          keywords: "inicio dashboard tarjetas orden panel",
          section: "more",
          onPress: () => go("/settings/dashboard"),
        },
      ],
    },
    {
      title: "Automatización y avisos",
      items: [
        {
          id: "notifications",
          icon: "notifications-outline",
          title: "Avisos y recordatorios",
          text: "Qué avisar, a qué hora y silencio",
          keywords: "notificaciones avisos recordatorios alarmas",
          section: "more",
          badge: notifBadge,
          onPress: () => go("/settings/notifications"),
        },
        {
          id: "classification-rules",
          icon: "git-branch-outline",
          title: "Reglas de clasificación",
          text: "Asigna o sugiere categorías según texto o monto",
          keywords: "reglas clasificacion categorias automatico uber texto monto",
          section: "plan",
          onPress: () => go("/rules"),
        },
        {
          id: "sender-rules",
          icon: "funnel-outline",
          title: "Reglas por remitente",
          text: "Para correos recibidos en Captura",
          keywords: "captura reglas remitente correo automatico",
          section: "people",
          onPress: () => go("/capture/rules"),
        },
        {
          id: "general",
          icon: "options-outline",
          title: "Bloqueo y captura",
          text: "Tiempo de bloqueo, propuestas y duplicados",
          keywords: "general bloqueo automatico captura duplicados lote",
          section: "more",
          onPress: () => go("/settings/general"),
        },
        ...(modules.people ? [{
          id: "refunds",
          icon: "return-down-back-outline" as IconName,
          title: "Devoluciones",
          text: "Dinero que debes devolver",
          keywords: "reembolsos devoluciones cobros",
          section: "money" as SectionKey,
          onPress: () => go("/refunds"),
        }] : []),
      ],
    },
    {
      title: "Seguridad y cuenta",
      items: [
        {
          id: "lock",
          icon: "lock-closed-outline",
          title: "PIN y huella",
          text: "Proteger EVA en este teléfono",
          keywords: "seguridad pin huella biometria bloqueo",
          section: "more",
          badge: lockBadge,
          onPress: () => go("/settings/lock"),
        },
        {
          id: "backups",
          icon: "cloud-done-outline",
          title: "Respaldos",
          text: "Copias de seguridad y restaurar",
          keywords: "backup respaldo copia restaurar nube",
          section: "more",
          onPress: () => go("/settings/backups"),
        },
        {
          id: "password",
          icon: "key-outline",
          title: "Cambiar contraseña",
          text: "Elige una contraseña nueva",
          keywords: "clave password contraseña cuenta acceso",
          section: "more",
          onPress: () => go("/settings/password"),
        },
        {
          id: "billing",
          icon: "cash-outline",
          title: "Ajustes de cobro",
          text: "Días gratis y límite en bajas",
          keywords: "servicios suscripciones cobros dias gratis bajas",
          section: "more",
          onPress: () => go("/settings/billing"),
        },
        {
          id: "account",
          icon: "shield-checkmark-outline",
          title: "Cuenta y privacidad",
          text: "Eliminar mi cuenta y mis datos",
          keywords: "privacidad eliminar borrar cuenta datos",
          section: "more",
          onPress: () => go("/settings/account"),
        },
      ],
    },
    {
      title: "Soporte y app",
      items: [
        {
          id: "suggestions",
          icon: "chatbubble-ellipses-outline",
          title: "Sugerencias",
          text: "Cuéntame qué mejorar o qué falla",
          keywords: "ayuda soporte feedback error problema idea whatsapp correo",
          onPress: () => setSuggest(true),
        },
        {
          id: "about",
          icon: "information-circle-outline",
          title: "Acerca de EVA",
          text: aboutText,
          keywords: "version actualizacion ota servidor informacion app",
          badge: isUpdatePending ? { text: "Nueva", tone: "info" } : null,
          onPress: () => go("/settings/about"),
        },
      ],
    },
  ], [palette, themePreference, notifBadge, lockBadge, aboutText, isUpdatePending, isDark, modules.people, presetLabel]);

  // Todas las entradas (herramientas + perfil + ajustes) para el buscador rápido.
  const allSearchable = useMemo<Item[]>(() => {
    const tools: Item[] = [
      { id: "profile", icon: "person-outline", title: "Editar perfil", text: "Nombre, correo y foto", keywords: "perfil avatar foto nombre correo", onPress: () => go("/settings/profile") },
      { id: "ai", icon: "sparkles-outline", title: "Análisis con IA", text: "Pregunta sobre tus gastos", keywords: "ia inteligencia gemini preguntar gastos", section: "plan", onPress: () => go("/analysis") },
      { id: "chats", icon: "chatbubbles-outline", title: "Conversaciones guardadas", text: "Tus conversaciones con la IA", keywords: "ia chats historial conversaciones", section: "plan", onPress: () => go("/analysis/chats") },
      { id: "capture", icon: "scan-outline", title: "Bandeja de captura", text: "Comprobantes y correos por revisar", keywords: "captura yape plin comprobantes correo foto pdf", section: "people", badge: pendingCount > 0 ? { text: `${pendingCount} pend.`, tone: "danger" } : null, onPress: () => go("/capture") },
      { id: "reports", icon: "bar-chart-outline", title: "Resumen mensual", text: "Flujo, resultado y PDF", keywords: "reporte informe mensual flujo pdf", section: "money", onPress: () => go("/reports") },
      { id: "export", icon: "download-outline", title: "Exportar", text: "CSV, Excel y PDF", keywords: "exportar descargar csv excel pdf datos", section: "money", onPress: () => go("/export") },
    ];
    return [...tools, ...groups.flatMap((g) => g.items)];
  }, [groups, pendingCount]);

  const qNorm = norm(query.trim());
  const filtered = useMemo(
    () => (qNorm ? allSearchable.filter((it) => norm(`${it.title} ${it.text} ${it.keywords}`).includes(qNorm)) : []),
    [allSearchable, qNorm],
  );

  const accentFor = (section?: SectionKey) =>
    section ? colors.sections[section].ink : colors.primary;

  const confirmLogout = async () => {
    const ok = await dialog.confirm({
      title: "¿Cerrar sesión?",
      message: "Tendrás que volver a iniciar sesión para ver tus datos.",
      confirmLabel: "Cerrar sesión",
      cancelLabel: "Quedarme",
      danger: true,
    });
    if (ok) await logout();
  };

  return (
    <Screen title="Más" back={false}>
      {/* Buscador rápido */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: qNorm ? colors.primary : colors.border,
        }}
      >
        <Ionicons name="search-outline" size={18} color={qNorm ? colors.primary : colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar herramienta o ajuste…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: "Asap", paddingVertical: 8 }}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {qNorm ? (
        filtered.length === 0 ? (
          <Empty icon="search-outline" title="Sin resultados" text={`No encontramos nada con «${query.trim()}».`} />
        ) : (
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            {filtered.map((it, idx) => (
              <SettingRow
                key={it.id}
                icon={it.icon}
                title={it.title}
                text={it.text}
                ink={accentFor(it.section)}
                badge={it.badge}
                right={it.right}
                last={idx === filtered.length - 1}
                onPress={it.onPress}
              />
            ))}
          </Card>
        )
      ) : (
        <>
          {/* Tarjeta de perfil protagonista */}
          <TouchableOpacity onPress={() => go("/settings/profile")} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Editar perfil">
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.elevated, borderWidth: 2, borderColor: `${colors.primary}25` }}
                />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
                  <Text style={{ color: colors.onPrimary, fontSize: 23, fontFamily: "AsapBold" }}>
                    {name.trim().charAt(0).toUpperCase() || "E"}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Txt bold size={18} numberOfLines={1}>{name}</Txt>
                <Txt size={13} muted numberOfLines={1}>{profile?.email ?? "Toca para completar tu perfil"}</Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: `${colors.primary}14` }}>
                <Ionicons name="pencil-outline" size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Editar</Text>
              </View>
            </Card>
          </TouchableOpacity>

          {/* Herramientas frecuentes en grilla 2×2 */}
          <View style={{ gap: 8 }}>
            <SectionLabel>Herramientas</SectionLabel>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ToolTile
                title="Análisis con IA"
                text="Pregunta sobre tus gastos"
                customIcon={<GeminiMark size={23} id="more-ai" />}
                ink={colors.sections.plan.ink}
                onPress={() => go("/analysis")}
              />
              <ToolTile
                title="Captura"
                text={pendingCount > 0 ? `${pendingCount} por revisar` : "Comprobantes y correos"}
                icon="scan-outline"
                ink={colors.sections.people.ink}
                badge={pendingCount > 0 ? { text: String(pendingCount), tone: "danger" } : null}
                onPress={() => go("/capture")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ToolTile
                title="Resumen mensual"
                text="Flujo, resultado y PDF"
                icon="bar-chart-outline"
                ink={colors.sections.money.ink}
                onPress={() => go("/reports")}
              />
              <ToolTile
                title="Exportar"
                text="CSV, Excel y PDF"
                icon="download-outline"
                ink={colors.sections.money.ink}
                onPress={() => go("/export")}
              />
            </View>
            <Card style={{ paddingVertical: 2, gap: 0 }}>
              <SettingRow
                icon="chatbubbles-outline"
                title="Conversaciones guardadas"
                text="Tu historial con la IA"
                ink={colors.sections.plan.ink}
                last
                onPress={() => go("/analysis/chats")}
              />
            </Card>
          </View>

          {/* Configuración agrupada en 4 tarjetas limpias */}
          {groups.map((g) => (
            <View key={g.title} style={{ gap: 6 }}>
              <SectionLabel>{g.title}</SectionLabel>
              <Card style={{ paddingVertical: 4, gap: 0 }}>
                {g.items.map((it, idx) => {
                  const ink = accentFor(it.section);
                  const isAppearance = it.id === "appearance";
                  return (
                    <React.Fragment key={it.id}>
                      <SettingRow
                        icon={it.icon}
                        title={it.title}
                        text={it.text}
                        ink={ink}
                        badge={it.badge}
                        right={it.right}
                        last={!isAppearance && idx === g.items.length - 1}
                        onPress={it.onPress}
                      />
                      {/* Selector rápido de modo Claro / Oscuro / Sistema en 1 toque */}
                      {isAppearance && (
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            paddingVertical: 10,
                            borderBottomWidth: idx === g.items.length - 1 ? 0 : 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          {MODE_OPTIONS.map((m) => {
                            const on = themePreference === m.id;
                            return (
                              <TouchableOpacity
                                key={m.id}
                                onPress={() => setTheme(m.id)}
                                activeOpacity={0.8}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                style={{
                                  flex: 1,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 5,
                                  height: 36,
                                  borderRadius: 12,
                                  backgroundColor: on ? colors.primarySurface : `${colors.primary}12`,
                                }}
                              >
                                <Ionicons name={m.icon} size={14} color={on ? colors.onPrimary : colors.primary} />
                                <Text style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 12.5, fontFamily: "AsapBold" }}>
                                  {m.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </Card>
            </View>
          ))}

          {/* Cerrar sesión separado */}
          <Card style={{ paddingVertical: 2, gap: 0, borderColor: `${colors.expense}28`, marginTop: 4 }}>
            <SettingRow
              icon="log-out-outline"
              title="Cerrar sesión"
              ink={colors.expenseStrong}
              danger
              last
              onPress={confirmLogout}
            />
          </Card>

          <TouchableOpacity onPress={() => go("/settings/about")} activeOpacity={0.7} accessibilityRole="button" style={{ alignItems: "center", paddingTop: 2, paddingBottom: 4 }}>
            <Txt size={11} muted>EVA v{appVersion} · {channel}</Txt>
          </TouchableOpacity>
        </>
      )}

      <SuggestionSheet visible={suggest} onClose={() => setSuggest(false)} />

      <BottomSheet visible={look} onClose={() => setLook(false)} title="Apariencia" maxHeight={0.8}>
        <AppearanceCard bare />
      </BottomSheet>
    </Screen>
  );
}
