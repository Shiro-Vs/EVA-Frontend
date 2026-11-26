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
import { EditorialHeaderCard } from "../../components/v1/EditorialHeaderCard";
import { Button, ErrorBox, SeeAll } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";
import { buildAttention, type AttentionItem } from "./attention";
import MonthlyChartCard from "./MonthlyChartCard";
import { attentionSignature, buildUpcoming, countUnreadAttention, type UpcomingCardItem } from "./upcoming";

type IconName = keyof typeof Ionicons.glyphMap;

const HIDE_KEY = "eva_hide_balances";
const SEEN_NOTIF_KEY = "eva_seen_attention_sigs";
const MASK = "S/ ••••";
const LEGACY_REV_RE = /^Reversión de [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND: Record<Summary["recent"][number]["kind"], { icon: IconName; label: string }> = {
  income: { icon: "arrow-down-circle-outline", label: "Ingreso" },
  expense: { icon: "arrow-up-circle-outline", label: "Gasto" },
  transfer: { icon: "swap-horizontal-outline", label: "Transferencia" },
  adjustment: { icon: "construct-outline", label: "Ajuste" },
  reversal: { icon: "refresh-outline", label: "Reversión" },
};
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

async function loadSeenSigs(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_NOTIF_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

/** Inicio: visión ejecutiva general (saldo, consejo IA, próximos vencimientos en carrusel, gráfico del mes, resumen rápido y últimos movimientos). */
export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const today = todayLocalIso();
  const currentMonth = today.slice(0, 7);

  const summary = useAsync(() => api.summary(), []);
  const dash = useAsync(() => api.dashboard(), []);
  const monthly = useAsync(() => api.monthly({ month: currentMonth }).catch(() => null), [currentMonth]);
  const goalsOv = useAsync(() => api.goalsOverview().catch(() => null), []);

  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tipRefreshKey, setTipRefreshKey] = useState(0);
  const [seenSigs, setSeenSigs] = useState<Set<string>>(new Set());
  const [newWhenOpened, setNewWhenOpened] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => { if (v === "1") setHidden(true); }).catch(() => {});
    loadSeenSigs().then(setSeenSigs).catch(() => {});
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
    void monthly.reload();
    void goalsOv.reload();
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === "1")).catch(() => {});
    loadSeenSigs().then(setSeenSigs).catch(() => {});
  }, [summary.reload, dash.reload, monthly.reload, goalsOv.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTipRefreshKey((k) => k + 1);
    try {
      await Promise.all([summary.reload(), dash.reload(), monthly.reload(), goalsOv.reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [summary.reload, dash.reload, monthly.reload, goalsOv.reload]);

  const cards = dash.data?.cards ?? [];
  const card = <T,>(id: string) => cards.find((c: DashboardCard) => c.id === id)?.data as T | undefined;
  const s = summary.data;

  const attention = useMemo(
    () => buildAttention({ cards, recurringPending: s?.recurring?.pending ?? 0, today }),
    [cards, s, today],
  );
  const unreadCount = useMemo(() => countUnreadAttention(attention, seenSigs), [attention, seenSigs]);
  const upcoming = useMemo(() => buildUpcoming(cards, today, 14), [cards, today]);

  const openNotifications = () => {
    // Recuerda cuáles eran nuevas al abrir para destacarlas en el menú, y limpia de inmediato el punto rojo.
    const fresh = new Set<string>();
    for (const a of attention) {
      const sig = attentionSignature(a);
      if (!seenSigs.has(sig)) fresh.add(a.id);
    }
    setNewWhenOpened(fresh);
    if (attention.length > 0) {
      const nextSeen = new Set(attention.map(attentionSignature));
      setSeenSigs(nextSeen);
      void AsyncStorage.setItem(SEEN_NOTIF_KEY, JSON.stringify([...nextSeen])).catch(() => {});
    }
    setSheet(true);
  };

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

  const cardFlow = card<{ month: string; income: string; consumption: string; net: string }>("period_flow");
  const flow = monthly.data
    ? {
        month: monthly.data.period.month,
        income: monthly.data.results.income.total,
        consumption: monthly.data.results.consumption.total,
        net: monthly.data.results.net,
      }
    : cardFlow ?? null;
  const monthName = flow ? MONTHS[Number(flow.month.slice(5)) - 1] ?? "este mes" : MONTHS[Number(currentMonth.slice(5)) - 1] ?? "este mes";
  const byCategory = monthly.data?.results.consumption.byCategory ?? [];

  const money = (v: string) => (hidden ? MASK : formatSoles(v));
  const go = (route: string) => router.push(route as never);
  const displayName = profile?.displayName ?? "bienvenido";
  const initial = (profile?.displayName?.trim().charAt(0) || "E").toUpperCase();

  // Resumen compacto de metas (solo si hay dinero reservado; Por cobrar vive en la campanita).
  const goalsReserved = goalsOv.data?.totals.reserved ?? "0.00";
  const goalsFree = goalsOv.data?.totals.free ?? "0.00";
  const hasGoalsReserved = cmpMoney(goalsReserved, "0.00") > 0;

  // Tarjetas opcionales del panel (presupuestos si el usuario las activó; Mis cuentas ya vive en Dinero).
  const renderExtraCard = (c: DashboardCard) => {
    if (c.id === "budgets") {
      const data = c.data as { budgets: Array<{ id: string; name: string; percent: number | null; level?: number | null; exceeded: boolean }> };
      if (!data?.budgets?.length) return null;
      return (
        <View key={c.id} style={{ gap: 8 }}>
          <SectionTitle title="Presupuestos" action={<SeeAll label="Ver todos" onPress={() => go("/budgets")} />} />
          <View style={{ gap: 10 }}>
            {[...data.budgets].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 3).map((b) => (
              <BudgetBar key={b.id} name={b.name} percent={b.percent ?? 0} level={b.level ?? null} exceeded={b.exceeded} onPress={() => go(`/budgets/${b.id}`)} />
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
        {/* Cabecera: avatar, saludo, ocultar saldos y campanita con estado visto */}
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
            onPress={openNotifications}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notificaciones nuevas: ${unreadCount}` : "Notificaciones"}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadCount > 0 && (
              <View style={{ position: "absolute", top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.dangerSurface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }}>
                <Text style={{ color: colors.onPrimary, fontSize: 10.5, fontFamily: "AsapBold" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Saldo total, línea de crédito disponible y flujo del mes (tarjeta editorial sin borde) */}
        <EditorialHeaderCard style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>
              Saldo total · {s.balance.accounts} {s.balance.accounts === 1 ? "cuenta" : "cuentas"}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 34, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}>
              {money(s.balance.net)}
            </Text>
          </View>
          {s.creditLines && s.creditLines.cards > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="card-outline" size={14} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "Asap" }}>
                Línea disponible{" "}
                <Text style={{ color: colors.text, fontFamily: "AsapSemiBold", fontVariant: ["tabular-nums"] }}>
                  {money(s.creditLines.available)}
                </Text>
              </Text>
            </View>
          )}
          {flow ? (
            <TouchableOpacity
              onPress={() => go("/reports")}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Ver resumen mensual"
              style={{ flexDirection: "row", paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <FlowCol label={`Ingresos · ${monthName}`} value={money(flow.income)} icon="arrow-down" color={colors.incomeStrong} />
              <FlowCol label={`Gastos · ${monthName}`} value={money(flow.consumption)} icon="arrow-up" color={colors.expenseStrong} divider />
            </TouchableOpacity>
          ) : null}
        </EditorialHeaderCard>

        <DailyTipCard refreshKey={tipRefreshKey} />

        {/* Gráfico protagonista del mes (Categorías + Balance, sin card) */}
        {flow && (
          <MonthlyChartCard
            monthLabel={monthName}
            income={flow.income}
            consumption={flow.consumption}
            net={flow.net}
            byCategory={byCategory}
            hidden={hidden}
            onOpenReports={() => go("/reports")}
          />
        )}

        {/* Próximos vencimientos: lista limpia sin bordes ni cajas */}
        {upcoming.length > 0 && (
          <View style={{ gap: 4 }}>
            <SectionTitle title="Próximos vencimientos" />
            <View>
              {upcoming.map((item, i) => (
                <UpcomingRow key={item.id} item={item} first={i === 0} hidden={hidden} onPress={() => go(item.route)} />
              ))}
            </View>
          </View>
        )}

        {/* Resumen compacto de metas (solo si tiene saldo reservado, sin borde) */}
        {hasGoalsReserved && (
          <TouchableOpacity
            onPress={() => go("/goals/accounts")}
            activeOpacity={0.78}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              backgroundColor: `${colors.text}06`,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Ionicons name="flag-outline" size={18} color={colors.incomeStrong} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>
                  En metas · {money(goalsReserved)}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>
                  Libre para gastar {money(goalsFree)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}

        {/* Tarjetas extra opcionales (ej. presupuestos si el usuario los activó) */}
        {cards.map(renderExtraCard)}

        {/* Últimos movimientos (hasta 5): lista abierta sin borde ni caja */}
        <View style={{ gap: 4 }}>
          <SectionTitle title="Últimos movimientos" action={<SeeAll label="Ver todo" onPress={() => go("/money")} />} />
          {recent.length === 0 ? (
            <View style={{ paddingVertical: 18, alignItems: "center", gap: 10 }}>
              <Ionicons name="receipt-outline" size={26} color={colors.muted} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>
                Aún no hay movimientos. Registra tu primer gasto o ingreso y aparecerá aquí.
              </Text>
              <Button title="Registrar movimiento" icon="add" size="compact" variant="secondary" onPress={() => go("/operation/new")} />
            </View>
          ) : (
            <View>
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
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 11,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                      opacity: tx.status === "reversed" ? 0.55 : 1,
                    }}
                  >
                    <Ionicons name={meta.icon} size={21} color={iconColor} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>
                        {!tx.description?.trim() ? meta.label : LEGACY_REV_RE.test(tx.description.trim()) ? "Reversión de movimiento" : tx.description}
                      </Text>
                      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                        {tx.occurredOn === s.asOf ? "Hoy" : humanDate(tx.occurredOn)} · {tx.to ? `${tx.account.name}${tx.account.deleted ? " (eliminada)" : ""} → ${tx.to}` : `${tx.account.name}${tx.account.deleted ? " (Cuenta eliminada)" : ""}`}
                      </Text>
                    </View>
                    <Text style={{ color: amountColor, fontSize: 14.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                      {hidden ? MASK : `${isTransfer ? "" : positive ? "+" : "-"}${formatSoles(absAmt)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Menú de notificaciones (al abrirse marca todo como visto y apaga el punto rojo) */}
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={attention.length ? `Notificaciones (${attention.length})` : "Notificaciones"} maxHeight={0.75}>
        {attention.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.incomeStrong} />
            <Text style={{ color: colors.textSecondary, fontFamily: "Asap", textAlign: "center" }}>Todo al día. No hay avisos pendientes.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: "hidden", marginHorizontal: 4, marginBottom: 6 }}>
            {attention.map((a, i) => (
              <AttentionRow
                key={a.id}
                a={a}
                first={i === 0}
                isNew={newWhenOpened.has(a.id)}
                onPress={() => { setSheet(false); go(a.route); }}
              />
            ))}
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

function FlowCol({ label, value, icon, color, divider }: { label: string; value: string; icon: "arrow-down" | "arrow-up"; color: string; divider?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, gap: 2, paddingLeft: divider ? 14 : 0, borderLeftWidth: divider ? 1 : 0, borderLeftColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={11} color={color} />
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "AsapMedium", flexShrink: 1 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 17.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function UpcomingRow({ item, first, hidden, onPress }: { item: UpcomingCardItem; first: boolean; hidden: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const toneColor = item.tone === "danger" ? colors.expenseStrong : item.tone === "warn" ? colors.warningStrong : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <Ionicons name={item.icon as IconName} size={20} color={toneColor} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ color: item.tone === "danger" || item.tone === "warn" ? toneColor : colors.textSecondary, fontSize: 12, fontFamily: item.tone === "danger" ? "AsapSemiBold" : "Asap" }}>
          {item.badgeText}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
        {hidden ? MASK : formatSoles(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function AttentionRow({ a, first, isNew, onPress }: { a: AttentionItem; first: boolean; isNew: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const ink = a.tone === "danger" ? colors.expenseStrong : a.tone === "warn" ? colors.warningStrong : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={a.icon as never} size={20} color={ink} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isNew && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.dangerSurface }} />}
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{a.title}</Text>
        </View>
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
