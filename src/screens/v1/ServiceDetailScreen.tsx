import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { Button, Card, Chip, Empty, ErrorBox, Heading, KV, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, humanRange } from "../../utils/dates";
import { cmpMoney } from "../../utils/money";

export default function ServiceDetailScreen({ serviceId }: { serviceId: string }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const sub = useAsync(() => api.subscription(serviceId), [serviceId]);
  const seats = useAsync(() => api.seats(serviceId), [serviceId]);
  const cycleId = sub.data?.currentCycle?.id;
  const cycle = useAsync(async () => (cycleId ? api.cycle(cycleId) : null), [cycleId]);
  const reload = React.useCallback(() => { void sub.reload(); void seats.reload(); void cycle.reload(); }, [sub.reload, seats.reload, cycle.reload]);
  useFocusReload(reload);

  const advance = useSubmit(async (key: string) => { await api.generateAhead(serviceId, 1, key); reload(); });

  if (sub.loading && !sub.data) return <Screen title="Servicio"><Loading /></Screen>;
  if (sub.error || !sub.data) return <Screen title="Servicio"><ErrorBox message={sub.error ?? "No se encontró el servicio."} onRetry={sub.reload} /></Screen>;
  const s = sub.data;
  const c = cycle.data;
  const full = s.mode === "shared" && s.occupiedSeats >= s.capacity;
  const payment = c?.supplierPayment ?? null;

  return (
    <Screen title={s.name}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Txt muted size={13}>Ciclo actual</Txt>
            <Txt bold size={17}>{s.currentCycle ? humanRange(s.currentCycle.startDate, s.currentCycle.endDate) : "—"}</Txt>
          </View>
          {s.mode === "shared" && <Chip status={full ? "paid" : "unpaid"} label={`${s.occupiedSeats} / ${s.capacity} plazas`} />}
        </View>
        <Txt size={12} muted style={{ marginTop: 6 }}>Próxima renovación: {humanDate(s.currentCycle?.endDate)} · Precio anunciado <Text style={{ fontFamily: "AsapBold" }}>S/ {s.terms?.announcedPrice}</Text></Txt>
      </Card>

      <Heading>Pago al proveedor</Heading>
      <Card outlined>
        <KV label="Anunciado" value={`S/ ${c?.announcedPrice ?? s.terms?.announcedPrice ?? "—"}`} />
        {payment ? (
          <>
            <KV label={`Pagado el ${humanDate(payment.paidOn)}`} value={`S/ ${payment.amount}`} strong />
            <View style={{ marginTop: 8 }}><Notice tone="info">Se pagó el {humanDate(payment.paidOn)}, pero la renovación sigue el {humanDate(s.currentCycle?.endDate)}. El calendario no se mueve.</Notice></View>
          </>
        ) : (
          <View style={{ marginTop: 10 }}>
            <Button title="Registrar pago al proveedor" variant="secondary" icon="card-outline" onPress={() => router.push({ pathname: "/service/pay", params: { cycleId: c?.id ?? "", serviceId, announced: s.terms?.announcedPrice ?? "" } })} disabled={!c} />
          </View>
        )}
      </Card>

      {c && (
        <>
          <Heading>Costo propio de este ciclo</Heading>
          <Card outlined>
            <KV label="Cuotas exigibles de otros" value={`S/ ${c.costSummary.expectedFromOthers}`} />
            <KV label="Cobrado hasta hoy" value={`S/ ${c.costSummary.receivedFromOthers}`} />
            <KV label="Pendiente de cobrar" value={`S/ ${c.costSummary.pendingFromOthers}`} color={cmpMoney(c.costSummary.pendingFromOthers, "0.00") > 0 ? colors.expenseStrong : undefined} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Card style={{ flex: 1 }}><Txt size={12} muted>Costo previsto</Txt><Money value={c.costSummary.projectedCost} size={18} /><Txt size={11} muted>{c.costSummary.estimated ? "Estimado con el precio anunciado" : "Pago − cuotas exigibles"}</Txt></Card>
              <Card style={{ flex: 1 }}><Txt size={12} muted>Según cobros</Txt><Money value={c.costSummary.costByCollections} size={18} /><Txt size={11} muted>Pago − cobrado</Txt></Card>
            </View>
            {cmpMoney(c.costSummary.surplus, "0.00") > 0 && <View style={{ marginTop: 8 }}><Notice tone="ok">Las cuotas superan el costo: excedente de S/ {c.costSummary.surplus}.</Notice></View>}
          </Card>
        </>
      )}

      {s.mode === "shared" && (
        <>
          <Heading>Participantes</Heading>
          {seats.loading && !seats.data ? <Loading /> : (seats.data ?? []).length <= 1 ? (
            <Empty icon="people-outline" title="Aún no hay participantes" text="Agrega a quien comparte este plan. Tu plaza no genera cobro." />
          ) : null}
          {(seats.data ?? []).map((st) => (
            <RowLink key={st.id} onPress={() => st.contact && router.push(`/contact/${st.contact.id}`)}>
              <View style={{ flex: 1 }}>
                <Txt bold>{st.isOwner ? "Tú" : st.contact?.name}</Txt>
                <Txt size={12} muted>{st.label}{st.isOwner ? " · sin cargo" : ` · cuota S/ ${st.quota}`}</Txt>
              </View>
              {!st.isOwner && (cmpMoney(st.pending, "0.00") > 0 ? <Chip status={st.overdue ? "overdue" : "unpaid"} label={`Debe S/ ${st.pending}`} /> : <Chip status="paid" />)}
            </RowLink>
          ))}
          <Button title="Incorporar participante" icon="person-add-outline" onPress={() => router.push({ pathname: "/service/join", params: { id: serviceId } })} disabled={full} />
          {full && <Notice tone="warn">No quedan plazas libres hoy.</Notice>}
          <Button title="Emitir el siguiente ciclo por adelantado" variant="secondary" onPress={() => void advance.submit()} busy={advance.busy} />
          {advance.error && <Notice tone="err">{advance.error}</Notice>}
          <Txt size={12} muted>Úsalo cuando alguien paga por adelantado: se emiten ahora los cargos del próximo ciclo para poder aplicarles ese pago.</Txt>
        </>
      )}
    </Screen>
  );
}
