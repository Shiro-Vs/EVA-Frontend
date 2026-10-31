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

/** Estado de pago de cada participante en el ciclo seleccionado: una lista con su estado, lo que debe y el aviso por WhatsApp. */
export const SharedParticipantsList: React.FC<SharedParticipantsListProps> = ({ charges, onPressCharge, onRemindParticipant }) => {
  const { colors } = useAppTheme();

  const statusOf = (c: Charge) => {
    if (c.paymentStatus === "exempt") return { fg: colors.primary, bg: `${colors.primary}1A`, label: "Cortesía", icon: "gift-outline" as const };
    if (c.paymentStatus === "paid") return { fg: colors.incomeStrong, bg: `${colors.income}22`, label: "Pagado", icon: "checkmark" as const };
    if (c.paymentStatus === "partial") return { fg: colors.warningStrong, bg: `${colors.warning}26`, label: c.overdue ? "Parcial · vencido" : "Parcial", icon: "ellipse-outline" as const };
    if (c.overdue) return { fg: colors.expenseStrong, bg: `${colors.expense}22`, label: "Vencido", icon: "alert-circle-outline" as const };
    return { fg: colors.textSecondary, bg: `${colors.text}10`, label: "Pendiente", icon: "time-outline" as const };
  };

  if (charges.length === 0) {
    return <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center", paddingVertical: 24 }}>Este ciclo todavía no tiene cargos para los participantes.</Text>;
  }

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
      {charges.map((c, i) => {
        const st = statusOf(c);
        const settled = c.paymentStatus === "paid" || c.paymentStatus === "exempt";
        const hasPending = cmpMoney(c.pending, "0.00") > 0;
        return (
          <TouchableOpacity key={c.obligationId} onPress={() => onPressCharge(c)} activeOpacity={0.7} accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, opacity: c.paymentStatus === "exempt" ? 0.85 : 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}1A` }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "AsapBold" }}>{c.contactName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{c.contactName}</Text>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                {settled ? (c.paymentStatus === "exempt" ? "Sin cargo este ciclo" : `Pagó ${formatSoles(c.applied)}`) : `Debe ${formatSoles(c.pending)}`} · vence {humanDate(c.dueDate)}
              </Text>
              {!settled && cmpMoney(c.applied, "0.00") > 0 && <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>Pagó {formatSoles(c.applied)} de {formatSoles(c.net)}</Text>}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
              <Ionicons name={st.icon} size={12} color={st.fg} />
              <Text style={{ color: st.fg, fontSize: 11, fontFamily: "AsapBold" }}>{st.label}</Text>
            </View>
            {hasPending && (
              <TouchableOpacity onPress={() => onRemindParticipant(c.contactId)} accessibilityRole="button" accessibilityLabel={`Preparar mensaje de cobro para ${c.contactName}`} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.income}22`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.incomeStrong} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SharedParticipantsList;
