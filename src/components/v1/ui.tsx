import React from "react";
import { ActivityIndicator, Platform, ScrollView, Switch, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { EVAInput } from "../common/EVAInput";
import { formatSoles } from "../../utils/money";
import type { SectionKey } from "../../constants/Colors";
import { control, minTouch, radius } from "../../constants/Layout";

// Componentes base de las pantallas nuevas. Reproducen el lenguaje visual de la app: botón de volver circular,
// tarjetas rounded-3xl con borde tenue, botones rounded-2xl con primarySurface y chips pequeños en mayúsculas.
type IconName = keyof typeof Ionicons.glyphMap;

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
      accessibilityLabel="Volver" accessibilityRole="button" activeOpacity={0.7}
      style={{ width: minTouch, height: minTouch, borderRadius: minTouch / 2, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
    >
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
    </TouchableOpacity>
  );
}

/** Pantalla con cabecera, contenido desplazable y, opcionalmente, un pie con la acción principal. */
export function Screen({ title, children, back = true, right, footer, subtitle }: { title: string; children: React.ReactNode; back?: boolean; right?: React.ReactNode; footer?: React.ReactNode; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginTop: 24, marginBottom: 20 }}>
        {back && <BackButton />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontFamily: "AsapBold" }} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "Asap" }}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: footer ? 16 : 120, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && <View style={{ paddingHorizontal: 24, paddingBottom: Platform.OS === "web" ? 16 : 12, paddingTop: 12, backgroundColor: colors.background }}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, outlined, style }: { children: React.ReactNode; outlined?: boolean; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ backgroundColor: outlined ? `${colors.card}80` : colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: outlined ? `${colors.text}10` : `${colors.text}05` }, style]}>
      {children}
    </View>
  );
}

/** Tarjeta destacada de color primario con círculos decorativos (como la del saldo total y la de contactos). */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ backgroundColor: colors.primarySurface, borderRadius: 32, padding: 24, overflow: "hidden" }, style]}>
      <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)" }} />
      <View style={{ position: "absolute", bottom: -80, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(0,0,0,0.1)" }} />
      {children}
    </View>
  );
}

export function Heading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontFamily: "AsapBold" }}>{children}</Text>
      {action}
    </View>
  );
}

export function Txt({ children, bold, size = 15, color, muted, style, numberOfLines }: { children: React.ReactNode; bold?: boolean; size?: number; color?: string; muted?: boolean; style?: object; numberOfLines?: number }) {
  const { colors } = useAppTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? colors.textSecondary : colors.text), fontSize: size, fontFamily: bold ? "AsapBold" : "Asap" }, style]}>{children}</Text>;
}

