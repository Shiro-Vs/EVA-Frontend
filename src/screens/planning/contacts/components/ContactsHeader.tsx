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
    <View style={{ paddingTop: 2, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>Te deben</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: none ? colors.text : colors.incomeStrong, fontSize: 34, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}>
            {formatSoles(totalDeuda)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
            {none ? `Todos al día · ${count} ${count === 1 ? "persona" : "personas"}` : `${debtorCount} con deuda · ${count - debtorCount} al día`}
          </Text>
        </View>
        {!none && (
          <TouchableOpacity onPress={onRemindPress} accessibilityRole="button" activeOpacity={0.85} style={{ height: 40, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySurface }}>
            <Ionicons name="logo-whatsapp" size={17} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontSize: 13.5, fontFamily: "AsapBold" }}>Recordar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
