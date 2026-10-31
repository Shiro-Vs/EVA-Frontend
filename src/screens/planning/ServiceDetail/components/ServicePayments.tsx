import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CycleDetail } from "../../../../api/types";
import { Loading } from "../../../../components/v1/ui";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { humanDate } from "../../../../utils/dates";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ServicePaymentsProps {
  cycles: CycleDetail[] | null;
  loading: boolean;
  shared: boolean;
  onOpenCycle: (cycleId: string) => void;
}

/** Historial de pagos del servicio, ciclo por ciclo: lo que pagaste, lo que te devolvieron y tu gasto real. Los importes los calcula el servidor. */
export const ServicePayments: React.FC<ServicePaymentsProps> = ({ cycles, loading, shared, onOpenCycle }) => {
  const { colors } = useAppTheme();
  if (!cycles) return loading ? <Loading /> : null;
  if (cycles.length === 0) return <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center", paddingVertical: 24 }}>Todavía no hay ciclos para mostrar.</Text>;

  return (
    <View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", marginBottom: 4 }}>
        {shared ? "Tu gasto real es lo que pagaste al proveedor menos lo que te devolvieron." : "Lo que pagaste al proveedor en cada ciclo."}
      </Text>
      {cycles.map((c, i) => {
        const cost = c.costSummary;
        const paid = c.supplierPayment;
        const back = cmpMoney(cost.receivedFromOthers, "0.00") > 0;
        return (
          <TouchableOpacity key={c.id} onPress={() => onOpenCycle(c.id)} activeOpacity={0.75} accessibilityRole="button"
            style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
            <View style={{ width: 4, borderRadius: 2, backgroundColor: paid ? colors.income : colors.warning }} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{humanDate(c.startDate)} → {humanDate(c.endDate)}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{paid ? formatSoles(cost.costByCollections) : "—"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ flex: 1, color: paid ? colors.textSecondary : colors.warningStrong, fontSize: 12, fontFamily: paid ? "Asap" : "AsapBold" }}>
                  {paid
                    ? `Pagaste ${formatSoles(cost.actualPaid ?? paid.amount)}${shared ? ` · te devolvieron ${formatSoles(cost.receivedFromOthers)}` : ""}`
                    : "Sin pagar al proveedor"}
                </Text>
                {paid && <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapMedium" }}>{shared && back ? "tu gasto" : "gasto"}</Text>}
              </View>
              {shared && paid && cmpMoney(cost.pendingFromOthers, "0.00") > 0 && (
                <Text style={{ color: colors.expenseStrong, fontSize: 12, fontFamily: "AsapBold" }}>Faltan por devolverte {formatSoles(cost.pendingFromOthers)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ alignSelf: "center" }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default ServicePayments;
