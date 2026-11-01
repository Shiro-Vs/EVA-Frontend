import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Contact } from "../../../../interfaces/Contact";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { getAdjustedColor } from "../../../../utils/serviceIcons";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ContactListProps {
  contacts: Contact[];
  onContactPress: (contact: Contact) => void;
  onMenuPress: (contact: Contact) => void;
}

/** Lista plana de personas: la barra de la izquierda indica si debe; editar y archivar están en el menú ⋯. */
export function ContactList({ contacts, onContactPress, onMenuPress }: ContactListProps) {
  const { colors, isDark } = useAppTheme();

  if (contacts.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
        <Ionicons name="people-outline" size={32} color={colors.muted} />
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "AsapMedium" }}>No se encontraron personas</Text>
      </View>
    );
  }

  return (
    <View>
      {contacts.map((c, i) => {
        const owes = cmpMoney(c.deuda ?? "0.00", "0.00") > 0;
        const services = c.total_servicios || 0;
        const bar = owes ? colors.expense : services > 0 ? colors.income : colors.muted;
        return (
          <TouchableOpacity key={c.id} onPress={() => onContactPress(c)} activeOpacity={0.75} accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
            <View style={{ alignSelf: "stretch", width: 4, borderRadius: 2, backgroundColor: bar }} />
            <EVAAvatar name={c.nombre} color={getAdjustedColor(c.color, isDark)} size={40} fontSize={17} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{c.nombre}</Text>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                {services === 0 ? "Sin servicios" : `${services} ${services === 1 ? "servicio" : "servicios"}`}
              </Text>
            </View>
            {services > 0 && (
              <Text style={{ color: owes ? colors.expenseStrong : colors.incomeStrong, fontSize: 13, fontFamily: "AsapBold" }}>
                {owes ? `Debe ${formatSoles(c.deuda)}` : "Al día"}
              </Text>
            )}
            <TouchableOpacity onPress={() => onMenuPress(c)} accessibilityRole="button" accessibilityLabel={`Acciones de ${c.nombre}`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
