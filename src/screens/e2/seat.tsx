import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Courtesy } from "../../api/types";
import { Choice, DateField, FlowResult, FutureCyclePicker, Label, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, Loading, Money, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, humanRange, isIsoDate } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";

const KIND_TEXT: Record<Courtesy["kind"], string> = { cycles: "Por número de ciclos", until_date: "Hasta una fecha", permanent: "Permanente" };

/** Plaza: cuota, cargos, cortesías y acciones (cambiar cuota, cortesía, baja). */
export function SeatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const seat = useAsync(() => api.seat(id), [id]);
  const courtesies = useAsync(() => api.courtesies(id), [id]);
  const [refreshing, setRefreshing] = useState(false);
  const reload = React.useCallback(() => { void seat.reload(); void courtesies.reload(); }, [seat.reload, courtesies.reload]);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([seat.reload(), courtesies.reload()]); } finally { setRefreshing(false); }
  }, [seat.reload, courtesies.reload]);
  useFocusReload(reload);
  const end = useSubmit(async (key: string, courtesyId: string) => api.endCourtesy(courtesyId, key));

  if (seat.loading && !seat.data) return <Screen title="Plaza"><Loading /></Screen>;
  if (seat.error || !seat.data) return <Screen title="Plaza"><ErrorBox message={seat.error ?? "No se encontró la plaza."} onRetry={seat.reload} /></Screen>;
  const s = seat.data;
  const ending = !!s.endDate;
  const activeCourtesy = (courtesies.data ?? []).find((c) => c.status === "active");

  return (
    <Screen title={s.label} subtitle={s.contact?.name ?? "Tu plaza"} refreshing={refreshing} onRefresh={onRefresh}>
      {s.isOwner ? (
        <Notice tone="info">Esta es tu plaza como titular del servicio. Tu costo real se calcula con el pago al proveedor menos lo que aportan los demás participantes.</Notice>
      ) : (
        <>
          <Card>
            <Txt muted size={13}>Cuota por ciclo</Txt>
            <Money value={s.quota} size={28} />
            {s.scheduledQuota && <Txt size={12} muted>Desde el {humanDate(s.scheduledQuota.from)}: {formatSoles(s.scheduledQuota.quota)}</Txt>}
            <Txt size={12} muted style={{ marginTop: 6 }}>Ingresó el {humanDate(s.startDate)}{ending ? ` · termina el ${humanDate(s.endDate!)}` : ""}</Txt>
          </Card>

          <View style={{ gap: 10 }}>
            <Button title="Registrar cobro" icon="cash-outline" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId: s.contact!.id } })} />
            <Button title="Cambiar cuota" variant="secondary" icon="swap-vertical-outline" onPress={() => router.push(`/seat/${id}/quota` as never)} disabled={ending} />
            <Button title="Dar cortesía" variant="secondary" icon="gift-outline" onPress={() => router.push(`/seat/${id}/courtesy` as never)} disabled={ending || !!activeCourtesy} />
            <Button title="Dar de baja" variant="danger" icon="exit-outline" onPress={() => router.push(`/seat/${id}/exit` as never)} disabled={ending} />
            {s.contact && <Button title="Ver contacto" variant="secondary" icon="person-outline" onPress={() => router.push(`/contact/${s.contact!.id}` as never)} />}
          </View>

          <Heading>Cortesías</Heading>
          {(courtesies.data ?? []).length === 0 ? <Card><Txt muted>Sin cortesías.</Txt></Card> : (courtesies.data ?? []).map((c) => (
            <Card key={c.id} outlined>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt bold size={14}>{KIND_TEXT[c.kind]}</Txt>
                  <Txt size={12} muted>Desde {humanDate(c.startsOn)}{c.untilDate ? ` hasta ${humanDate(c.untilDate)}` : ""}{c.cyclesTotal ? ` · ${c.cyclesUsed}/${c.cyclesTotal} ciclos` : ""}</Txt>
                  <Txt size={12} muted>{c.reason}</Txt>
                </View>
                <Chip status={c.status === "active" ? "exempt" : "converted"} label={c.status === "active" ? "Vigente" : "Terminada"} />
              </View>
              {c.status === "active" && <View style={{ marginTop: 8 }}><Button title="Terminar cortesía" variant="secondary" busy={end.busy} onPress={async () => { if (await end.submit(c.id)) void reload(); }} /></View>}
            </Card>
          ))}
          {end.error && <Notice tone="err">{end.error}</Notice>}

          <Heading>Cargos</Heading>
          {s.charges.length === 0 ? <Card><Txt muted>Sin cargos todavía.</Txt></Card> : s.charges.map((c) => (
            <Card key={c.obligationId} outlined>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt bold size={14}>{humanRange(c.cycle.start, c.cycle.end)}</Txt>
                  <Txt size={12} muted>Vence {humanDate(c.dueDate)} · cargo {formatSoles(c.net)}{cmpMoney(c.adjustments, "0.00") !== 0 ? ` · ajustes ${formatSoles(c.adjustments)}` : ""}{cmpMoney(c.applied, "0.00") > 0 ? ` · pagado ${formatSoles(c.applied)}` : ""}</Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {c.overdue ? <Chip status="overdue" /> : <Chip status={c.paymentStatus} />}
                  <Money value={c.pending} size={14} />
                </View>
              </View>
            </Card>
          ))}
          {(s.voidedCharges ?? []).length > 0 && (
            <>
              <Heading>Cargos cancelados</Heading>
              {s.voidedCharges.map((v) => (
                <Card key={v.obligationId} outlined><Txt size={13}>{humanRange(v.cycle.start, v.cycle.end)} · {formatSoles(v.gross)}</Txt><Txt size={12} muted>{v.reason}</Txt></Card>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** Cambio de cuota: nueva cuota desde el inicio de un ciclo futuro, y cómo se cobra la diferencia. */
export function SeatQuotaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seat = useAsync(() => api.seat(id), [id]);
  const done = useDone();
  const [quota, setQuota] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [mode, setMode] = useState<"per_renewal" | "lump">("per_renewal");
  const [reason, setReason] = useState("");
  const body = () => ({ newQuota: normalizeMoneyInput(quota)!, effectiveFrom: from!, mode, reason: reason.trim() });
  const flow = usePreviewFlow({
    preview: () => api.previewQuotaChange(id, body()),
    apply: (token, key) => api.changeQuota(id, { ...body(), previewToken: token }, key),
  });
  const ready = !!normalizeMoneyInput(quota) && !!from && reason.trim().length > 0;
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };

  if (seat.loading && !seat.data) return <Screen title="Cambiar cuota"><Loading /></Screen>;
  if (seat.error || !seat.data) return <Screen title="Cambiar cuota"><ErrorBox message={seat.error ?? "No se encontró la plaza."} onRetry={seat.reload} /></Screen>;
  return (
    <Screen title="Cambiar cuota" subtitle={`${seat.data.label} · ahora ${formatSoles(seat.data.quota)}`}
      footer={<PreviewFooter flow={flow} disabled={!ready} confirmLabel="Aplicar cambio de cuota" onConfirm={async () => { if (await flow.confirm()) done(`/seat/${id}`); }} />}>
      <Card>
        <MoneyField label="Cuota nueva por ciclo" value={quota} onChange={touch(setQuota)} placeholder="13.00" />
        <FutureCyclePicker subscriptionId={seat.data.subscriptionId} value={from} onChange={touch(setFrom)} />
        <Choice label="Cómo se cobra la diferencia de lo ya emitido" value={mode} onChange={touch(setMode)}
          options={[
            { id: "per_renewal", label: "En cada renovación", hint: "Se ajusta cada ciclo al renovarse" },
            { id: "lump", label: "Todo junto, hoy", hint: "Se cobra la diferencia de una vez" },
          ]} />
        <ReasonField value={reason} onChange={touch(setReason)} />
      </Card>
      <Notice tone="info">La cuota nueva rige desde el inicio del ciclo elegido. A los cargos ya emitidos desde esa fecha se les crea un ajuste por la diferencia; si la cuota baja y ya estaba cobrada, el exceso vuelve como crédito libre.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}

/** Cortesía: por ciclos, hasta una fecha o permanente; desde el siguiente ciclo. */
export function SeatCourtesyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const [kind, setKind] = useState<"cycles" | "until_date" | "permanent">("cycles");
  const [cycles, setCycles] = useState("1");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [debt, setDebt] = useState<"keep" | "convert" | null>(null);
  const body = () => ({
    kind, reason: reason.trim(),
    ...(kind === "cycles" ? { cycles: Number.parseInt(cycles, 10) } : {}),
    ...(kind === "until_date" ? { untilDate: until } : {}),
    ...(debt ? { debtHandling: debt } : {}),
  });
  const flow = usePreviewFlow({
    preview: () => api.previewCourtesy(id, body()),
    apply: (_token, key) => api.createCourtesy(id, body(), key),
    requireToken: false,
  });
  const n = Number.parseInt(cycles, 10);
  const ready = reason.trim().length > 0 && (kind !== "cycles" || (Number.isInteger(n) && n >= 1)) && (kind !== "until_date" || isIsoDate(until));
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDebt(null); flow.invalidate(); };
  const needsChoice = !!flow.data?.debtChoiceRequired && !debt;

  return (
    <Screen title="Dar cortesía" subtitle="Exime la cuota sin subirle el precio a los demás"
      footer={needsChoice
        ? <Notice tone="warn">Elige qué hacer con la deuda anterior para continuar.</Notice>
        : <PreviewFooter flow={flow} disabled={!ready} confirmLabel="Crear cortesía" onConfirm={async () => { if (await flow.confirm()) done(`/seat/${id}`); }} />}>
      <Card>
        <Choice label="Duración" value={kind} onChange={touch(setKind)}
          options={[{ id: "cycles", label: "Por ciclos" }, { id: "until_date", label: "Hasta una fecha" }, { id: "permanent", label: "Permanente" }]} />
        {kind === "cycles" && <Field label="Cantidad de ciclos" value={cycles} onChangeText={touch(setCycles)} keyboardType="number-pad" />}
        {kind === "until_date" && <DateField label="Hasta (inclusive)" value={until} onChange={touch(setUntil)} />}
        <ReasonField value={reason} onChange={touch(setReason)} />
      </Card>
      {flow.data?.debtChoiceRequired && (
        <Card>
          <Label>La persona ya debe {formatSoles(String(flow.data.existingDebt))} en esta plaza</Label>
          <Choice value={debt} onChange={setDebt}
            options={[{ id: "keep", label: "Mantener la deuda en el servicio" }, { id: "convert", label: "Convertirla en préstamo" }]} />
        </Card>
      )}
      <Notice tone="info">La cortesía empieza en el siguiente ciclo: el ciclo en curso se sigue cobrando. Los cargos quedan en S/ 0.00 con una exención igual al cobro. Su costo no se reparte entre los demás.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}

/** Baja de una plaza: la vista previa dice si termina el ciclo o es inmediata, qué se devuelve y qué pasa con la deuda. */
export function SeatExitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const [reason, setReason] = useState("");
  const flow = usePreviewFlow({
    preview: () => api.previewExit(id),
    apply: (token, key) => api.exitSeat(id, { reason: reason.trim(), previewToken: token }, key),
  });
  return (
    <Screen title="Dar de baja"
      footer={<PreviewFooter flow={flow} previewLabel="Ver qué pasará" confirmLabel="Confirmar baja" danger confirmDisabled={reason.trim().length === 0} onConfirm={async () => { if (await flow.confirm()) done(`/seat/${id}`); }} />}>
      <Card>
        <ReasonField value={reason} onChange={(v) => setReason(v)} label="Motivo de la baja" />
        {flow.canConfirm && reason.trim().length === 0 && <Notice tone="warn">Escribe el motivo para poder confirmar.</Notice>}
      </Card>
      <Notice tone="info">Si el ciclo ya está pagado al proveedor, o la persona lleva el mínimo de días configurado en tus ajustes, termina el ciclo sin devolución del período actual. Si no, la baja es inmediata con cobro proporcional. Los ciclos futuros pagados se devuelven y lo que deba pasa a un préstamo.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}
