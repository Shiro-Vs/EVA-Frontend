import React, { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Account, OperationItem } from "../../api/types";
import { SelectField } from "../../components/v1/Select";
import { Button, Chip, Empty, ErrorBox, Loading, Money, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bank: "business", savings: "save", cash: "cash", wallet: "phone-portrait", credit: "card" };
const KINDS: Array<[string | undefined, string]> = [[undefined, "Todos"], ["income", "Ingresos"], ["expense", "Gastos"], ["transfer", "Traspasos"]];
const PAGE = 12;
const CARD_H = 124;
const CARD_GAP = 12;

/** Pestaña Dinero: tu saldo, tus cuentas, tus movimientos y el acceso a los préstamos. */
export default function MoneyScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const cardW = Math.min(280, Math.round(useWindowDimensions().width * 0.68));
  const accounts = useAsync(() => api.accounts(), []);
  const summary = useAsync(() => api.summary(), []);
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [more, setMore] = useState<OperationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const ops = useAsync(async () => {
    const r = await api.operations({ limit: PAGE, kind, accountId });
    setMore([]); setCursor(r.nextCursor);
    return r.items;
  }, [kind, accountId]);

  const reload = useCallback(() => { void accounts.reload(); void summary.reload(); void ops.reload(); }, [accounts.reload, summary.reload, ops.reload]);
  useFocusReload(reload);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true); setMoreError(null);
    try {
      const r = await api.operations({ limit: PAGE, kind, accountId, cursor });
      setMore((m) => [...m, ...r.items]); setCursor(r.nextCursor);
    } catch (e) { setMoreError(errorMessage(e)); }
    finally { setLoadingMore(false); }
  };

  const list = (accounts.data ?? []).filter((a) => a.status === "active");
  const items = [...(ops.data ?? []), ...more];
  const s = summary.data;
  const accountOptions = [{ id: "all", label: "Todas las cuentas" }, ...list.map((a) => ({ id: a.id, label: a.name }))];

  return (
    <Screen title="Dinero" back={false} right={<Button title="Cuenta" icon="add" size="compact" onPress={() => router.push("/account/new" as never)} />}>
      <View style={{ backgroundColor: colors.primarySurface, borderRadius: 24, padding: 18, overflow: "hidden", gap: 4 }}>
        <View style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.10)" }} />
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Saldo total</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onPrimary, fontSize: 32, fontFamily: "AsapBold" }}>{s ? formatSoles(s.balance.net) : "…"}</Text>
        <Text style={{ color: colors.onPrimaryMuted, fontSize: 12, fontFamily: "Asap" }}>{list.length} {list.length === 1 ? "cuenta" : "cuentas"} · lo que debes en tarjetas ya está descontado</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <LinkTile icon="people-outline" title="Préstamos" text="entre personas" onPress={() => router.push("/loans" as never)} />
        <LinkTile icon="business-outline" title="Préstamos" text="bancarios" onPress={() => router.push("/bank-loans" as never)} />
        <LinkTile icon="bar-chart-outline" title="Resumen" text="del mes" onPress={() => router.push("/reports" as never)} />
      </View>

      <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold", marginTop: 4 }}>Mis cuentas</Text>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : list.length === 0 ? (
        <Empty icon="wallet-outline" title="Aún no tienes cuentas" text="Crea tu primera cuenta con su saldo actual. No cuenta como ingreso del mes." action={<Button title="Crear cuenta" icon="add" onPress={() => router.push("/account/new" as never)} />} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + CARD_GAP} decelerationRate="fast" style={{ marginHorizontal: -24, marginTop: -4 }} contentContainerStyle={{ paddingHorizontal: 24, gap: CARD_GAP }}>
          {list.map((a: Account) => <AccountCard key={a.id} width={cardW} account={a} onPress={() => router.push(`/account/${a.id}` as never)} />)}
          <TouchableOpacity onPress={() => router.push("/account/new" as never)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Nueva cuenta"
            style={{ width: 130, height: CARD_H, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted, alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Ionicons name="add" size={26} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontFamily: "AsapBold" }}>Nueva cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold", marginTop: 4 }}>Movimientos</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: -6 }}>
        {KINDS.map(([k, label]) => <FilterChip key={label} label={label} active={kind === k} onPress={() => setKind(k)} />)}
      </View>
      {list.length > 1 && (
        <View style={{ marginTop: -6, marginBottom: -12 }}>
          <SelectField value={accountId ?? "all"} options={accountOptions} onChange={(v) => setAccountId(v === "all" ? undefined : v)} />
        </View>
      )}
      {ops.loading && !ops.data ? <Loading /> : ops.error ? <ErrorBox message={ops.error} onRetry={ops.reload} /> : items.length === 0 ? (
        <Empty icon="swap-vertical-outline" title="Sin movimientos" text="Aquí verás tus ingresos, gastos y transferencias." action={<Button title="Registrar movimiento" icon="add" onPress={() => router.push("/operation/new" as never)} />} />
      ) : (
        <View style={{ marginTop: -6 }}>
          {items.map((o, i) => <OperationRow key={o.id} op={o} first={i === 0} onPress={() => router.push(`/operation/${o.id}` as never)} />)}
        </View>
      )}
      {moreError && <ErrorBox message={moreError} onRetry={loadMore} />}
      {cursor && <Button title="Ver más movimientos" variant="secondary" size="compact" busy={loadingMore} onPress={loadMore} />}
    </Screen>
  );
}

