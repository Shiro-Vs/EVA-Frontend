import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { Charge } from "../../../../api/types";
import { humanDate } from "../../../../utils/dates";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface SharedParticipantsListProps {
  charges: Charge[];
  onPressCharge: (c: Charge) => void;
  onRemindParticipant: (contactId: string) => void;
}

/** Estado de pago de cada participante en el ciclo seleccionado (misma tarjeta con indicador lateral de antes). */
export const SharedParticipantsList: React.FC<SharedParticipantsListProps> = ({ charges, onPressCharge, onRemindParticipant }) => {
  const { colors, fonts } = useAppTheme();

  const statusOf = (c: Charge) => {
    if (c.paymentStatus === "exempt") return { bg: `${colors.primary}15`, fg: colors.primary, label: "CORTESÍA", icon: "gift", bar: colors.primary };
    if (c.paymentStatus === "paid") return { bg: `${colors.income}15`, fg: colors.incomeStrong, label: "PAGADO", icon: undefined, bar: colors.income };
    if (c.paymentStatus === "partial") return { bg: `${colors.warning}15`, fg: colors.warning, label: c.overdue ? "PARCIAL · VENCIDO" : "PARCIAL", icon: undefined, bar: colors.warning };
    if (c.overdue) return { bg: `${colors.expense}15`, fg: colors.expenseStrong, label: "VENCIDO", icon: undefined, bar: colors.expense };
    return { bg: `${colors.textSecondary}10`, fg: colors.textSecondary, label: "PENDIENTE", icon: undefined, bar: colors.warning };
  };

  if (charges.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 32 }}>
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 13, textAlign: "center" }}>
          Este ciclo todavía no tiene cargos para los participantes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      {charges.map((c) => {
        const status = statusOf(c);
        const settled = c.paymentStatus === "paid" || c.paymentStatus === "exempt";
        const hasPending = cmpMoney(c.pending, "0.00") > 0;
        return (
          <TouchableOpacity
            key={c.obligationId}
            onPress={() => onPressCharge(c)}
            style={{
              backgroundColor: colors.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              borderLeftWidth: 4, borderLeftColor: status.bar, borderWidth: 1, borderColor: `${colors.text}05`,
              opacity: c.paymentStatus === "exempt" ? 0.8 : 1,
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: `${colors.primary}15` }}>
                <Text style={{ fontFamily: fonts.family.bold, fontSize: 14, color: colors.primary }}>{c.contactName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontFamily: fonts.family.bold, fontSize: 14 }} numberOfLines={1}>{c.contactName}</Text>
                <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 11 }}>
                  {c.seatLabel} · vence {humanDate(c.dueDate)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 12 }}>
                    {settled ? formatSoles(c.paymentStatus === "exempt" ? "0.00" : c.applied) : `Debe ${formatSoles(c.pending)}`}
                  </Text>
                  {!settled && cmpMoney(c.applied, "0.00") > 0 && (
                    <Text style={{ color: `${colors.text}50`, fontFamily: fonts.family.regular, fontSize: 9, marginLeft: 8 }}>
                      (pagó {formatSoles(c.applied)} de {formatSoles(c.net)})
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ backgroundColor: status.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: hasPending ? 12 : 0, flexDirection: "row", alignItems: "center" }}>
                {status.icon && <Ionicons name={status.icon as any} size={10} color={status.fg} style={{ marginRight: 4 }} />}
                <Text style={{ color: status.fg, fontFamily: fonts.family.bold, fontSize: 8, textTransform: "uppercase" }}>{status.label}</Text>
              </View>
              {hasPending && (
                <TouchableOpacity
                  onPress={() => onRemindParticipant(c.contactId)}
                  accessibilityLabel={`Preparar mensaje de cobro para ${c.contactName}`}
                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.income}15`, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={colors.income} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

export default SharedParticipantsList;
