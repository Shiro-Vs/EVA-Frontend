import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { api, errorMessage } from "../../api/client";
import type { AccountEntry } from "../../api/types";
import { useRouter } from "expo-router";
import { Button, Card, Empty, ErrorBox, Heading, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const KIND: Record<string, string> = { opening: "Saldo inicial", income: "Ingreso", expense: "Gasto", transfer: "Transferencia", adjustment: "Ajuste", reversal: "Reversión" };

export default function AccountDetailScreen({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [more, setMore] = useState<AccountEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const acc = useAsync(() => api.account(accountId), [accountId]);
  const entries = useAsync(async () => {
    const r = await api.accountEntries(accountId);
    setMore([]);
    setCursor(r.nextCursor);
    setMoreError(null);
    return r.items;
  }, [accountId]);

  const reload = useCallback(() => { void acc.reload(); void entries.reload(); }, [acc.reload, entries.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([acc.reload(), entries.reload()]); } finally { setRefreshing(false); }
  }, [acc.reload, entries.reload]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const r = await api.accountEntries(accountId, cursor);
      setMore((m) => [...m, ...r.items]);
      setCursor(r.nextCursor);
    } catch (e) {
      setMoreError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  if (acc.loading && !acc.data) return <Screen title="Cuenta"><Loading /></Screen>;
  if (acc.error || !acc.data) return <Screen title="Cuenta"><ErrorBox message={acc.error ?? "No se encontró la cuenta."} onRetry={acc.reload} /></Screen>;

  const a = acc.data;
  const isCredit = a.type === "credit";
  const isArchived = a.status === "archived";
  const balCmp = cmpMoney(a.balance, "0.00");
  const displayAmount = isCredit && balCmp < 0 ? a.balance.replace("-", "") : a.balance;
  const balanceLabel = isCredit ? (balCmp > 0 ? "Saldo a favor en la tarjeta" : "Deuda de la tarjeta") : "Saldo";
  const balanceTone = balCmp < 0 ? "expense" : isCredit && balCmp > 0 ? "income" : undefined;
  const allEntries = [...(entries.data ?? []), ...more];

  const formatRunning = (val: string) => {
    const c = cmpMoney(val, "0.00");
    if (isCredit) {
      if (c < 0) return `deuda ${formatSoles(val.replace("-", ""))}`;
      if (c > 0) return `a favor ${formatSoles(val)}`;
      return "deuda S/ 0.00";
    }
    return `saldo ${formatSoles(val)}`;
  };

  return (
    <Screen title={a.name} refreshing={refreshing} onRefresh={onRefresh}>
      <Card>
        <Txt muted size={13}>{balanceLabel}</Txt>
        <Money value={displayAmount} size={32} tone={balanceTone} />
      </Card>

      {isArchived ? (
        <>
          <Notice tone="info">Esta cuenta está archivada. Restáurala desde Editar cuenta para volver a registrar movimientos o conciliar.</Notice>
          <Button title="Editar o restaurar cuenta" variant="secondary" icon="create-outline" onPress={() => router.push(`/account/${accountId}/edit` as never)} />
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Nuevo movimiento" icon="add" onPress={() => router.push({ pathname: "/operation/new", params: { accountId } } as never)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Editar cuenta" variant="secondary" icon="create-outline" onPress={() => router.push(`/account/${accountId}/edit` as never)} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {isCredit && (
              <View style={{ flex: 1 }}>
                <Button title="Tarjeta" variant="secondary" icon="card-outline" onPress={() => router.push(`/account/${accountId}/card` as never)} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button title="Conciliar saldo" variant="secondary" icon="git-compare-outline" onPress={() => router.push(`/account/${accountId}/reconcile` as never)} />
            </View>
          </View>
          {isCredit && balCmp < 0 && (
            <Button
              title="Pagar tarjeta (transferencia)"
              variant="secondary"
              icon="swap-horizontal-outline"
              onPress={() => router.push({ pathname: "/operation/new", params: { kind: "transfer", toAccountId: accountId } } as never)}
            />
          )}
        </>
      )}

      <Heading>Movimientos</Heading>
      {entries.loading && !entries.data ? <Loading /> : entries.error ? <ErrorBox message={entries.error} onRetry={entries.reload} /> : allEntries.length === 0 ? (
        <Empty icon="receipt-outline" title="Sin movimientos" text="Aquí verás cada ingreso, gasto y transferencia de esta cuenta." />
      ) : allEntries.map((e) => (
        <RowLink key={e.id} onPress={() => router.push(`/operation/${e.operationId}` as never)}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt bold size={14}>{KIND[e.kind] ?? e.kind}{e.operationStatus === "reversed" ? " (revertido)" : ""}</Txt>
              <Txt size={12} muted>{humanDate(e.occurredOn)}{e.description ? ` · ${e.description}` : ""}</Txt>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Money value={e.amount} size={15} tone={cmpMoney(e.amount, "0.00") < 0 ? "expense" : "income"} />
              <Txt size={11} muted>{formatRunning(e.balanceAfter)}</Txt>
            </View>
          </View>
        </RowLink>
      ))}
      {moreError && <ErrorBox message={moreError} onRetry={loadMore} />}
      {cursor && <Button title="Ver más movimientos" variant="secondary" size="compact" busy={loadingMore} onPress={loadMore} />}
    </Screen>
  );
}
