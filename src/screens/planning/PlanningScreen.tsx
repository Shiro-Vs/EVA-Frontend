import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Interval, Subscription } from "../../api/types";
import { Button, Empty, ErrorBox, Loading, Screen } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { todayLocalIso } from "../../utils/dates";
import { formatSoles } from "../../utils/money";
import { getAdjustedColor, ServiceIcon } from "../../utils/serviceIcons";
import { daysUntil, whenText } from "../dashboard/attention";

type View_ = "cards" | "list";
type Filter = "all" | "shared" | "personal" | "archived";
const VIEW_KEY = "eva.services.view";

/** «/mes», «/año», «/3 meses»: lo que cuesta cada cobro del proveedor. */
function per(iv: Interval | null | undefined): string {
  if (!iv) return "";
  const { unit, count } = iv;
  const one = { day: "día", week: "sem", month: "mes", year: "año" }[unit];
  if (count === 1) return `/${one}`;
  return `/${count} ${{ day: "días", week: "sem", month: "meses", year: "años" }[unit]}`;
}

const renewalOf = (s: Subscription) => s.currentCycle?.endDate ?? null;

/** Pantalla de servicios: resumen arriba y las suscripciones como tarjetas o como lista (se recuerda tu elección). */
export default function PlanningScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const [view, setView] = useState<View_>("cards");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const subs = useAsync(() => api.subscriptions(), []);
  const archivedSubs = useAsync(() => (filter === "archived" ? api.subscriptions("archived") : Promise.resolve<Subscription[]>([])), [filter === "archived"]);
  const summary = useAsync(() => api.summary(), []);
  const reload = useCallback(() => {
    void subs.reload();
    void summary.reload();
    if (filter === "archived") void archivedSubs.reload();
  }, [subs.reload, summary.reload, archivedSubs.reload, filter]);
  useFocusReload(reload);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([subs.reload(), summary.reload(), ...(filter === "archived" ? [archivedSubs.reload()] : [])]);
    } finally {
      setRefreshing(false);
    }
  }, [subs.reload, summary.reload, archivedSubs.reload, filter]);

  useEffect(() => { AsyncStorage.getItem(VIEW_KEY).then((v) => { if (v === "cards" || v === "list") setView(v); }).catch(() => {}); }, []);
  const chooseView = (v: View_) => { setView(v); AsyncStorage.setItem(VIEW_KEY, v).catch(() => {}); };

  const today = todayLocalIso();
  // Sin filtro "archived", la API ya excluye archivados pero incluye activos y suspendidos (para poder reactivarlos).
  const allActive = subs.data ?? [];
  const activeOnly = useMemo(() => allActive.filter((s) => s.status === "active"), [allActive]);
  const source = filter === "archived" ? (archivedSubs.data ?? []) : allActive;
  const q = query.trim().toLowerCase();
  const list = useMemo(() => source
    .filter((s) => filter === "all" || filter === "archived" || s.mode === filter)
    .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.provider ?? "").toLowerCase().includes(q))
    .sort((a, b) => (a.status === "suspended" ? 1 : 0) - (b.status === "suspended" ? 1 : 0) || (renewalOf(a) ?? "9999").localeCompare(renewalOf(b) ?? "9999") || a.name.localeCompare(b.name)), [source, filter, q]);
  const showSearch = allActive.length >= 4 || (filter === "archived" && source.length >= 4) || query.length > 0;
  const next = useMemo(() => activeOnly.filter((s) => renewalOf(s)).sort((a, b) => renewalOf(a)!.localeCompare(renewalOf(b)!))[0], [activeOnly]);
  const nextDays = next ? daysUntil(renewalOf(next)!, today) : null;
  const sharedCount = activeOnly.filter((s) => s.mode === "shared").length;

  if ((subs.loading && !subs.data) || (summary.loading && !summary.data)) return <Screen title="Servicios" back={false}><Loading /></Screen>;
  if (subs.error || summary.error) return <Screen title="Servicios" back={false}><ErrorBox message={(subs.error ?? summary.error)!} onRetry={reload} /></Screen>;
  const s = summary.data;

  return (
    <Screen title="Servicios" back={false} subtitle="Tus suscripciones y lo que cobras por ellas" refreshing={refreshing} onRefresh={onRefresh}
      right={<Button title="Nuevo" icon="add" size="compact" onPress={() => router.push("/service/new" as never)} />}>
      {/* Resumen */}
      <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 16, overflow: "hidden" }}>
        <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Comprometido este ciclo</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 30, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{formatSoles(s?.subscriptions.currentCycleTotal)}</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Stat label="Servicios" value={`${s?.subscriptions.active ?? activeOnly.length}`} sub={sharedCount ? (sharedCount === 1 ? "1 compartido" : `${sharedCount} compartidos`) : "activos"} />
          <Stat label="Por cobrar" value={formatSoles(s?.receivable.pending)} sub={s && Number(s.receivable.overdue) > 0 ? `${formatSoles(s.receivable.overdue)} vencido` : "al día"} />
        </View>
        {next && nextDays !== null && (
          <TouchableOpacity onPress={() => router.push(`/service/${next.id}` as never)} accessibilityRole="button" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, minHeight: 40, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Ionicons name="time-outline" size={16} color={colors.onPrimary} />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.onPrimary, fontSize: 13, fontFamily: "AsapMedium" }}>Próxima renovación: <Text style={{ fontFamily: "AsapBold" }}>{next.name} {whenText(nextDays)}</Text></Text>
            <Ionicons name="chevron-forward" size={14} color={colors.onPrimaryMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros y vista */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, alignItems: "center", paddingVertical: 2 }}>
          {([["all", "Todos"], ["shared", "Compartidos"], ["personal", "Personales"], ["archived", "Archivados"]] as Array<[Filter, string]>).map(([id, label]) => {
            const on = filter === id;
            return (
              <TouchableOpacity key={id} onPress={() => setFilter(id)} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 99, justifyContent: "center", backgroundColor: on ? colors.primarySurface : `${colors.primary}12` }}>
                <Text style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border }}>
          {([["cards", "grid-outline", "Ver como tarjetas"], ["list", "list-outline", "Ver como lista"]] as Array<[View_, keyof typeof Ionicons.glyphMap, string]>).map(([id, icon, label]) => (
            <TouchableOpacity key={id} onPress={() => chooseView(id)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: view === id }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={{ width: 36, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: view === id ? colors.primarySurface : "transparent" }}>
              <Ionicons name={icon} size={17} color={view === id ? colors.onPrimary : colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showSearch && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 42, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar servicio o proveedor…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={{ flex: 1, color: colors.text, fontFamily: "Asap", fontSize: 14, paddingVertical: 8 }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {filter === "archived" && archivedSubs.loading && !archivedSubs.data?.length ? (
        <Loading />
      ) : filter === "archived" && archivedSubs.error ? (
        <ErrorBox message={archivedSubs.error} onRetry={archivedSubs.reload} />
      ) : list.length === 0 ? (
        <Empty
          icon={q ? "search-outline" : "calendar-outline"}
          title={q ? "Sin resultados" : filter === "archived" ? "Sin servicios archivados" : allActive.length === 0 ? "Crea tu primer servicio" : "Nada con este filtro"}
          text={q ? `No encontramos ningún servicio que coincida con «${query.trim()}».` : filter === "archived" ? "Los servicios que archives aparecerán aquí por si quieres restaurarlos." : allActive.length === 0 ? "Netflix, Spotify… Registra el plan, su calendario y quién participa." : "Prueba con otro filtro."}
          action={!q && filter !== "archived" && allActive.length === 0 ? <Button title="Nuevo servicio" icon="add" onPress={() => router.push("/service/new" as never)} /> : undefined}
        />
      ) : view === "cards" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {list.map((sub) => <ServiceCard key={sub.id} sub={sub} today={today} isDark={isDark} onPress={() => router.push(`/service/${sub.id}` as never)} />)}
        </View>
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {list.map((sub, i) => <ServiceRow key={sub.id} sub={sub} today={today} isDark={isDark} first={i === 0} onPress={() => router.push(`/service/${sub.id}` as never)} />)}
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium" }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 17, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "Asap" }}>{sub}</Text>
    </View>
  );
}

/** Cuándo se renueva, dicho corto y con color si es pronto. */
function useRenewal(sub: Subscription, today: string) {
  const { colors } = useAppTheme();
  if (sub.status === "suspended") return { text: "Suspendido", color: colors.warningStrong, soon: false };
  if (sub.status === "archived") return { text: "Archivado", color: colors.textSecondary, soon: false };
  const end = renewalOf(sub);
  if (!end) return { text: "Sin ciclo", color: colors.textSecondary, soon: false };
  const d = daysUntil(end, today);
  return { text: d < 0 ? whenText(d) : `Renueva ${whenText(d)}`, color: d <= 1 ? colors.warningStrong : d <= 3 ? colors.accentStrong : colors.textSecondary, soon: d <= 3 };
}

function Seats({ sub, color }: { sub: Subscription; color: string }) {
  const { colors } = useAppTheme();
  if (sub.mode !== "shared") return <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>Personal</Text>;
  const dots = Math.min(sub.capacity, 8);
  const filled = Math.round((Math.min(sub.occupiedSeats, sub.capacity) / sub.capacity) * dots);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {Array.from({ length: dots }).map((_, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i < filled ? color : `${colors.text}22` }} />)}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{sub.occupiedSeats}/{sub.capacity}</Text>
    </View>
  );
}

function ServiceCard({ sub, today, isDark, onPress }: { sub: Subscription; today: string; isDark: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const tone = getAdjustedColor(sub.color || colors.primary, isDark);
  const r = useRenewal(sub, today);
  const dim = sub.status === "archived" || sub.status === "suspended";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${sub.name}, ${formatSoles(sub.terms?.announcedPrice)}, ${r.text}`}
      style={{ width: "47.5%", borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 10, opacity: dim ? 0.78 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ServiceIcon name={sub.icon || "receipt"} size={24} color={tone} />
        {r.soon && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color }} />}
      </View>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{sub.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: colors.text, fontSize: 18, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], flexShrink: 1 }}>{formatSoles(sub.terms?.announcedPrice)}</Text>
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", flexShrink: 1 }}>{per(sub.terms?.interval)}</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text numberOfLines={1} style={{ color: r.color, fontSize: 12, fontFamily: r.soon ? "AsapBold" : "AsapMedium" }}>{r.text}</Text>
        <Seats sub={sub} color={tone} />
      </View>
    </TouchableOpacity>
  );
}

function ServiceRow({ sub, today, isDark, first, onPress }: { sub: Subscription; today: string; isDark: boolean; first: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const tone = getAdjustedColor(sub.color || colors.primary, isDark);
  const r = useRenewal(sub, today);
  const dim = sub.status === "archived" || sub.status === "suspended";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, opacity: dim ? 0.78 : 1 }}>
      <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
        <ServiceIcon name={sub.icon || "receipt"} size={23} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{sub.name}</Text>
        <Text numberOfLines={1} style={{ color: r.color, fontSize: 12, fontFamily: r.soon ? "AsapBold" : "Asap" }}>{r.text}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{formatSoles(sub.terms?.announcedPrice)}<Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{per(sub.terms?.interval)}</Text></Text>
        <Seats sub={sub} color={tone} />
      </View>
    </TouchableOpacity>
  );
}
