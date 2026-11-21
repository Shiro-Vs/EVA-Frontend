import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { DashboardCard, Summary } from "../../api/types";
import BottomSheet from "../../components/common/BottomSheet";
import DailyTipCard from "../../components/common/DailyTipCard";
import { Button, ErrorBox, SeeAll } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";
import { buildAttention, type AttentionItem } from "./attention";

type IconName = keyof typeof Ionicons.glyphMap;

const HIDE_KEY = "eva_hide_balances";
const MASK = "S/ ••••";

const KIND: Record<Summary["recent"][number]["kind"], { icon: IconName; label: string }> = {
  income: { icon: "arrow-down-circle-outline", label: "Ingreso" },
  expense: { icon: "arrow-up-circle-outline", label: "Gasto" },
  transfer: { icon: "swap-horizontal-outline", label: "Transferencia" },
  adjustment: { icon: "construct-outline", label: "Ajuste" },
  reversal: { icon: "refresh-outline", label: "Reversión" },
};
const ACCOUNT_ICON: Record<string, IconName> = {
  bank: "business-outline",
  savings: "wallet-outline",
  cash: "cash-outline",
  wallet: "phone-portrait-outline",
  credit: "card-outline",
};
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Inicio: saldo con modo discreto, acciones rápidas, pendientes, consejo IA, tarjetas configurables y últimos movimientos. */
export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const currentMonth = todayLocalIso().slice(0, 7);

  const summary = useAsync(() => api.summary(), []);
  const dash = useAsync(() => api.dashboard(), []);
  const monthlyFallback = useAsync(() => api.monthly({ month: currentMonth }).catch(() => null), [currentMonth]);

  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tipRefreshKey, setTipRefreshKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => { if (v === "1") setHidden(true); }).catch(() => {});
  }, []);

  const toggleHidden = () => {
    setHidden((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(HIDE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  };

  const reload = useCallback(() => {
    void summary.reload();
    void dash.reload();
    void monthlyFallback.reload();
  }, [summary.reload, dash.reload, monthlyFallback.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTipRefreshKey((k) => k + 1);
    try {
      await Promise.all([summary.reload(), dash.reload(), monthlyFallback.reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [summary.reload, dash.reload, monthlyFallback.reload]);

  const cards = dash.data?.cards ?? [];
  const card = <T,>(id: string) => cards.find((c: DashboardCard) => c.id === id)?.data as T | undefined;
  const s = summary.data;
  const attention = useMemo(() => buildAttention({ cards, recurringPending: s?.recurring?.pending ?? 0, today: todayLocalIso() }), [cards, s]);

  // Una transferencia llega como dos asientos (sale de una cuenta, entra en otra): se muestra como un solo movimiento.
  const recent = useMemo(() => {
    const out: Array<Summary["recent"][number] & { to?: string }> = [];
    for (const tx of s?.recent ?? []) {
      const twin = tx.kind === "transfer" ? out.find((o) => o.operationId === tx.operationId) : undefined;
      if (twin) {
        if (cmpMoney(tx.amount, "0.00") > 0) twin.to = tx.account.name;
        else { twin.to = twin.account.name; twin.account = tx.account; }
        continue;
      }
      out.push({ ...tx });
    }
    return out;
  }, [s]);

  if ((summary.loading && !summary.data) || (dash.loading && !dash.data)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (!s || summary.error) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background }}>
        <ErrorBox message={summary.error ?? "No se pudo cargar el inicio."} onRetry={reload} />
      </SafeAreaView>
    );
  }

  // Usa period_flow si el usuario activó esa tarjeta, o el resumen del mes actual para que siempre se vean ingresos y gastos del mes.
  const cardFlow = card<{ month: string; income: string; consumption: string; net: string }>("period_flow");
  const flow = cardFlow ?? (monthlyFallback.data ? {
    month: monthlyFallback.data.period.month,
    income: monthlyFallback.data.results.income.total,
    consumption: monthlyFallback.data.results.consumption.total,
    net: monthlyFallback.data.results.net,
  } : null);
  const monthName = flow ? MONTHS[Number(flow.month.slice(5)) - 1] : MONTHS[Number(currentMonth.slice(5)) - 1];

  const money = (v: string) => (hidden ? MASK : formatSoles(v));
  const go = (route: string) => router.push(route as never);
  const displayName = profile?.displayName ?? "bienvenido";
  const initial = (profile?.displayName?.trim().charAt(0) || "E").toUpperCase();

  const renderCard = (c: DashboardCard) => {
    if (c.id === "accounts_balance") {
      const data = c.data as { accounts: Array<{ id: string; name: string; type: string; balance: string }> };
      if (!data?.accounts?.length) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Mis cuentas" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 24 }} style={{ marginHorizontal: -24 }} snapToInterval={160} decelerationRate="fast">
            {data.accounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => go(`/account/${a.id}`)}
                activeOpacity={0.78}
                accessibilityRole="button"
                style={{ width: 150, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 13, gap: 6 }}
              >
                <Ionicons name={ACCOUNT_ICON[a.type] ?? "wallet-outline"} size={21} color={colors.sections.money.ink} />
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>{a.name}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 17, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(a.balance)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (c.id === "credit_debt") {
      const data = c.data as { cards: Array<{ id: string; name: string; debt: string }> };
      if (!data?.cards?.length) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Tarjetas de crédito" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 24 }} style={{ marginHorizontal: -24 }} snapToInterval={160} decelerationRate="fast">
            {data.cards.map((cr) => (
              <TouchableOpacity
                key={cr.id}
                onPress={() => go(`/account/${cr.id}`)}
                activeOpacity={0.78}
                accessibilityRole="button"
                style={{ width: 150, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 13, gap: 6 }}
              >
                <Ionicons name="card-outline" size={21} color={colors.expenseStrong} />
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>{cr.name} · deuda</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: cmpMoney(cr.debt, "0.00") > 0 ? colors.expenseStrong : colors.text, fontSize: 17, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(cr.debt)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (c.id === "budgets") {
      const data = c.data as { budgets: Array<{ id: string; name: string; percent: number | null; level?: number | null; exceeded: boolean }> };
      if (!data?.budgets?.length) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Presupuestos" action={<SeeAll label="Ver todos" onPress={() => go("/budgets")} />} />
          <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
            {[...data.budgets].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 3).map((b) => (
              <BudgetBar key={b.id} name={b.name} percent={b.percent ?? 0} level={b.level ?? null} exceeded={b.exceeded} onPress={() => go(`/budgets/${b.id}`)} />
            ))}
          </View>
        </View>
      );
    }
    if (c.id === "goals") {
      const data = c.data as { totals: { reserved: string; free: string } };
      if (!data?.totals) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Metas y reservas" action={<SeeAll label="Planificar" onPress={() => go("/plan")} />} />
          <TouchableOpacity
            onPress={() => go("/goals/accounts")}
            activeOpacity={0.78}
            accessibilityRole="button"
            style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>
              Libre para gastar <Text style={{ color: colors.incomeStrong, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(data.totals.free)}</Text>
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>
              En metas <Text style={{ color: colors.text, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(data.totals.reserved)}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (c.id === "loans") {
      const data = c.data as {
        ledger?: { lentPending: string; borrowedPending: string };
        bankLoans?: { nextInstallments: Array<{ loanId: string; name: string; number: number; dueDate: string; remaining: string }> };
      };
      const lent = data?.ledger?.lentPending ?? "0.00";
      const borrowed = data?.ledger?.borrowedPending ?? "0.00";
      const bankNext = data?.bankLoans?.nextInstallments ?? [];
      if (cmpMoney(lent, "0.00") === 0 && cmpMoney(borrowed, "0.00") === 0 && bankNext.length === 0) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Préstamos" action={<SeeAll label="Ver todos" onPress={() => go("/loans")} />} />
          <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
              <TouchableOpacity onPress={() => go("/loans")} accessibilityRole="button">
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>
                  Te deben <Text style={{ color: colors.incomeStrong, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(lent)}</Text>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => go("/loans")} accessibilityRole="button">
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>
                  Debes <Text style={{ color: cmpMoney(borrowed, "0.00") > 0 ? colors.expenseStrong : colors.text, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{money(borrowed)}</Text>
                </Text>
              </TouchableOpacity>
            </View>
            {bankNext.slice(0, 2).map((b) => (
              <TouchableOpacity
                key={`${b.loanId}-${b.number}`}
                onPress={() => go(`/bank-loan/${b.loanId}`)}
                accessibilityRole="button"
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}
              >
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{b.name} · cuota {b.number}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{humanDate(b.dueDate)} · {money(b.remaining)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Cabecera: avatar, saludo, ocultar saldos y campanita de pendientes */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          <TouchableOpacity onPress={() => go("/settings/profile")} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Abrir mi perfil">
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.elevated, borderWidth: 1.5, borderColor: `${colors.primary}30` }}
              />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
                <Text style={{ color: colors.onPrimary, fontSize: 17, fontFamily: "AsapBold" }}>{initial}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "Asap" }}>Hola,</Text>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 21, fontFamily: "AsapBold" }}>{displayName}</Text>
          </View>
          <TouchableOpacity
            onPress={toggleHidden}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar saldos" : "Ocultar saldos"}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={hidden ? colors.primary : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={attention.length ? `Pendientes: ${attention.length}` : "Pendientes"}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {attention.length > 0 && (
              <View style={{ position: "absolute", top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.dangerSurface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }}>
                <Text style={{ color: colors.onPrimary, fontSize: 10.5, fontFamily: "AsapBold" }}>{attention.length > 9 ? "9+" : attention.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Saldo total y flujo del mes en curso */}
        <View style={{ backgroundColor: colors.primarySurface, borderRadius: 26, padding: 18, overflow: "hidden", gap: 4 }}>
          <View style={{ position: "absolute", top: -44, right: -32, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.10)" }} />
          <View style={{ position: "absolute", bottom: -60, left: -24, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(0,0,0,0.08)" }} />
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 11.5, fontFamily: "AsapSemiBold", letterSpacing: 1.1, textTransform: "uppercase" }}>
            Saldo total · {s.balance.accounts} {s.balance.accounts === 1 ? "cuenta" : "cuentas"}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 32, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], marginTop: 2 }}>
            {money(s.balance.net)}
          </Text>
          {flow ? (
            <TouchableOpacity onPress={() => go("/reports")} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Ver resumen mensual" style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <FlowPill label={`Ingresos · ${monthName}`} value={money(flow.income)} icon="arrow-down" />
              <FlowPill label={`Gastos · ${monthName}`} value={money(flow.consumption)} icon="arrow-up" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Por atender */}
        {attention.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionTitle title="Por atender" action={attention.length > 2 ? <SeeAll label={`Ver las ${attention.length}`} onPress={() => setSheet(true)} /> : undefined} />
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {attention.slice(0, 2).map((a, i) => <AttentionRow key={a.id} a={a} first={i === 0} onPress={() => go(a.route)} />)}
            </View>
          </View>
        )}

        <DailyTipCard refreshKey={tipRefreshKey} />

        {/* Tarjetas configurables en el orden elegido en Ajustes → Panel */}
        {cards.map(renderCard)}

        {/* Últimos movimientos (hasta 5) */}
        <View style={{ gap: 8 }}>
          <SectionTitle title="Últimos movimientos" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
          {recent.length === 0 ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: "center", gap: 10 }}>
              <Ionicons name="receipt-outline" size={26} color={colors.muted} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>
                Aún no hay movimientos. Registra tu primer gasto o ingreso y aparecerá aquí.
              </Text>
              <Button title="Registrar movimiento" icon="add" size="compact" variant="secondary" onPress={() => go("/operation/new")} />
            </View>
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {recent.slice(0, 5).map((tx, i) => {
                const meta = KIND[tx.kind];
                const isTransfer = tx.kind === "transfer";
                const positive = !isTransfer && cmpMoney(tx.amount, "0.00") > 0;
                const isExpense = !isTransfer && cmpMoney(tx.amount, "0.00") < 0;
                const iconColor = isTransfer ? colors.primary : positive ? colors.incomeStrong : isExpense ? colors.expenseStrong : colors.textSecondary;
                const amountColor = isTransfer ? colors.primary : positive ? colors.incomeStrong : isExpense ? colors.expenseStrong : colors.text;
                const absAmt = tx.amount.replace("-", "");
                return (
                  <TouchableOpacity
                    key={tx.id}
                    onPress={() => go(`/operation/${tx.operationId}`)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 11,
                      paddingHorizontal: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                      opacity: tx.status === "reversed" ? 0.55 : 1,
                    }}
                  >
                    <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon} size={21} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{tx.description || meta.label}</Text>
                      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>
                        {tx.occurredOn === s.asOf ? "Hoy" : humanDate(tx.occurredOn)} · {tx.to ? `${tx.account.name} → ${tx.to}` : tx.account.name}
                      </Text>
                    </View>
                    <Text style={{ color: amountColor, fontSize: 14, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                      {hidden ? MASK : `${isTransfer ? "" : positive ? "+" : "-"}${formatSoles(absAmt)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Acceso discreto a personalización de tarjetas */}
        <TouchableOpacity
          onPress={() => go("/settings/dashboard")}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 }}
        >
          <Ionicons name="options-outline" size={15} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapSemiBold" }}>Personalizar tarjetas de Inicio</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={attention.length ? `Por atender (${attention.length})` : "Por atender"} maxHeight={0.75}>
        {attention.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontFamily: "Asap", padding: 20, textAlign: "center" }}>Todo al día. No hay nada pendiente.</Text>
        ) : (
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
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={11} color={colors.onPrimaryMuted} />
        <Text numberOfLines={1} style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", flexShrink: 1 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 16, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function AttentionRow({ a, first, onPress }: { a: AttentionItem; first: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const ink = a.tone === "danger" ? colors.expenseStrong : a.tone === "warn" ? colors.warningStrong : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}
    >
      <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={a.icon as never} size={20} color={ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{a.title}</Text>
        {a.text ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{a.text}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

function BudgetBar({ name, percent, level, exceeded, onPress }: { name: string; percent: number; level: number | null; exceeded: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const tone = exceeded ? colors.expenseStrong : level !== null ? colors.warningStrong : colors.incomeStrong;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} style={{ gap: 5, paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapMedium", flex: 1 }}>{name}</Text>
        <Text style={{ color: tone, fontSize: 13, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{Math.round(percent)}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
        <View style={{ height: "100%", width: `${Math.max(2, Math.min(100, percent))}%`, backgroundColor: tone }} />
      </View>
    </TouchableOpacity>
  );
}
