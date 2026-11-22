import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { AccountType } from "../../api/types";
import { bankPreset, CARD_PATTERNS, CARD_THEMES, cardThemeById, normalizeCardPattern, type CardPattern } from "../../constants/banks";
import { useAppTheme } from "../../hooks/useAppTheme";
import { cmpMoney, formatSoles } from "../../utils/money";

const MASK = "S/ ••••";

export interface BankCardData {
  name: string;
  type: AccountType;
  institution?: string | null;
  balance: string;
  color?: string | null;
  icon?: string | null;
}

/** Tarjeta bancaria con proporción real (1.586:1), chip dorado, contactless, colores por entidad o personalizados y acabado. */
export function BankCard({
  account: a,
  width,
  height,
  hidden = false,
  onPress,
}: {
  account: BankCardData;
  width: number;
  height: number;
  hidden?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const credit = a.type === "credit";
  const wallet = a.type === "cash" || a.type === "wallet";
  const customTheme = cardThemeById(a.color);
  const brand = bankPreset(a.institution, a.name);
  const activeGradient = customTheme?.colors ?? brand?.colors ?? null;
  const hasCustomOrBrand = !!activeGradient;
  const bg = activeGradient ? activeGradient[1] : credit ? colors.card : wallet ? colors.accent : colors.primarySurface;
  const ink = customTheme?.ink ?? brand?.ink ?? (credit ? colors.text : wallet ? colors.onAccent : colors.onPrimary);
  const soft = customTheme?.soft ?? brand?.soft ?? (credit ? colors.textSecondary : wallet ? colors.onAccent : colors.onPrimaryMuted);
  const pattern = normalizeCardPattern(a.icon);
  const owes = cmpMoney(a.balance, "0.00") < 0;
  const kind = credit ? "CRÉDITO" : a.type === "cash" ? "EFECTIVO" : a.type === "wallet" ? "BILLETERA" : a.type === "savings" ? "AHORROS" : "DÉBITO";
  const headerLabel = a.institution?.trim() || brand?.label || a.name.trim() || "Mi cuenta";
  const footerName = a.name.trim() || "Nombre de cuenta";

  const content = (
    <View
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: bg,
        borderWidth: credit && !hasCustomOrBrand ? 1 : 0,
        borderColor: colors.borderStrong,
      }}
    >
      {activeGradient && (
        <LinearGradient
          colors={activeGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <LinearGradient
        colors={
          credit && !hasCustomOrBrand
            ? ["rgba(255,255,255,0.06)", "rgba(0,0,0,0.12)"]
            : ["rgba(255,255,255,0.22)", "rgba(255,255,255,0)", "rgba(0,0,0,0.18)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {pattern === "circles" && (
        <>
          <View style={{ position: "absolute", top: -width * 0.28, right: -width * 0.18, width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, backgroundColor: credit && !hasCustomOrBrand ? `${colors.text}07` : "rgba(255,255,255,0.10)" }} />
          <View style={{ position: "absolute", bottom: -width * 0.38, left: -width * 0.12, width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, backgroundColor: credit && !hasCustomOrBrand ? `${colors.text}05` : "rgba(255,255,255,0.06)" }} />
        </>
      )}

      {pattern === "diagonal" && (
        <>
          <View style={{ position: "absolute", top: -height * 0.4, left: width * 0.12, width: width * 0.32, height: height * 2, transform: [{ rotate: "24deg" }], backgroundColor: "rgba(255,255,255,0.09)" }} />
          <View style={{ position: "absolute", top: -height * 0.4, left: width * 0.56, width: width * 0.18, height: height * 2, transform: [{ rotate: "24deg" }], backgroundColor: "rgba(255,255,255,0.06)" }} />
        </>
      )}

      {pattern === "waves" && (
        <>
          <View style={{ position: "absolute", top: -width * 0.1, right: -width * 0.25, width: width * 0.75, height: width * 0.75, borderRadius: width * 0.375, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.16)" }} />
          <View style={{ position: "absolute", top: -width * 0.02, right: -width * 0.16, width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)" }} />
          <View style={{ position: "absolute", top: width * 0.06, right: -width * 0.07, width: width * 0.36, height: width * 0.36, borderRadius: width * 0.18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)" }} />
        </>
      )}

      <View style={{ flex: 1, padding: 13, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text numberOfLines={1} style={{ color: ink, fontSize: 13, fontFamily: "AsapBold", letterSpacing: 0.3, maxWidth: "76%" }}>{headerLabel}</Text>
          <Ionicons name="wifi" size={16} color={soft} style={{ transform: [{ rotate: "90deg" }] }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <View style={{ width: 30, height: 22, borderRadius: 5, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.25)" }}>
            <LinearGradient colors={["#EBD28E", "#B98F3E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
              <View style={{ position: "absolute", top: 7, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", top: 14, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
            </LinearGradient>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
            <Text style={{ color: soft, fontSize: 10, fontFamily: "AsapMedium", letterSpacing: 1 }}>
              {credit ? (owes || cmpMoney(a.balance, "0.00") === 0 ? "DEUDA" : "A FAVOR") : "SALDO"}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                color: credit && owes && !hasCustomOrBrand ? colors.expenseStrong : ink,
                fontSize: 18,
                fontFamily: "AsapBold",
                fontVariant: ["tabular-nums"],
              }}
            >
              {hidden ? MASK : formatSoles(credit && owes ? a.balance.replace("-", "") : a.balance)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>{footerName}</Text>
          <Text style={{ color: soft, fontSize: 10, fontFamily: "AsapBold", letterSpacing: 1 }}>{kind}</Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${hidden ? "oculto" : formatSoles(a.balance)}`}
    >
      {content}
    </TouchableOpacity>
  );
}

/** Selector visual para personalizar el color y acabado de una tarjeta bancaria (con vista previa en vivo). */
export function BankCardCustomizer({
  account,
  color,
  pattern,
  onChangeColor,
  onChangePattern,
}: {
  account: BankCardData;
  color: string | null;
  pattern: CardPattern;
  onChangeColor: (color: string | null) => void;
  onChangePattern: (pattern: CardPattern) => void;
}) {
  const { colors } = useAppTheme();
  const autoPreset = bankPreset(account.institution, account.name);
  const autoSwatch = autoPreset?.colors[0] ?? colors.primarySurface;
  const previewW = 240;
  const previewH = Math.round(previewW / 1.586);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: "center", paddingVertical: 4 }}>
        <BankCard account={{ ...account, color, icon: pattern }} width={previewW} height={previewH} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1.2, marginLeft: 4 }}>
          Color de la tarjeta
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          <TouchableOpacity
            onPress={() => onChangeColor(null)}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === null }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              minHeight: 36,
              borderRadius: 99,
              borderWidth: color === null ? 1.5 : 1,
              borderColor: color === null ? colors.primary : colors.border,
              backgroundColor: color === null ? `${colors.primary}14` : colors.card,
            }}
          >
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: autoSwatch, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }} />
            <Text style={{ color: color === null ? colors.primary : colors.text, fontSize: 12, fontFamily: color === null ? "AsapBold" : "AsapMedium" }}>
              {autoPreset ? `Auto (${autoPreset.label})` : "Automático"}
            </Text>
          </TouchableOpacity>

          {CARD_THEMES.map((t) => {
            const on = color === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => onChangeColor(t.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  minHeight: 36,
                  borderRadius: 99,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? `${colors.primary}14` : colors.card,
                }}
              >
                <LinearGradient
                  colors={t.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
                />
                <Text style={{ color: on ? colors.primary : colors.text, fontSize: 12, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1.2, marginLeft: 4 }}>
          Acabado
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {CARD_PATTERNS.map((p) => {
            const on = pattern === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => onChangePattern(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  paddingHorizontal: 12,
                  minHeight: 34,
                  justifyContent: "center",
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? `${colors.primary}18` : "transparent",
                }}
              >
                <Text style={{ color: on ? colors.primary : colors.text, fontSize: 12, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
