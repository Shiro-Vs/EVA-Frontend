import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Account, OperationItem } from "../../api/types";
import GeminiMark from "../../components/common/GeminiMark";
import { SelectField } from "../../components/v1/Select";
import { Button, Chip, Empty, ErrorBox, Loading, Money, Screen, Txt } from "../../components/v1/ui";
import { bankPreset } from "../../constants/banks";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const HIDE_KEY = "eva_hide_balances";
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === "1")).catch(() => {});
  }, []);

  const toggleHidden = () => {
    setHidden((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(HIDE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  };

  const list = useMemo(() => (accounts.data ?? []).filter((a) => a.status === "active"), [accounts.data]);
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

  const uncatCount = uncategorized.data?.items.length ?? 0;
  const uncatHasMore = !!uncategorized.data?.nextCursor;
  const bestCard = advisor.data?.cards && advisor.data.cards.length >= 2 ? advisor.data.best : null;

  return (
    <Screen title="Dinero" back={false} refreshing={refreshing} onRefresh={onRefresh} right={<Button title="Cuenta" icon="add" size="compact" onPress={() => router.push("/account/new" as never)} />}>
      <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 18, overflow: "hidden", gap: 4 }}>
        <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Saldo total</Text>
          <TouchableOpacity
            onPress={toggleHidden}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar saldos" : "Ocultar saldos"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.16)" }}
          >
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={17} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 32, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
          {hidden ? MASK : s ? formatSoles(s.balance.net) : "…"}
        </Text>
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "Asap" }}>
          {includedCount} {includedCount === 1 ? "cuenta" : "cuentas"}{excludedCount > 0 ? ` (${excludedCount} excluida${excludedCount === 1 ? "" : "s"})` : ""} · lo que debes en tarjetas ya está descontado
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <LinkTile icon="people-outline" iconColor={colors.sections.people.ink} title="A personas" text="préstamos" onPress={() => router.push("/loans" as never)} />
        <LinkTile icon="business-outline" iconColor={colors.sections.money.ink} title="Bancarios" text="préstamos" onPress={() => router.push("/bank-loans" as never)} />
        <LinkTile icon="bar-chart-outline" iconColor={colors.primary} title="Resumen" text="del mes" onPress={() => router.push("/reports" as never)} />
      </View>

      {(uncatCount > 0 || bestCard) && (
        <View style={{ gap: 8 }}>
          {uncatCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push("/classify" as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold" }}>
                  {uncatHasMore ? `${uncatCount}+` : uncatCount} {uncatCount === 1 ? "movimiento sin categoría" : "movimientos sin categoría"}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                  Toca para clasificar a mano o con tus reglas
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
          {bestCard && (
            <TouchableOpacity
              onPress={() => router.push(`/account/${bestCard.accountId}/card` as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="card-outline" size={18} color={colors.sections.money.ink} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold" }}>
                  Mejor tarjeta hoy: {bestCard.name}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                  {bestCard.daysToPay} días para pagar · corte {humanDate(bestCard.cutoffDate)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold", marginTop: 4 }}>Mis cuentas</Text>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : list.length === 0 ? (
        <Empty icon="wallet-outline" title="Aún no tienes cuentas" text="Crea tu primera cuenta con su saldo actual. No cuenta como ingreso del mes." action={<Button title="Crear cuenta" icon="add" onPress={() => router.push("/account/new" as never)} />} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + CARD_GAP} decelerationRate="fast" style={{ marginHorizontal: -24, marginTop: -4 }} contentContainerStyle={{ paddingHorizontal: 24, gap: CARD_GAP }}>
          {list.map((a: Account) => <AccountCard key={a.id} width={cardW} height={cardH} account={a} hidden={hidden} onPress={() => router.push(`/account/${a.id}` as never)} />)}
          <TouchableOpacity onPress={() => router.push("/account/new" as never)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Nueva cuenta"
            style={{ width: 104, height: cardH, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted, alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Ionicons name="add" size={22} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, fontFamily: "AsapBold" }}>Nueva cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
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

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Movimientos</Text>
        <TouchableOpacity
          onPress={() => router.push("/analysis" as never)}
          activeOpacity={0.75}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
        >
          <GeminiMark size={13} />
          <Text style={{ color: colors.text, fontSize: 12, fontFamily: "AsapBold" }}>Analizar con IA</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 42, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: search ? colors.borderStrong : colors.border }}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por descripción…"
          placeholderTextColor={`${colors.muted}73`}
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, fontFamily: search ? "AsapSemiBold" : "AsapItalic", fontSize: 14, paddingVertical: 8 }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, marginTop: -4 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingVertical: 2 }}>
        {KINDS.map(([k, label]) => <FilterChip key={label} label={label} active={kind === k} onPress={() => setKind(k)} />)}
      </ScrollView>
      {list.length > 1 && (
        <View style={{ marginTop: -6, marginBottom: -8 }}>
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
        <View style={{ gap: 10 }}>
          {grouped.map((g) => (
            <View key={g.date} style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
                {g.label}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
                {g.ops.map((o, i) => (
                  <OperationRow
                    key={o.id}
                    op={o}
                    first={i === 0}
                    hidden={hidden}
                    accountLabel={
                      o.kind === "transfer" && o.accountId && o.toAccountId
                        ? `${accountById.get(o.accountId) ?? "Cuenta"} → ${accountById.get(o.toAccountId) ?? "Cuenta"}`
                        : o.accountId
                          ? accountById.get(o.accountId) ?? null
                          : null
                    }
                    onPress={() => router.push(`/operation/${o.id}` as never)}
                  />
                ))}
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

/** Tarjeta de una cuenta con diseño de tarjeta bancaria (proporción 85,6 × 54 mm, chip, contactless, brillo). */
function AccountCard({ account: a, width, height, hidden, onPress }: { account: Account; width: number; height: number; hidden: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const credit = a.type === "credit";
  const wallet = a.type === "cash" || a.type === "wallet";
  const brand = bankPreset(a.institution, a.name);
  const bg = brand ? brand.colors[1] : credit ? colors.card : wallet ? colors.accent : colors.primarySurface;
  const ink = brand ? brand.ink : credit ? colors.text : wallet ? colors.onAccent : colors.onPrimary;
  const soft = brand ? brand.soft : credit ? colors.textSecondary : wallet ? colors.onAccent : colors.onPrimaryMuted;
  const owes = cmpMoney(a.balance, "0.00") < 0;
  const kind = credit ? "CRÉDITO" : a.type === "cash" ? "EFECTIVO" : a.type === "wallet" ? "BILLETERA" : a.type === "savings" ? "AHORROS" : "DÉBITO";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={`${a.name}, ${hidden ? "oculto" : formatSoles(a.balance)}`}
      style={{ width, height, borderRadius: 16, overflow: "hidden", backgroundColor: bg, borderWidth: credit && !brand ? 1 : 0, borderColor: colors.borderStrong }}>
      {brand && <LinearGradient colors={brand.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      <LinearGradient colors={credit && !brand ? ["rgba(255,255,255,0.06)", "rgba(0,0,0,0.12)"] : ["rgba(255,255,255,0.22)", "rgba(255,255,255,0)", "rgba(0,0,0,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", top: -width * 0.28, right: -width * 0.18, width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, backgroundColor: credit && !brand ? `${colors.text}07` : "rgba(255,255,255,0.10)" }} />
      <View style={{ position: "absolute", bottom: -width * 0.38, left: -width * 0.12, width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, backgroundColor: credit && !brand ? `${colors.text}05` : "rgba(255,255,255,0.06)" }} />

      <View style={{ flex: 1, padding: 13, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text numberOfLines={1} style={{ color: ink, fontSize: 13, fontFamily: "AsapBold", letterSpacing: 0.3, maxWidth: "74%" }}>{brand?.label ?? a.institution ?? a.name}</Text>
          <Ionicons name="wifi" size={16} color={soft} style={{ transform: [{ rotate: "90deg" }] }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <View style={{ width: 30, height: 22, borderRadius: 5, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.25)" }}>
            <LinearGradient colors={["#EBD28E", "#B98F3E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
              <View style={{ position: "absolute", top: 7, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", top: 14, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <View style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
            </LinearGradient>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
            <Text style={{ color: soft, fontSize: 10, fontFamily: "AsapMedium", letterSpacing: 1 }}>{credit ? (owes || cmpMoney(a.balance, "0.00") === 0 ? "DEUDA" : "A FAVOR") : "SALDO"}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: credit && owes && !brand ? colors.expenseStrong : ink, fontSize: 18, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
              {hidden ? MASK : formatSoles(credit && owes ? a.balance.replace("-", "") : a.balance)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>{a.name}</Text>
          <Text style={{ color: soft, fontSize: 10, fontFamily: "AsapBold", letterSpacing: 1 }}>{kind}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function LinkTile({ icon, iconColor, title, text, onPress }: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; text: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${title} ${text}`}
      style={{ flex: 1, gap: 6, padding: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{text}</Text>
      </View>
    </TouchableOpacity>
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

function OperationRow({ op, first, hidden, accountLabel, onPress }: { op: OperationItem; first: boolean; hidden: boolean; accountLabel: string | null; onPress: () => void }) {
  const { colors } = useAppTheme();
  const reversed = op.status === "reversed";
  const tone = op.kind === "income" ? "income" : op.kind === "expense" ? "expense" : "muted";
  const iconColor = op.kind === "income" ? colors.incomeStrong : op.kind === "expense" ? colors.expenseStrong : colors.textSecondary;
  const subParts = [accountLabel, op.category?.name].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, opacity: reversed ? 0.55 : 1 }}>
      <Ionicons name={OP_ICON[op.kind] ?? "ellipse-outline"} size={20} color={iconColor} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{op.description || "Sin descripción"}</Text>
        {subParts ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{subParts}</Text> : null}
      </View>
      {reversed && <Chip status="reversed" label="Revertido" />}
      {hidden ? (
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{MASK}</Text>
      ) : (
        <Money value={op.amount} tone={tone} />
      )}
    </TouchableOpacity>
  );
}