/** Tarjeta de una cuenta, con aspecto de tarjeta bancaria: bancos en violeta, efectivo y billeteras en naranja, tarjetas de crédito en neutro con la deuda en rojo. */
function AccountCard({ account: a, width, onPress }: { account: Account; width: number; onPress: () => void }) {
  const { colors } = useAppTheme();
  const credit = a.type === "credit";
  const wallet = a.type === "cash" || a.type === "wallet";
  const bg = credit ? colors.card : wallet ? colors.accent : colors.primarySurface;
  const ink = credit ? colors.text : wallet ? colors.onAccent : colors.onPrimary;
  const soft = credit ? colors.textSecondary : wallet ? colors.onAccent : colors.onPrimaryMuted;
  const owes = cmpMoney(a.balance, "0.00") < 0;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${a.name}, ${formatSoles(a.balance)}`}
      style={{ width, height: CARD_H, borderRadius: 22, padding: 16, overflow: "hidden", justifyContent: "space-between", backgroundColor: bg, borderWidth: credit ? 1 : 0, borderColor: colors.borderStrong }}>
      <View style={{ position: "absolute", top: -34, right: -26, width: 120, height: 120, borderRadius: 60, backgroundColor: credit ? `${colors.text}08` : "rgba(255,255,255,0.12)" }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Ionicons name={ICON[a.type] ?? "wallet"} size={22} color={ink} />
        <Text numberOfLines={1} style={{ color: soft, fontSize: 12, fontFamily: "AsapMedium", maxWidth: "60%" }}>{credit ? "Tarjeta de crédito" : a.institution ?? "Saldo disponible"}</Text>
      </View>
      <View>
        <Text numberOfLines={1} style={{ color: soft, fontSize: 12, fontFamily: "AsapMedium" }}>{a.name}{credit ? " · deuda" : ""}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: credit && owes ? colors.expenseStrong : ink, fontSize: 24, fontFamily: "AsapBold" }}>{formatSoles(a.balance)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function LinkTile({ icon, title, text, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${title} ${text}`}
      style={{ flex: 1, gap: 6, padding: 12, borderRadius: 18, backgroundColor: colors.sections.money.tint }}>
      <Ionicons name={icon} size={20} color={colors.sections.money.ink} />
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
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: 99, backgroundColor: active ? colors.primarySurface : `${colors.primary}12` }}>
      <Txt size={12} bold color={active ? colors.onPrimary : colors.primary}>{label}</Txt>
    </TouchableOpacity>
  );
}

function OperationRow({ op, first, onPress }: { op: OperationItem; first: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const reversed = op.status === "reversed";
  const tone = op.kind === "income" ? "income" : op.kind === "expense" ? "expense" : "muted";
  const bar = op.kind === "income" ? colors.income : op.kind === "expense" ? colors.expense : colors.muted;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, opacity: reversed ? 0.55 : 1 }}>
      <View style={{ alignSelf: "stretch", width: 4, borderRadius: 2, backgroundColor: bar }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{op.description || "Sin descripción"}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{humanDate(op.occurredOn)}{op.category ? ` · ${op.category.name}` : ""}</Text>
      </View>
      {reversed && <Chip status="reversed" label="Revertido" />}
      <Money value={op.amount} tone={tone} />
    </TouchableOpacity>
  );
}
