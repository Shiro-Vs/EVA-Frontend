import { useState, useEffect, useCallback } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { api, errorMessage } from "../../api/client";
import type { Statement } from "../../api/types";
import { Contact } from "../../interfaces/Contact";
import { useFocusReload } from "../../hooks/useFocusReload";
import { cmpMoney } from "../../utils/money";
import { humanRange } from "../../utils/dates";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface HistoryPayment { mes_anio: string; cuota: string; free: boolean; status: "paid" | "pending" | "partial" | "converted" }
export interface HistoryService {
  serviceId: string; serviceName: string; color: string; icon: string; debt: string; overdueCount: number; history: HistoryPayment[];
}
export interface HistorySummary { totalDebt: string; services: HistoryService[] }

const ZERO = "0.00";

/** Reorganiza el estado de cuenta de la API en la forma que dibuja la pantalla; los importes se muestran tal cual llegan. */
function toSummary(st: Statement, style: Map<string, { color: string; icon: string }>): HistorySummary {
  return {
    totalDebt: st.totals.pending,
    services: st.services.map((s) => ({
      serviceId: s.subscriptionId,
      serviceName: s.name,
      color: style.get(s.subscriptionId)?.color ?? "#3B82F6",
      icon: style.get(s.subscriptionId)?.icon ?? "receipt",
      debt: serverSum(s.seats.map((x) => x.pending)),
      overdueCount: s.charges.filter((c) => c.overdue && cmpMoney(c.pending, ZERO) > 0).length,
      history: s.charges.map((c) => ({
        mes_anio: humanRange(c.cycle.start, c.cycle.end),
        cuota: c.net,
        free: cmpMoney(c.net, ZERO) === 0,
        status: c.paymentStatus === "converted" ? "converted" : cmpMoney(c.pending, ZERO) === 0 ? "paid" : cmpMoney(c.applied, ZERO) > 0 ? "partial" : "pending",
      })),
    })),
  };
}

/** Suma de importes ya calculados por el servidor (por plaza), en céntimos enteros para no perder precisión. */
function serverSum(values: string[]): string {
  const cents = values.reduce((acc, v) => acc + BigInt(v.replace(".", "")), 0n);
  const s = cents.toString().padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

export const useContactHistory = (contact: Contact, refreshTrigger?: number) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const loadSummary = useCallback(async () => {
    try {
      const [st, subs] = await Promise.all([api.contactStatement(contact.id), api.subscriptions()]);
      const style = new Map(subs.map((s) => [s.id, { color: s.color ?? "#3B82F6", icon: s.icon ?? "receipt" }]));
      setSummary(toSummary(st, style));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => { void loadSummary(); }, [loadSummary, refreshTrigger]);
  useFocusReload(loadSummary);

  const toggleService = (serviceId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedServices((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));
  };

  return { loading, error, summary, expandedServices, toggleService, loadSummary };
};
