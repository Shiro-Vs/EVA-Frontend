import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { formatSoles } from "../../../../utils/money";

interface ContactsHeaderProps {
  totalDeuda: string;
  count: number;
  debtorCount: number;
  onRemindPress: () => void;
}

/** Resumen compacto: lo que te deben, cuántas personas deben y el acceso a cobrar. El total lo calcula el servidor. */
export function ContactsHeader({ totalDeuda, count, debtorCount, onRemindPress }: ContactsHeaderProps) {
  const { colors } = useAppTheme();
  const none = debtorCount === 0;

  return (
    <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 16, overflow: "hidden", gap: 12 }}>
      <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Te deben</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 30, fontFamily: "AsapBold" }}>{formatSoles(totalDeuda)}</Text>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "Asap" }}>
            {none ? `Todos al día · ${count} ${count === 1 ? "persona" : "personas"}` : `${debtorCount} con deuda · ${count - debtorCount} al día`}
          </Text>
        </View>
        {!none && (
          <TouchableOpacity onPress={onRemindPress} accessibilityRole="button" activeOpacity={0.85} style={{ height: 40, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent }}>
            <Ionicons name="logo-whatsapp" size={17} color={colors.onAccent} />
            <Text style={{ color: colors.onAccent, fontSize: 13.5, fontFamily: "AsapBold" }}>Recordar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
