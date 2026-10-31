import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CycleDetail, Subscription } from "../../../../api/types";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { humanDate } from "../../../../utils/dates";
import { cycleLabel } from "../../../../utils/intervals";
import { cmpMoney, formatSoles, pctOf } from "../../../../utils/money";

interface ServiceSummaryCardProps {
  cycle: CycleDetail;
  service: Subscription;
  onPayService: () => void;
  onEditPayment: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium" }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 17, fontFamily: "AsapBold" }}>{value}</Text>
      {hint ? <Text style={{ color: colors.onPrimaryMuted, fontSize: 10, fontFamily: "Asap" }}>{hint}</Text> : null}
    </View>
  );
}

/** Resumen del ciclo seleccionado, en el color de marca (el mismo de las demás tarjetas destacadas). Los importes los calcula el servidor. */
export const ServiceSummaryCard: React.FC<ServiceSummaryCardProps> = ({ cycle, service, onPayService, onEditPayment }) => {
  const { colors } = useAppTheme();
  const cost = cycle.costSummary;
  const paid = cycle.supplierPayment;
  const total = cost.actualPaid ?? cost.announcedPrice;
  const shared = service.mode === "shared";
  const hasSurplus = cmpMoney(cost.surplus, "0.00") > 0;
  const pct = Math.max(0, Math.min(100, pctOf(cost.receivedFromOthers, total)));

  return (
    <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 18, overflow: "hidden", gap: 14 }}>
      <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Resumen del ciclo</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Ionicons name="repeat" size={12} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary, fontSize: 11, fontFamily: "AsapBold" }}>{cycleLabel(service.terms?.interval).replace("Ciclo ", "")}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={paid ? "checkmark-circle" : "time-outline"} size={14} color={colors.onPrimaryMuted} />
        <Text style={{ flex: 1, color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "AsapMedium" }}>
          {paid ? `Pagado con ${paid.account?.name ?? "—"} el ${humanDate(paid.paidOn)}` : "Aún no registraste el pago al proveedor"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat label={paid ? (shared ? "Pagaste" : "Pagaste") : "Precio"} value={formatSoles(total)} />
        {shared && <Stat label="Te devolvieron" value={formatSoles(cost.receivedFromOthers)} />}
        <Stat label={!shared ? "Tu gasto" : hasSurplus ? "A tu favor" : "Tu gasto real"} value={formatSoles(!shared ? total : hasSurplus ? cost.surplus : cost.costByCollections)} />
      </View>

      {shared && (
        <View style={{ gap: 6 }}>
          <View style={{ backgroundColor: "rgba(255,255,255,0.22)", height: 6, borderRadius: 3, overflow: "hidden" }}>
            <View style={{ backgroundColor: colors.onPrimary, height: "100%", width: `${pct}%` }} />
          </View>
          {!cost.estimated && <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "Asap" }}>Previsto {formatSoles(cost.projectedCost)} · Por cobrar {formatSoles(cost.pendingFromOthers)}</Text>}
        </View>
      )}

      <TouchableOpacity onPress={paid ? onEditPayment : onPayService} accessibilityRole="button" activeOpacity={0.85}
        style={{ height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: paid ? "rgba(255,255,255,0.18)" : colors.accent }}>
        <Ionicons name={paid ? "create-outline" : "cash-outline"} size={18} color={paid ? colors.onPrimary : colors.onAccent} />
        <Text style={{ fontFamily: "AsapBold", fontSize: 14, color: paid ? colors.onPrimary : colors.onAccent }}>{paid ? "Corregir el pago" : "Registrar pago al proveedor"}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ServiceSummaryCard;
