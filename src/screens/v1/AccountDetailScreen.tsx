import React from "react";
import { View } from "react-native";
import { api } from "../../api/client";
import { useRouter } from "expo-router";
import { Button, Card, Empty, ErrorBox, Heading, Loading, Money, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { cmpMoney } from "../../utils/money";

const KIND: Record<string, string> = { opening: "Saldo inicial", income: "Ingreso", expense: "Gasto", transfer: "Transferencia", adjustment: "Ajuste", reversal: "Reversión" };

export default function AccountDetailScreen({ accountId }: { accountId: string }) {
  const router = useRouter();
  const acc = useAsync(() => api.account(accountId), [accountId]);
  const entries = useAsync(() => api.accountEntries(accountId), [accountId]);
  const reload = React.useCallback(() => { void acc.reload(); void entries.reload(); }, [acc.reload, entries.reload]);
  useFocusReload(reload);

  if (acc.loading && !acc.data) return <Screen title="Cuenta"><Loading /></Screen>;
  if (acc.error || !acc.data) return <Screen title="Cuenta"><ErrorBox message={acc.error ?? "No se encontró la cuenta."} onRetry={acc.reload} /></Screen>;

  return (
    <Screen title={acc.data.name}>
      <Card>
        <Txt muted size={13}>{acc.data.type === "credit" ? "Deuda de la tarjeta" : "Saldo"}</Txt>
        <Money value={acc.data.balance} size={32} tone={cmpMoney(acc.data.balance, "0.00") < 0 ? "expense" : undefined} />
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Nuevo movimiento" icon="add" onPress={() => router.push("/operation/new" as never)} /></View>
        <View style={{ flex: 1 }}><Button title="Editar cuenta" variant="secondary" icon="create-outline" onPress={() => router.push(`/account/${accountId}/edit` as never)} /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {acc.data.type === "credit" && <View style={{ flex: 1 }}><Button title="Tarjeta" variant="secondary" icon="card-outline" onPress={() => router.push(`/account/${accountId}/card` as never)} /></View>}
        <View style={{ flex: 1 }}><Button title="Conciliar saldo" variant="secondary" icon="git-compare-outline" onPress={() => router.push(`/account/${accountId}/reconcile` as never)} /></View>
      </View>
      <Heading>Movimientos</Heading>
      {entries.loading && !entries.data ? <Loading /> : (entries.data?.items ?? []).length === 0 ? (
        <Empty icon="receipt-outline" title="Sin movimientos" text="Aquí verás cada ingreso, gasto y transferencia de esta cuenta." />
      ) : (entries.data?.items ?? []).map((e) => (
        <RowLink key={e.id} onPress={() => router.push(`/operation/${e.operationId}` as never)}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt bold size={14}>{KIND[e.kind] ?? e.kind}{e.operationStatus === "reversed" ? " (revertido)" : ""}</Txt>
              <Txt size={12} muted>{humanDate(e.occurredOn)}{e.description ? ` · ${e.description}` : ""}</Txt>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Money value={e.amount} size={15} tone={cmpMoney(e.amount, "0.00") < 0 ? "expense" : "income"} />
              <Txt size={11} muted>saldo {e.balanceAfter}</Txt>
            </View>
          </View>
        </RowLink>
      ))}
    </Screen>
  );
}
