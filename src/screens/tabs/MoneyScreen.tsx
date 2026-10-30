import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Account, OperationItem } from "../../api/types";
import { Button, Card, Chip, Empty, ErrorBox, Heading, Loading, MenuRow, Money, RowLink, Screen, SeeAll, SummaryTile, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { bank: "business", savings: "save", cash: "cash", wallet: "phone-portrait", credit: "card" };
const KINDS: Array<[string | undefined, string]> = [[undefined, "Todos"], ["income", "Ingresos"], ["expense", "Gastos"], ["transfer", "Transferencias"]];
const PAGE = 15;

/** Pestaña Dinero: tus cuentas, tus movimientos y lo que debes o te deben en préstamos. */
export default function MoneyScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
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

  return (
    <Screen title="Dinero" back={false} subtitle="Cuentas y movimientos" right={<Button title="Nueva" variant="secondary" icon="add" onPress={() => router.push("/account/new" as never)} />}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SummaryTile label="Saldo total" icon="wallet-outline" value={s ? formatSoles(s.balance.net) : "…"} />
        <SummaryTile label="Cuentas" icon="albums-outline" value={String(list.length)} />
      </View>

      <Heading>Mis cuentas</Heading>
      {accounts.loading && !accounts.data ? <Loading /> : accounts.error ? <ErrorBox message={accounts.error} onRetry={accounts.reload} /> : list.length === 0 ? (
        <Empty icon="wallet-outline" title="Aún no tienes cuentas" text="Crea tu primera cuenta con su saldo actual. No cuenta como ingreso del mes." action={<Button title="Crear cuenta" icon="add" onPress={() => router.push("/account/new" as never)} />} />
      ) : list.map((a: Account) => (
        <RowLink key={a.id} onPress={() => router.push(`/account/${a.id}` as never)}>
          <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}15` }}>
            <Ionicons name={ICON[a.type] ?? "wallet"} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold>{a.name}</Txt>
            <Txt size={12} muted>{a.type === "credit" ? "Deuda de la tarjeta" : a.institution ?? "Saldo disponible"}</Txt>
          </View>
          <Money value={a.balance} tone={cmpMoney(a.balance, "0.00") < 0 ? "expense" : undefined} />
        </RowLink>
      ))}

      <Heading action={<SeeAll label="Resumen del mes" onPress={() => router.push("/reports" as never)} />}>Movimientos</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {KINDS.map(([k, label]) => <FilterChip key={label} label={label} active={kind === k} onPress={() => setKind(k)} />)}
      </View>
      {list.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <FilterChip label="Todas las cuentas" active={!accountId} onPress={() => setAccountId(undefined)} />
          {list.map((a) => <FilterChip key={a.id} label={a.name} active={accountId === a.id} onPress={() => setAccountId(a.id)} />)}
        </View>
      )}
      {ops.loading && !ops.data ? <Loading /> : ops.error ? <ErrorBox message={ops.error} onRetry={ops.reload} /> : items.length === 0 ? (
        <Empty icon="swap-vertical-outline" title="Sin movimientos" text="Aquí verás tus ingresos, gastos y transferencias." action={<Button title="Registrar movimiento" icon="add" onPress={() => router.push("/operation/new" as never)} />} />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {items.map((o, i) => <OperationRow key={o.id} op={o} first={i === 0} onPress={() => router.push(`/operation/${o.id}` as never)} />)}
        </Card>
      )}
      {moreError && <ErrorBox message={moreError} onRetry={loadMore} />}
      {cursor && <Button title="Ver más movimientos" variant="secondary" busy={loadingMore} onPress={loadMore} />}

      <Heading>Préstamos</Heading>
      <MenuRow icon="people-outline" title="Entre personas" text="Lo que prestaste o te prestaron, con sus cuotas" onPress={() => router.push("/loans" as never)} />
      <MenuRow icon="business-outline" title="Préstamos bancarios" text="Cronograma, pagos y documentos del banco" onPress={() => router.push("/bank-loans" as never)} />
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: active ? colors.primarySurface : `${colors.primary}12` }}>
      <Txt size={12} bold color={active ? colors.onPrimary : colors.primary}>{label}</Txt>
    </TouchableOpacity>
  );
}

function OperationRow({ op, first, onPress }: { op: OperationItem; first: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const reversed = op.status === "reversed";
  const tone = op.kind === "income" ? "income" : op.kind === "expense" ? "expense" : "muted";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: first ? 0 : 1, borderTopColor: `${colors.text}08`, opacity: reversed ? 0.55 : 1 }}>
      <View style={{ flex: 1 }}>
        <Txt bold numberOfLines={1}>{op.description || "Sin descripción"}</Txt>
        <Txt size={12} muted>{humanDate(op.occurredOn)}{op.category ? ` · ${op.category.name}` : ""}</Txt>
      </View>
      {reversed && <Chip status="reversed" label="Revertido" />}
      <Money value={op.amount} tone={tone} />
    </TouchableOpacity>
  );
}
