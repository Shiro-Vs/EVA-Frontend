import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Charge, CycleDetail } from "../../../../api/types";
import { Loading } from "../../../../components/v1/ui";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { humanDate } from "../../../../utils/dates";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ServicePaymentsProps {
  cycles: CycleDetail[] | null;
  loading: boolean;
  shared: boolean;
}

/** Historial de pagos del servicio, ciclo por ciclo; al tocar uno se despliega su resumen sin salir de la pestaña. Los importes los calcula el servidor. */
export const ServicePayments: React.FC<ServicePaymentsProps> = ({ cycles, loading, shared }) => {
  const { colors } = useAppTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!cycles) return loading ? <Loading /> : null;
  if (cycles.length === 0) return <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center", paddingVertical: 24 }}>Todavía no hay ciclos para mostrar.</Text>;

  const personStatus = (c: Charge) => {
    if (c.paymentStatus === "exempt") return { text: "Cortesía", color: colors.primary };
    if (c.paymentStatus === "paid") return { text: `Pagó ${formatSoles(c.applied)}`, color: colors.incomeStrong };
    if (cmpMoney(c.applied, "0.00") > 0) return { text: `Pagó ${formatSoles(c.applied)} · debe ${formatSoles(c.pending)}`, color: colors.warningStrong };
    return { text: `Debe ${formatSoles(c.pending)}`, color: c.overdue ? colors.expenseStrong : colors.textSecondary };
  };

  const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontFamily: strong ? "AsapBold" : "AsapMedium" }}>{value}</Text>
    </View>
  );

  return (
    <View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", marginBottom: 4 }}>
        {shared ? "Tu gasto real es lo que pagaste al proveedor menos lo que te devolvieron." : "Lo que pagaste al proveedor en cada ciclo."}
      </Text>
      {cycles.map((c, i) => {
        const cost = c.costSummary;
        const paid = c.supplierPayment;
        const open = openId === c.id;
        const missing = shared && paid && cmpMoney(cost.pendingFromOthers, "0.00") > 0;
        return (
          <View key={c.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
            <TouchableOpacity onPress={() => setOpenId(open ? null : c.id)} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ expanded: open }}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: paid ? colors.income : colors.warning }} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{humanDate(c.startDate)} → {humanDate(c.endDate)}</Text>
                  <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{paid ? formatSoles(cost.costByCollections) : "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ flex: 1, color: paid ? colors.textSecondary : colors.warningStrong, fontSize: 12, fontFamily: paid ? "Asap" : "AsapBold" }}>
                    {paid ? `Pagaste ${formatSoles(cost.actualPaid ?? paid.amount)}${shared ? ` · te devolvieron ${formatSoles(cost.receivedFromOthers)}` : ""}` : "Sin pagar al proveedor"}
                  </Text>
                  {paid && <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapMedium" }}>tu gasto</Text>}
                </View>
                {missing && <Text style={{ color: colors.expenseStrong, fontSize: 12, fontFamily: "AsapBold" }}>Faltan por devolverte {formatSoles(cost.pendingFromOthers)}</Text>}
              </View>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} style={{ alignSelf: "center" }} />
            </TouchableOpacity>

            {open && (
              <View style={{ marginLeft: 16, paddingBottom: 14, gap: 6 }}>
                <Line label="Precio del ciclo" value={formatSoles(cost.announcedPrice)} />
                {paid ? (
                  <>
                    <Line label={`Pagaste${paid.account ? ` con ${paid.account.name}` : ""}`} value={`${formatSoles(cost.actualPaid ?? paid.amount)} · ${humanDate(paid.paidOn)}`} />
                    {shared && <Line label="Te devolvieron" value={formatSoles(cost.receivedFromOthers)} />}
                    <Line label={shared ? "Tu gasto real" : "Tu gasto"} value={formatSoles(cost.costByCollections)} strong />
                  </>
                ) : (
                  <Text style={{ color: colors.warningStrong, fontSize: 13, fontFamily: "AsapMedium" }}>Aún no registraste el pago de este ciclo al proveedor.</Text>
                )}
                {shared && c.charges.length > 0 && (
                  <View style={{ marginTop: 6, gap: 4 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapMedium", textTransform: "uppercase", letterSpacing: 0.8 }}>Quién pagó</Text>
                    {c.charges.map((ch) => {
                      const st = personStatus(ch);
                      return (
                        <View key={ch.obligationId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{ch.contactName}</Text>
                          <Text style={{ color: st.color, fontSize: 13, fontFamily: "AsapMedium" }}>{st.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default ServicePayments;
