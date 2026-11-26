import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Account, OperationItem } from "../../api/types";
import { ReorderableBankCards } from "../../components/v1/ReorderableBankCards";
import { SelectField } from "../../components/v1/Select";
import { Button, Chip, Empty, ErrorBox, Loading, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { applyAccountOrder, loadAccountOrder, saveAccountOrder } from "../../utils/accountOrder";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { getDismissedUncategorized } from "../../utils/dismissedUncategorized";
import { cmpMoney, formatSoles } from "../../utils/money";

const HIDE_KEY = "eva_hide_balances";
const HIDE_CARD_TIP_KEY = "eva_hide_card_tip_date";
const MASK = "S/ ••••";
const KINDS: Array<[string | undefined, string]> = [[undefined, "Todos"], ["income", "Ingresos"], ["expense", "Gastos"], ["transfer", "Transferencias"]];
const PAGE = 15;
const CARD_GAP = 12;

type CardAdvisorResult = {
  best: { accountId: string; name: string; cutoffDate: string; dueDate: string; daysToPay: number } | null;
  cards: Array<{ accountId: string }>;
};

function dateGroupLabel(iso: string, today: string): string {
  if (iso === today) return "Hoy";
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  if (iso === d.toISOString().slice(0, 10)) return "Ayer";
  return humanDate(iso);
}

/** Pestaña Dinero: tu saldo, tus cuentas, avisos inteligentes y tus movimientos con búsqueda y agrupación por fecha. */
export default function MoneyScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const cardW = Math.min(224, Math.round(useWindowDimensions().width * 0.56));
  const cardH = Math.round(cardW / 1.586);
  const accounts = useAsync(() => api.accounts(), []);
  const summary = useAsync(() => api.summary(), []);
  const uncategorized = useAsync(() => api.operations({ uncategorized: "true", limit: 20 }).catch(() => null), []);
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hidden, setHidden] = useState(false);
  const [more, setMore] = useState<OperationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedUncat, setDismissedUncat] = useState<Set<string>>(new Set());
  const [tipDismissedToday, setTipDismissedToday] = useState(false);
  const [accountOrder, setAccountOrder] = useState<string[]>([]);
  const [draggingCards, setDraggingCards] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === "1")).catch(() => {});
    getDismissedUncategorized().then(setDismissedUncat).catch(() => {});
    AsyncStorage.getItem(HIDE_CARD_TIP_KEY).then((v) => setTipDismissedToday(v === todayLocalIso())).catch(() => {});
    loadAccountOrder().then(setAccountOrder).catch(() => {});
  }, []);

  const dismissCardTip = () => {
    setTipDismissedToday(true);
    void AsyncStorage.setItem(HIDE_CARD_TIP_KEY, todayLocalIso()).catch(() => {});
  };

  const toggleHidden = () => {
    setHidden((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(HIDE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  };

  const list = useMemo(
    () => applyAccountOrder((accounts.data ?? []).filter((a) => a.status === "active"), accountOrder),
    [accounts.data, accountOrder],
  );
  const handleReorderAccounts = useCallback((nextAccounts: Account[]) => {
    const ids = nextAccounts.map((a) => a.id);
    setAccountOrder(ids);
    void saveAccountOrder(ids);
  }, []);
  const archived = useMemo(() => (accounts.data ?? []).filter((a) => a.status === "archived"), [accounts.data]);
  const creditCount = useMemo(() => list.filter((a) => a.type === "credit").length, [list]);
  const advisor = useAsync(
    async () => (creditCount >= 2 ? ((await api.cardAdvisor().catch(() => null)) as CardAdvisorResult | null) : null),
    [creditCount],
  );

  const ops = useAsync(async () => {
    const r = await api.operations({ limit: PAGE, kind, accountId, q: debouncedSearch || undefined });
    setMore([]); setCursor(r.nextCursor); setMoreError(null);
    return r.items;
  }, [kind, accountId, debouncedSearch]);

  const reload = useCallback(() => {
    void accounts.reload();
    void summary.reload();
    void ops.reload();
    void uncategorized.reload();
    void advisor.reload();
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === "1")).catch(() => {});
    getDismissedUncategorized().then(setDismissedUncat).catch(() => {});
  }, [accounts.reload, summary.reload, ops.reload, uncategorized.reload, advisor.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([accounts.reload(), summary.reload(), ops.reload(), uncategorized.reload(), advisor.reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [accounts.reload, summary.reload, ops.reload, uncategorized.reload, advisor.reload]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true); setMoreError(null);
    try {
      const r = await api.operations({ limit: PAGE, kind, accountId, q: debouncedSearch || undefined, cursor });
      setMore((m) => [...m, ...r.items]); setCursor(r.nextCursor);
    } catch (e) { setMoreError(errorMessage(e)); }
    finally { setLoadingMore(false); }
  };

  const [showArchived, setShowArchived] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const s = summary.data;
  const excludedCount = list.filter((a) => a.excludeFromTotal).length;
  const includedCount = s ? s.balance.accounts : list.length - excludedCount;
  const items = useMemo(() => [...(ops.data ?? []), ...more], [ops.data, more]);
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.name])), [accounts.data]);
  const accountOptions = [{ id: "all", label: "Todas las cuentas" }, ...list.map((a) => ({ id: a.id, label: a.name }))];

  const today = todayLocalIso();
  const grouped = useMemo(() => {
    const out: Array<{ date: string; label: string; ops: OperationItem[] }> = [];
    for (const op of items) {
      const last = out[out.length - 1];
      if (last && last.date === op.occurredOn) last.ops.push(op);
      else out.push({ date: op.occurredOn, label: dateGroupLabel(op.occurredOn, today), ops: [op] });
    }
    return out;
  }, [items, today]);

  const visibleUncat = useMemo(
    () => (uncategorized.data?.items ?? []).filter((o) => !dismissedUncat.has(o.id)),
    [uncategorized.data?.items, dismissedUncat],
  );
  const uncatCount = visibleUncat.length;
  const uncatHasMore = !!uncategorized.data?.nextCursor && uncatCount > 0;
  const bestCard = advisor.data?.cards && advisor.data.cards.length >= 2 && !tipDismissedToday ? advisor.data.best : null;

  return (
    <Screen title="Dinero" back={false} scrollEnabled={!draggingCards} refreshing={refreshing} onRefresh={onRefresh} right={<Button title="Cuenta" icon="add" size="compact" onPress={() => router.push("/account/new" as never)} />}>
      <View style={{ backgroundColor: colors.primarySurface, borderRadius: 22, padding: 15, overflow: "hidden", gap: 3 }}>
        <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Saldo total</Text>
          <TouchableOpacity
            onPress={toggleHidden}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar saldos" : "Ocultar saldos"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.16)" }}
          >
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={16} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 30, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
          {hidden ? MASK : s ? formatSoles(s.balance.net) : "…"}
        </Text>
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 11.5, fontFamily: "Asap" }}>
          {includedCount} {includedCount === 1 ? "cuenta" : "cuentas"}{excludedCount > 0 ? ` (${excludedCount} excluida${excludedCount === 1 ? "" : "s"})` : ""} · deuda de tarjetas ya descontada
        </Text>
        {s?.creditLines && s.creditLines.cards > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="card-outline" size={13} color={colors.onPrimaryMuted} />
              <Text style={{ color: colors.onPrimaryMuted, fontSize: 11.5, fontFamily: "AsapMedium" }}>Línea de crédito disponible</Text>
            </View>
            <Text style={{ color: colors.onPrimary, fontSize: 13, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
              {hidden ? MASK : formatSoles(s.creditLines.available)}
            </Text>
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Mis cuentas</Text>
          {list.length > 1 && (
            <Text style={{ color: draggingCards ? colors.primary : colors.muted, fontSize: 11.5, fontFamily: draggingCards ? "AsapBold" : "Asap" }}>
              {draggingCards ? "Desliza para acomodar…" : "Mantén y arrastra"}
            </Text>
          )}
        </View>
        {bestCard && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 12,
              paddingRight: 8,
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: `${colors.primary}10`,
              borderWidth: 1,
              borderColor: `${colors.primary}25`,
            }}
          >
            <TouchableOpacity
              onPress={() => router.push(`/account/${bestCard.accountId}/card` as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 12, fontFamily: "Asap" }}>
                Sugerencia hoy: usa <Text style={{ fontFamily: "AsapBold" }}>{bestCard.name}</Text> ({bestCard.daysToPay} días)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={dismissCardTip}
              accessibilityRole="button"
              accessibilityLabel="Ocultar sugerencia por hoy"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : list.length === 0 ? (
        <Empty icon="wallet-outline" title="Aún no tienes cuentas" text="Crea tu primera cuenta con su saldo actual. No cuenta como ingreso del mes." action={<Button title="Crear cuenta" icon="add" onPress={() => router.push("/account/new" as never)} />} />
      ) : (
        <ReorderableBankCards
          accounts={list}
          cardW={cardW}
          cardH={cardH}
          gap={CARD_GAP}
          hidden={hidden}
          onPressAccount={(id) => router.push(`/account/${id}` as never)}
          onPressNew={() => router.push("/account/new" as never)}
          onReorder={handleReorderAccounts}
          onDragStateChange={setDraggingCards}
        />
      )}

      {archived.length > 0 && (
        <View style={{ gap: 8 }}>
          <TouchableOpacity onPress={() => setShowArchived((v) => !v)} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
            <Ionicons name={showArchived ? "chevron-up" : "archive-outline"} size={15} color={colors.textSecondary} />
            <Txt size={12} muted bold>{showArchived ? "Ocultar cuentas archivadas" : `Ver cuentas archivadas (${archived.length})`}</Txt>
          </TouchableOpacity>
          {showArchived && archived.map((a) => (
            <TouchableOpacity key={a.id} onPress={() => router.push(`/account/${a.id}/edit` as never)} activeOpacity={0.75} accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Txt bold size={14} numberOfLines={1}>{a.name}</Txt>
                <Txt size={12} muted>{hidden ? MASK : formatSoles(a.balance)} · Archivada</Txt>
              </View>
              <Chip status="converted" label="Gestionar" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Movimientos</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {uncatCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push("/classify" as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: `${colors.primary}14` }}
            >
              <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11.5, fontFamily: "AsapBold" }}>
                {uncatHasMore ? `${uncatCount}+` : uncatCount} sin cat.
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setShowSearch((prev) => {
                if (prev && search) setSearch("");
                return !prev;
              });
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={showSearch ? "Ocultar búsqueda" : "Buscar movimientos"}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: showSearch || search ? `${colors.primary}18` : `${colors.text}08`,
            }}
          >
            <Ionicons name="search-outline" size={17} color={showSearch || search ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
          {list.length > 1 && (
            <TouchableOpacity
              onPress={() => setShowAccountFilter((v) => !v)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Filtrar por cuenta"
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: showAccountFilter || accountId ? `${colors.primary}18` : `${colors.text}08`,
              }}
            >
              <Ionicons name="options-outline" size={17} color={showAccountFilter || accountId ? colors.primary : colors.textSecondary} />
              {accountId && (
                <View style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(showSearch || search.length > 0) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 13, borderRadius: 14, backgroundColor: `${colors.text}07` }}>
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus={showSearch && !search}
            placeholder="Buscar por descripción…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={{ flex: 1, color: colors.text, fontFamily: search ? "AsapSemiBold" : "Asap", fontSize: 14, paddingVertical: 7 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 6, paddingVertical: 1 }}>
        {KINDS.map(([k, label]) => <FilterChip key={label} label={label} active={kind === k} onPress={() => setKind(k)} />)}
      </ScrollView>

      {list.length > 1 && (showAccountFilter || accountId) && (
        <View style={{ marginTop: -4, marginBottom: -4 }}>
          <SelectField value={accountId ?? "all"} options={accountOptions} onChange={(v) => setAccountId(v === "all" ? undefined : v)} />
        </View>
      )}

      {ops.loading && !ops.data ? <Loading /> : ops.error ? <ErrorBox message={ops.error} onRetry={ops.reload} /> : items.length === 0 ? (
        <Empty
          icon={debouncedSearch ? "search-outline" : "swap-vertical-outline"}
          title={debouncedSearch ? "Sin resultados" : "Sin movimientos"}
          text={debouncedSearch ? `No encontramos movimientos con «${debouncedSearch}».` : "Aquí verás tus ingresos, gastos y transferencias."}
          action={!debouncedSearch ? <Button title="Registrar movimiento" icon="add" onPress={() => router.push("/operation/new" as never)} /> : undefined}
        />
      ) : (
        <View style={{ gap: 14 }}>
          {grouped.map((g) => (
            <View key={g.date} style={{ gap: 2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 2 }}>
                {g.label}
              </Text>
              <View>
                {g.ops.map((o, i) => {
                  const fromName = o.accountName ?? (o.accountId ? accountById.get(o.accountId) : null) ?? "Cuenta";
                  const fromLabel = o.accountDeleted ? `${fromName} (eliminada)` : fromName;
                  const toName = o.toAccountName ?? (o.toAccountId ? accountById.get(o.toAccountId) : null) ?? "Cuenta";
                  const toLabel = o.toAccountDeleted ? `${toName} (eliminada)` : toName;
                  return (
                    <OperationRow
                      key={o.id}
                      op={o}
                      first={i === 0}
                      hidden={hidden}
                      accountLabel={
                        o.kind === "transfer" && (o.accountId || o.accountName) && (o.toAccountId || o.toAccountName)
                          ? `${fromLabel} → ${toLabel}`
                          : (o.accountId || o.accountName)
                            ? (o.accountDeleted ? `${fromName} (Cuenta eliminada)` : fromName)
                            : null
                      }
                      onPress={() => router.push(`/operation/${o.id}` as never)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
      {moreError && <ErrorBox message={moreError} onRetry={loadMore} />}
      {cursor && <Button title="Ver más movimientos" variant="secondary" size="compact" busy={loadingMore} onPress={loadMore} />}
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={{ minHeight: 34, paddingHorizontal: 12, justifyContent: "center", borderRadius: 99, backgroundColor: active ? colors.primarySurface : `${colors.primary}12` }}>
      <Txt size={12} bold color={active ? colors.onPrimary : colors.primary}>{label}</Txt>
    </TouchableOpacity>
  );
}

const OP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  income: "arrow-down-circle-outline",
  expense: "arrow-up-circle-outline",
  transfer: "swap-horizontal-outline",
  adjustment: "construct-outline",
  reversal: "refresh-outline",
  opening: "flag-outline",
};
const OP_FALLBACK: Record<string, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
  adjustment: "Ajuste",
  reversal: "Reversión",
  opening: "Saldo inicial",
};
const LEGACY_REV_RE = /^Reversión de [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function OperationRow({ op, first, hidden, accountLabel, onPress }: { op: OperationItem; first: boolean; hidden: boolean; accountLabel: string | null; onPress: () => void }) {
  const { colors } = useAppTheme();
  const reversed = op.status === "reversed";
  const isTransfer = op.kind === "transfer";
  const isIncome = op.kind === "income";
  const isExpense = op.kind === "expense";
  const iconColor = isTransfer ? colors.primary : isIncome ? colors.incomeStrong : isExpense ? colors.expenseStrong : colors.textSecondary;
  const amountColor = isTransfer ? colors.primary : isIncome ? colors.incomeStrong : isExpense ? colors.expenseStrong : colors.text;
  const absAmt = op.amount.replace("-", "");
  const sign = isTransfer ? "" : isIncome ? "+" : isExpense ? "-" : cmpMoney(op.amount, "0.00") < 0 ? "-" : "+";
  const subParts = [accountLabel, op.category?.name].filter(Boolean).join(" · ");
  const rawDesc = op.description?.trim() ?? "";
  const title = !rawDesc ? (OP_FALLBACK[op.kind] ?? "Movimiento") : LEGACY_REV_RE.test(rawDesc) ? "Reversión de movimiento" : rawDesc;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, opacity: reversed ? 0.55 : 1 }}>
      <Ionicons name={OP_ICON[op.kind] ?? "ellipse-outline"} size={21} color={iconColor} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>{title}</Text>
        {subParts ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{subParts}</Text> : null}
      </View>
      {reversed && <Chip status="reversed" label="Revertido" />}
      <Text style={{ color: hidden ? colors.textSecondary : amountColor, fontSize: 14.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
        {hidden ? MASK : `${sign}${formatSoles(absAmt)}`}
      </Text>
    </TouchableOpacity>
  );
}