export function KV({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.text}08`, gap: 12 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "Asap", flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: color ?? colors.text, fontSize: 14, fontFamily: strong ? "AsapBold" : "AsapMedium" }}>{value}</Text>
    </View>
  );
}

export function Money({ value, size = 16, bold = true, tone }: { value: string; size?: number; bold?: boolean; tone?: "income" | "expense" | "muted" }) {
  const { colors } = useAppTheme();
  const color = tone === "expense" ? colors.expenseStrong : tone === "income" ? colors.incomeStrong : tone === "muted" ? colors.textSecondary : colors.text;
  return <Text style={{ color, fontSize: size, fontFamily: bold ? "AsapBold" : "Asap" }}>{formatSoles(value)}</Text>;
}

/** `regular` (56) para acciones de formulario y pie de pantalla; `compact` (44) para botones en línea o en cabeceras. */
export function Button({ title, onPress, variant = "primary", busy, disabled, icon, size = "regular" }: { title: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; busy?: boolean; disabled?: boolean; icon?: IconName; size?: "regular" | "compact" }) {
  const { colors } = useAppTheme();
  const compact = size === "compact";
  const primary = variant === "primary", danger = variant === "danger";
  const off = disabled || busy;
  const fg = primary || danger ? colors.onPrimary : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress} disabled={off} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={{
        height: compact ? control.compact : control.regular, paddingHorizontal: compact ? 16 : 0, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: off ? 0.55 : 1,
        backgroundColor: primary ? colors.primarySurface : danger ? colors.dangerSurface : `${colors.primary}15`,
        shadowColor: primary ? colors.primary : "transparent", shadowOpacity: primary ? 0.2 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      }}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={compact ? 16 : 18} color={fg} />}
          <Text style={{ color: fg, fontSize: compact ? 14 : 16, fontFamily: "AsapBold" }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Aviso en línea con los colores `alert.*` del tema. */
const TONES = { ok: ["checkmark-circle", "success"], warn: ["alert-circle", "warning"], err: ["close-circle", "error"], info: ["information-circle", "info"] } as const;
export function Notice({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [icon, key] = TONES[tone];
  const a = colors.alert[key];
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: a.border, backgroundColor: a.bg, alignItems: "flex-start" }}>
      <Ionicons name={icon as IconName} size={18} color={a.icon} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: "Asap" }}>{children}</Text>
    </View>
  );
}

const CHIPS: Record<string, { text: string; tone: "ok" | "warn" | "info" | "err" | "muted" }> = {
  paid: { text: "Pagado", tone: "ok" }, partial: { text: "Parcial", tone: "warn" }, unpaid: { text: "Pendiente", tone: "muted" },
  exempt: { text: "Cortesía", tone: "info" }, converted: { text: "Convertido", tone: "muted" }, overdue: { text: "Vencido", tone: "err" },
};
/** Etiqueta pequeña en mayúsculas, como "COMPARTIDO" o "PAGADO" en tus pantallas. */
export function Chip({ status, label }: { status: string; label?: string }) {
  const { colors } = useAppTheme();
  const c = CHIPS[status] ?? { text: status, tone: "muted" as const };
  const col = c.tone === "ok" ? colors.incomeStrong : c.tone === "warn" ? colors.warningStrong : c.tone === "err" ? colors.expenseStrong : c.tone === "info" ? colors.primary : colors.textSecondary;
  return (
    <View style={{ backgroundColor: `${col}15`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
      <Text style={{ color: col, fontSize: 11, fontFamily: "AsapBold", textTransform: "uppercase" }}>{label ?? c.text}</Text>
    </View>
  );
}

/** Insignia compacta con ícono opcional (como las de cuenta / compartido / día en el encabezado del servicio). */
export function Badge({ text, icon, color, tone }: { text: string; icon?: IconName; color?: string; tone?: "danger" | "warn" | "info" | "ok" }) {
  const { colors } = useAppTheme();
  // `tone` usa los colores semánticos del tema (con contraste verificado); `color` queda para colores de marca (p. ej. el de un servicio).
  const c = tone === "danger" ? colors.expenseStrong : tone === "warn" ? colors.warningStrong : tone === "info" ? colors.primary : tone === "ok" ? colors.incomeStrong : color ?? colors.textSecondary;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: `${c}12`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
      {icon && <Ionicons name={icon} size={12} color={c} />}
      <Text style={{ color: c, fontSize: 11, fontFamily: "AsapBold", marginLeft: icon ? 4 : 0 }}>{text}</Text>
    </View>
  );
}

export function Field(props: React.ComponentProps<typeof EVAInput>) {
  return <EVAInput autoCapitalize="none" autoCorrect={false} {...props} />;
}

export function Loading({ text = "Cargando…" }: { text?: string }) {
  const { colors } = useAppTheme();
  return <View style={{ padding: 40, alignItems: "center", gap: 10 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSecondary, fontFamily: "Asap" }}>{text}</Text></View>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Notice tone="err">{message}</Notice>
      {onRetry && <Button title="Reintentar" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: "center", padding: 24, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.muted}15` }}>
        <Ionicons name={icon} size={32} color={colors.muted} />
      </View>
      <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>{text}</Text>
      {action}
    </View>
  );
}

export function RowLink({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button"
      style={{ backgroundColor: `${colors.card}80`, borderRadius: 24, borderWidth: 1, borderColor: `${colors.text}10`, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
      {children}
    </TouchableOpacity>
  );
}

/** «Ver todo» junto a un encabezado de sección (se pasa a `Heading action`). */
export function SeeAll({ onPress, label = "Ver todo" }: { onPress: () => void; label?: string }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "AsapSemiBold" }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Cifra con su etiqueta, para los resúmenes de la parte alta de cada pestaña. */
export function SummaryTile({ label, value, tone, icon, onPress }: { label: string; value: string; tone?: "income" | "expense" | "muted"; icon?: IconName; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const color = tone === "expense" ? colors.expenseStrong : tone === "income" ? colors.incomeStrong : colors.text;
  const body = (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: `${colors.text}08`, padding: 14, gap: 4, minHeight: 78, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon && <Ionicons name={icon} size={14} color={colors.textSecondary} />}
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapMedium", textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 1 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 18, fontFamily: "AsapBold" }}>{value}</Text>
    </View>
  );
  return onPress ? <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.75} onPress={onPress} accessibilityRole="button">{body}</TouchableOpacity> : <View style={{ flex: 1 }}>{body}</View>;
}

/** Fila de menú con ícono, título y descripción: la misma en Dinero, Personas, Planificar y Más. */
export function MenuRow({ icon, title, text, onPress, badge, section }: { icon: IconName; title: string; text?: string; onPress: () => void; badge?: string | number | null; section?: SectionKey }) {
  const { colors } = useAppTheme();
  const accent = section ? colors.sections[section] : { ink: colors.primary, tint: `${colors.primary}12` };
  return (
    <RowLink onPress={onPress}>
      <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: accent.tint }}>
        <Ionicons name={icon} size={20} color={accent.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{title}</Text>
        {text ? <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{text}</Text> : null}
      </View>
      {badge ? <Badge text={String(badge)} tone="danger" /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </RowLink>
  );
}

/** Fila con interruptor: texto a la izquierda, interruptor a la derecha, altura mínima táctil. Es la única forma de poner un interruptor. */
export function SwitchRow({ label, hint, value, onValueChange, accessibilityLabel }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: minTouch, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontFamily: "Asap" }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={accessibilityLabel ?? label} />
    </View>
  );
}
