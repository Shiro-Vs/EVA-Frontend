import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Charge } from "../../../../api/types";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { humanDate } from "../../../../utils/dates";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface SharedParticipantsListProps {
  charges: Charge[];
  onPressCharge: (c: Charge) => void;
  onRemindParticipant: (contactId: string) => void;
}

/** Lista plana de participantes: la barra de la izquierda indica si pagó, lo que debe y el aviso por WhatsApp. */
export const SharedParticipantsList: React.FC<SharedParticipantsListProps> = ({ charges, onPressCharge, onRemindParticipant }) => {
  const { colors } = useAppTheme();

  const statusOf = (c: Charge) => {
    if (c.paymentStatus === "exempt") return { fg: colors.primary, bar: colors.primary, label: "Cortesía", icon: "gift-outline" as const };
    if (c.paymentStatus === "paid") return { fg: colors.incomeStrong, bar: colors.income, label: "Pagado", icon: "checkmark-circle" as const };
    if (c.paymentStatus === "partial") return { fg: colors.warningStrong, bar: colors.warning, label: c.overdue ? "Parcial · vencido" : "Parcial", icon: "contrast-outline" as const };
    if (c.overdue) return { fg: colors.expenseStrong, bar: colors.expense, label: "Vencido", icon: "alert-circle" as const };
    return { fg: colors.textSecondary, bar: colors.muted, label: "Pendiente", icon: "time-outline" as const };
  };

  if (charges.length === 0) {
    return <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center", paddingVertical: 24 }}>Este ciclo todavía no tiene cargos para los participantes.</Text>;
  }

  return (
    <View>
      {charges.map((c, i) => {
        const st = statusOf(c);
        const settled = c.paymentStatus === "paid" || c.paymentStatus === "exempt";
        const hasPending = cmpMoney(c.pending, "0.00") > 0;
        const partial = !settled && cmpMoney(c.applied, "0.00") > 0;
        return (
          <TouchableOpacity key={c.obligationId} onPress={() => onPressCharge(c)} activeOpacity={0.75} accessibilityRole="button"
            style={{ flexDirection: "row", gap: 12, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
            <View style={{ width: 4, borderRadius: 2, backgroundColor: st.bar }} />
            <View style={{ flex: 1, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{c.contactName}</Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>Vence {humanDate(c.dueDate)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name={st.icon} size={14} color={st.fg} />
                    <Text style={{ color: st.fg, fontSize: 12, fontFamily: "AsapBold" }}>{st.label}</Text>
                  </View>
                  <Text style={{ color: settled ? colors.textSecondary : colors.text, fontSize: 15, fontFamily: "AsapBold" }}>
                    {c.paymentStatus === "exempt" ? "Sin cargo" : settled ? formatSoles(c.applied) : formatSoles(c.pending)}
                  </Text>
                </View>
              </View>
              {partial && <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>Pagó {formatSoles(c.applied)} de {formatSoles(c.net)} · debe {formatSoles(c.pending)}</Text>}
              {hasPending && (
                <TouchableOpacity onPress={() => onRemindParticipant(c.contactId)} accessibilityRole="button" accessibilityLabel={`Preparar mensaje de cobro para ${c.contactName}`}
                  style={{ height: 38, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: `${colors.income}22` }}>
                  <Ionicons name="logo-whatsapp" size={17} color={colors.incomeStrong} />
                  <Text style={{ color: colors.incomeStrong, fontSize: 13, fontFamily: "AsapBold" }}>Recordar por WhatsApp</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SharedParticipantsList;
