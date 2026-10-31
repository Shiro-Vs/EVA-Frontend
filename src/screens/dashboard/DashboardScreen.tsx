import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { DashboardCard, Summary } from "../../api/types";
import BottomSheet from "../../components/common/BottomSheet";
import DailyTipCard from "../../components/common/DailyTipCard";
import { ErrorBox, SeeAll } from "../../components/v1/ui";
import type { SectionKey } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";
import { buildAttention, type AttentionItem } from "./attention";

const KIND: Record<Summary["recent"][number]["kind"], { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  income: { icon: "arrow-down-circle-outline", label: "Ingreso" },
  expense: { icon: "arrow-up-circle-outline", label: "Gasto" },
  transfer: { icon: "swap-horizontal-outline", label: "Transferencia" },
  adjustment: { icon: "construct-outline", label: "Ajuste" },
  reversal: { icon: "refresh-outline", label: "Reversión" },
};
const ACCOUNT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bank: "business", savings: "save", cash: "cash", wallet: "phone-portrait", credit: "card" };
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Inicio: lo importante en una pantalla y media. Saldo y mes, lo que hay que atender, consejo, cuentas, presupuestos y últimos movimientos. */
export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const summary = useAsync(() => api.summary(), []);
  const dash = useAsync(() => api.dashboard(), []);
  const [sheet, setSheet] = useState(false);
  const reload = React.useCallback(() => { void summary.reload(); void dash.reload(); }, [summary.reload, dash.reload]);
  useFocusReload(reload);

  const cards = dash.data?.cards ?? [];
  const card = <T,>(id: string) => cards.find((c: DashboardCard) => c.id === id)?.data as T | undefined;
  const s = summary.data;
  const attention = useMemo(() => buildAttention({ cards, recurringPending: s?.recurring?.pending ?? 0, today: todayLocalIso() }), [cards, s]);

  // Una transferencia llega como dos asientos (sale de una cuenta, entra en otra): se muestra como un solo movimiento.
  const recent = useMemo(() => {
    const out: Array<Summary["recent"][number] & { to?: string }> = [];
    for (const tx of s?.recent ?? []) {
      const twin = tx.kind === "transfer" ? out.find((o) => o.operationId === tx.operationId) : undefined;
      if (twin) { if (cmpMoney(tx.amount, "0.00") > 0) twin.to = tx.account.name; else { twin.to = twin.account.name; twin.account = tx.account; } continue; }
      out.push({ ...tx });
    }
    return out;
  }, [s]);

  if ((summary.loading && !summary.data) || (dash.loading && !dash.data)) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;
  }
  if (!s || summary.error) {
    return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background }}><ErrorBox message={summary.error ?? "No se pudo cargar el inicio."} onRetry={reload} /></SafeAreaView>;
  }

  const flow = card<{ month: string; income: string; consumption: string; net: string }>("period_flow");
  const accountsCard = card<{ accounts: Array<{ id: string; name: string; type: string; balance: string }> }>("accounts_balance");
  const creditCard = card<{ cards: Array<{ id: string; name: string; debt: string }> }>("credit_debt");
  const budgets = card<{ budgets: Array<{ id: string; name: string; percent: number | null; exceeded: boolean }> }>("budgets");
  const goals = card<{ totals: { reserved: string; free: string } }>("goals");
  const monthName = flow ? MONTHS[Number(flow.month.slice(5)) - 1] : "";
  const go = (route: string) => router.push(route as never);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, gap: 12 }}>
        {/* Cabecera */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Hola,</Text>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontFamily: "AsapBold" }}>{profile?.displayName ?? "bienvenido"} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={attention.length ? `Pendientes: ${attention.length}` : "Pendientes"}
            style={{ width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {attention.length > 0 && (
              <View style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.dangerSurface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }}>
                <Text style={{ color: "#fff", fontSize: 10, fontFamily: "AsapBold" }}>{attention.length > 9 ? "9+" : attention.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Saldo y mes en curso */}
        <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 16, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Saldo total · {s.balance.accounts} {s.balance.accounts === 1 ? "cuenta" : "cuentas"}</Text>
          <Text style={{ color: colors.onPrimary, fontSize: 30, fontFamily: "AsapBold" }}>{formatSoles(s.balance.net)}</Text>
          {flow ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <FlowPill label={`Ingresos de ${monthName}`} value={flow.income} icon="arrow-down" />
              <FlowPill label={`Gastos de ${monthName}`} value={flow.consumption} icon="arrow-up" />
            </View>
          ) : null}
        </View>

        {/* Por atender */}
        {attention.length > 0 && (
          <View style={{ gap: 6 }}>
            <SectionTitle title="Por atender" action={attention.length > 2 ? <SeeAll label={`Ver las ${attention.length}`} onPress={() => setSheet(true)} /> : undefined} />
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {attention.slice(0, 2).map((a, i) => <AttentionRow key={a.id} a={a} first={i === 0} onPress={() => go(a.route)} />)}
            </View>
          </View>
        )}

        <DailyTipCard />

        {/* Cuentas */}
        {(accountsCard || creditCard) && (
          <View style={{ gap: 6 }}>
            <SectionTitle title="Mis cuentas" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 24 }} style={{ marginHorizontal: -24 }} snapToInterval={140} decelerationRate="fast">
              <View style={{ width: 14 }} />
              {(accountsCard?.accounts ?? []).map((a) => (
                <TouchableOpacity key={a.id} onPress={() => go(`/account/${a.id}`)} accessibilityRole="button" style={{ width: 132, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.sections.money.tint }}><Ionicons name={ACCOUNT_ICON[a.type] ?? "wallet"} size={16} color={colors.sections.money.ink} /></View>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>{a.name}</Text>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{formatSoles(a.balance)}</Text>
                </TouchableOpacity>
              ))}
              {(creditCard?.cards ?? []).map((c) => (
                <TouchableOpacity key={c.id} onPress={() => go(`/account/${c.id}`)} accessibilityRole="button" style={{ width: 132, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.expense}22` }}><Ionicons name="card" size={16} color={colors.expenseStrong} /></View>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>{c.name} · deuda</Text>
                  <Text numberOfLines={1} style={{ color: cmpMoney(c.debt, "0.00") > 0 ? colors.expenseStrong : colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{formatSoles(c.debt)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Presupuestos y metas */}
        {((budgets?.budgets.length ?? 0) > 0 || goals) && (
          <View style={{ gap: 6 }}>
            <SectionTitle title="Este mes" action={<SeeAll label="Planificar" onPress={() => go("/plan")} />} />
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
              {[...(budgets?.budgets ?? [])].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 2).map((b) => <BudgetBar key={b.id} name={b.name} percent={b.percent ?? 0} exceeded={b.exceeded} onPress={() => go(`/budgets/${b.id}`)} />)}
              {goals && (
                <TouchableOpacity onPress={() => go("/goals/accounts")} accessibilityRole="button" style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: (budgets?.budgets.length ?? 0) > 0 ? 1 : 0, borderTopColor: colors.border, paddingTop: (budgets?.budgets.length ?? 0) > 0 ? 10 : 0 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Libre para gastar <Text style={{ color: colors.incomeStrong, fontFamily: "AsapBold" }}>{formatSoles(goals.totals.free)}</Text></Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>En metas <Text style={{ color: colors.text, fontFamily: "AsapBold" }}>{formatSoles(goals.totals.reserved)}</Text></Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Últimos movimientos */}
        <View style={{ gap: 6 }}>
          <SectionTitle title="Últimos movimientos" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
          {recent.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", paddingVertical: 8 }}>Aún no hay movimientos. Registra un cobro o un gasto y aparecerá aquí.</Text>
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {recent.slice(0, 3).map((tx, i) => {
                const meta = KIND[tx.kind];
                const isTransfer = tx.kind === "transfer";
                const positive = !isTransfer && cmpMoney(tx.amount, "0.00") > 0;
                return (
                  <TouchableOpacity key={tx.id} onPress={() => go(`/operation/${tx.operationId}`)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, opacity: tx.status === "reversed" ? 0.55 : 1 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: positive ? `${colors.income}22` : `${colors.text}0D` }}>
                      <Ionicons name={meta.icon} size={18} color={positive ? colors.incomeStrong : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{tx.description || meta.label}</Text>
                      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{tx.occurredOn === s.asOf ? "Hoy" : humanDate(tx.occurredOn)} · {tx.to ? `${tx.account.name} → ${tx.to}` : tx.account.name}</Text>
                    </View>
                    <Text style={{ color: positive ? colors.incomeStrong : colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{isTransfer ? "" : positive ? "+" : "-"}{formatSoles(tx.amount.replace("-", ""))}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={attention.length ? `Por atender (${attention.length})` : "Por atender"} maxHeight={0.75}>
        {attention.length === 0 ? <Text style={{ color: colors.textSecondary, fontFamily: "Asap", padding: 20, textAlign: "center" }}>Todo al día. No hay nada pendiente.</Text> : (
          <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: "hidden", marginHorizontal: 4, marginBottom: 6 }}>
            {attention.map((a, i) => <AttentionRow key={a.id} a={a} first={i === 0} onPress={() => { setSheet(false); go(a.route); }} />)}
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{title}</Text>
      {action}
    </View>
  );
}

function FlowPill({ label, value, icon }: { label: string; value: string; icon: "arrow-down" | "arrow-up" }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={11} color={colors.onPrimaryMuted} />
        <Text numberOfLines={1} style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", flexShrink: 1 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 16, fontFamily: "AsapBold" }}>{formatSoles(value)}</Text>
    </View>
  );
}

function AttentionRow({ a, first, onPress }: { a: AttentionItem; first: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const ink = a.tone === "danger" ? colors.expenseStrong : a.tone === "warn" ? colors.warningStrong : colors.primary;
  const tint = a.tone === "danger" ? `${colors.expense}22` : a.tone === "warn" ? `${colors.warning}26` : `${colors.primary}1A`;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: tint }}><Ionicons name={a.icon as never} size={18} color={ink} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{a.title}</Text>
        {a.text ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{a.text}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

function BudgetBar({ name, percent, exceeded, onPress }: { name: string; percent: number; exceeded: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const tone = exceeded ? colors.expenseStrong : percent >= 85 ? colors.warningStrong : colors.incomeStrong;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapMedium", flex: 1 }}>{name}</Text>
        <Text style={{ color: tone, fontSize: 13, fontFamily: "AsapBold" }}>{Math.round(percent)}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
        <View style={{ height: "100%", width: `${Math.max(2, Math.min(100, percent))}%`, backgroundColor: tone }} />
      </View>
    </TouchableOpacity>
  );
}
