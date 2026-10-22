import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { CycleDetail, Subscription } from "../../../../api/types";
import { humanDate } from "../../../../utils/dates";
import { cycleLabel } from "../../../../utils/intervals";
import { cmpMoney, formatSoles, pctOf } from "../../../../utils/money";

interface ServiceSummaryCardProps {
  cycle: CycleDetail;
  service: Subscription;
  onPayService: () => void;
  onEditPayment: () => void;
}

/** Tarjeta azul "Resumen de Pago" del ciclo seleccionado. Todos los importes los calcula el servidor. */
export const ServiceSummaryCard: React.FC<ServiceSummaryCardProps> = ({ cycle, service, onPayService, onEditPayment }) => {
  const { colors, fonts } = useAppTheme();
  const cost = cycle.costSummary;
  const paid = cycle.supplierPayment;
  const total = cost.actualPaid ?? cost.announcedPrice;
  const shared = service.mode === "shared";
  const hasSurplus = cmpMoney(cost.surplus, "0.00") > 0;
  const small = { color: "rgba(255,255,255,0.7)", fontFamily: fonts.family.regular, fontSize: 9, textTransform: "uppercase" as const };

  return (
    <View style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: fonts.family.semiBold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Resumen de Pago
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <Text style={{ color: "white", fontFamily: fonts.family.bold, fontSize: 24, marginRight: 12 }}>
            {humanDate(cycle.startDate)} → {humanDate(cycle.endDate)}
          </Text>
          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Ionicons name="repeat" size={12} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: "white", fontFamily: fonts.family.semiBold, fontSize: 11 }}>{cycleLabel(service.terms?.interval)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Ionicons name="card-outline" size={12} color="rgba(255,255,255,0.9)" />
        <Text style={{ color: "rgba(255,255,255,0.9)", fontFamily: fonts.family.semiBold, fontSize: 10, marginLeft: 4 }}>
          {paid ? `Pagado con: ${paid.account?.name ?? "—"} el ${humanDate(paid.paidOn)}` : "Sin pago registrado"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <View>
              <Text style={small}>{paid ? "Costo Total" : "Precio anunciado"}</Text>
              <Text style={{ color: "white", fontFamily: fonts.family.bold, fontSize: 14 }}>{formatSoles(total)}</Text>
            </View>
            {shared && (
              <View>
                <Text style={small}>Recaudado</Text>
                <Text style={{ color: "white", fontFamily: fonts.family.bold, fontSize: 14 }}>{formatSoles(cost.receivedFromOthers)}</Text>
              </View>
            )}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={small}>{!shared ? "Total" : hasSurplus ? "Saldo" : "Tu Gasto"}</Text>
              <Text style={{ color: "white", fontFamily: fonts.family.bold, fontSize: 14 }}>
                {formatSoles(!shared ? total : hasSurplus ? cost.surplus : cost.costByCollections)}
              </Text>
            </View>
          </View>
          {shared && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.3)", height: 6, borderRadius: 3, overflow: "hidden" }}>
              <View style={{ backgroundColor: "white", height: "100%", width: `${pctOf(cost.receivedFromOthers, total)}%` }} />
            </View>
          )}
          {shared && !cost.estimated && (
            <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: fonts.family.regular, fontSize: 10, marginTop: 6 }}>
              Previsto {formatSoles(cost.projectedCost)} · Pendiente de cobrar {formatSoles(cost.pendingFromOthers)}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={paid ? onEditPayment : onPayService} style={{ backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 }} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.family.bold, fontSize: 12, color: paid ? colors.incomeStrong : colors.expenseStrong }}>{paid ? "EDITAR" : "PAGAR"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ServiceSummaryCard;
