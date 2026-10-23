import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type CalendarChangeBody } from "../../api/client";
import type { Interval } from "../../api/types";
import { Choice, DateField, FlowResult, FutureCyclePicker, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, Loading, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { intervalLabel } from "../../utils/intervals";
import { humanDate, isIsoDate } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";

/** Gestión de un servicio: precio, calendario, cambio a individual, plazas y versiones de precio. */
export function ServiceManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const done = useDone();
  const sub = useAsync(() => api.subscription(id), [id]);
  const terms = useAsync(() => api.terms(id), [id]);
  const seats = useAsync(() => api.seats(id), [id]);
  const reload = React.useCallback(() => { void sub.reload(); void terms.reload(); void seats.reload(); }, [sub.reload, terms.reload, seats.reload]);
  useFocusReload(reload);
  const archive = useSubmit(async () => api.archiveSubscription(id));

  if (sub.loading && !sub.data) return <Screen title="Gestionar servicio"><Loading /></Screen>;
  if (sub.error || !sub.data) return <Screen title="Gestionar servicio"><ErrorBox message={sub.error ?? "No se encontró el servicio."} onRetry={sub.reload} /></Screen>;
  const s = sub.data;
  const suspended = s.status === "suspended";

  return (
    <Screen title={s.name} subtitle="Gestionar servicio">
      <Card>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <Chip status={suspended ? "overdue" : "paid"} label={suspended ? "Suspendido" : s.status === "archived" ? "Archivado" : "Activo"} />
          <Chip status="exempt" label={s.mode === "shared" ? "Compartido" : "Personal"} />
        </View>
        {s.terms && <Txt size={13} muted>{formatSoles(s.terms.announcedPrice)} · {intervalLabel(s.terms.interval)} · renueva el día {s.terms.anchor.slice(8)}</Txt>}
        <Txt size={13} muted>{s.occupiedSeats}/{s.capacity} plazas ocupadas</Txt>
      </Card>

      <View style={{ gap: 10 }}>
        <Button title="Cambiar precio del proveedor" icon="pricetag-outline" onPress={() => router.push(`/service/${id}/price` as never)} disabled={suspended || s.status === "archived"} />
        <Button title={suspended ? "Reactivar o ver calendario" : "Calendario: desplazar, suspender…"} variant="secondary" icon="calendar-outline" onPress={() => router.push(`/service/${id}/calendar` as never)} disabled={s.status === "archived"} />
        {s.mode === "shared" && <Button title="Pasar a individual" variant="secondary" icon="person-outline" onPress={() => router.push(`/service/${id}/individual` as never)} disabled={suspended || s.status === "archived"} />}
        {s.mode === "shared" && <Button title="Incorporar participante" variant="secondary" icon="person-add-outline" onPress={() => router.push({ pathname: "/service/join", params: { id } })} disabled={suspended || s.status === "archived"} />}
      </View>

      {s.mode === "shared" && (
        <>
          <Heading>Plazas</Heading>
          {(seats.data ?? []).map((x) => (
            <RowLink key={x.id} onPress={() => router.push(`/seat/${x.id}` as never)}>
              <View style={{ flex: 1 }}>
                <Txt bold>{x.contact?.name ?? "Tú"} · {x.label}</Txt>
                <Txt size={12} muted>Cuota {formatSoles(x.quota)}{x.endDate ? ` · termina el ${humanDate(x.endDate)}` : ""}</Txt>
              </View>
              {x.overdue ? <Chip status="overdue" /> : cmpMoney(x.pending, "0.00") > 0 ? <Txt bold size={13}>{formatSoles(x.pending)}</Txt> : <Chip status="paid" label="Al día" />}
            </RowLink>
          ))}
        </>
      )}

      <Heading>Versiones de precio</Heading>
      {(terms.data ?? []).map((t) => (
        <Card key={t.id} outlined>
          <Txt bold size={14}>{formatSoles(t.announcedPrice)} · {intervalLabel(t.interval)}</Txt>
          <Txt size={12} muted>Desde {humanDate(t.validFrom)}{t.validTo ? ` hasta ${humanDate(t.validTo)}` : " (vigente)"}{t.reason ? ` · ${t.reason}` : ""}</Txt>
        </Card>
      ))}

      {s.status !== "archived" && (
        <>
          <Heading>Archivar</Heading>
          <Button title="Archivar servicio" variant="danger" icon="archive-outline" busy={archive.busy} onPress={async () => { if (await archive.submit()) done("/planning"); }} />
          <Txt size={12} muted>No se archiva con plazas activas de terceros: primero da de baja a cada participante.</Txt>
          {archive.error && <Notice tone="err">{archive.error}</Notice>}
        </>
      )}
    </Screen>
  );
}

/** Cambio de precio del proveedor: propuesta de cuotas; solo cambian las que el administrador escribe. */
export function ServicePriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const sub = useAsync(() => api.subscription(id), [id]);
  const seats = useAsync(() => api.seats(id), [id]);
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [mode, setMode] = useState<"per_renewal" | "lump">("per_renewal");
  const [reason, setReason] = useState("");
  const [quotas, setQuotas] = useState<Record<string, string>>({});

  const quotaList = () => Object.entries(quotas).map(([seatId, q]) => ({ seatId, quota: normalizeMoneyInput(q) })).filter((x): x is { seatId: string; quota: string } => !!x.quota);
  const body = () => ({ newPrice: normalizeMoneyInput(price)!, effectiveFrom: from!, mode, reason: reason.trim(), quotas: quotaList() });
  const flow = usePreviewFlow({
    preview: () => api.previewPriceChange(id, body()),
    apply: (token, key) => api.changePrice(id, { ...body(), previewToken: token }, key),
  });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  const ready = !!normalizeMoneyInput(price) && !!from && reason.trim().length > 0;
  const others = (seats.data ?? []).filter((x) => !x.isOwner && !x.endDate);

  if (sub.loading && !sub.data) return <Screen title="Cambiar precio"><Loading /></Screen>;
  return (
    <Screen title="Cambiar precio" subtitle={sub.data ? `${sub.data.name} · hoy ${sub.data.terms ? formatSoles(sub.data.terms.announcedPrice) : "—"}` : undefined}
      footer={<PreviewFooter flow={flow} disabled={!ready} previewLabel="Ver propuesta" confirmLabel="Aplicar precio y cuotas" onConfirm={async () => { if (await flow.confirm()) done(`/service/${id}/manage`); }} />}>
      <Card>
        <MoneyField label="Precio nuevo del proveedor" value={price} onChange={touch(setPrice)} placeholder="52.00" />
        <FutureCyclePicker subscriptionId={id} value={from} onChange={touch(setFrom)} />
        <Choice label="Cómo se cobra la diferencia de lo ya emitido" value={mode} onChange={touch(setMode)}
          options={[{ id: "per_renewal", label: "En cada renovación" }, { id: "lump", label: "Todo junto, hoy" }]} />
        <ReasonField value={reason} onChange={touch(setReason)} />
      </Card>

      {others.length > 0 && (
        <>
          <Heading action={flow.data?.suggestedQuota ? <Button title={`Usar ${formatSoles(String(flow.data.suggestedQuota.amount))} en todas`} variant="secondary" onPress={() => { setQuotas(Object.fromEntries(others.map((o) => [o.id, String(flow.data!.suggestedQuota.amount)]))); flow.invalidate(); }} /> : undefined}>Cuotas</Heading>
          <Txt size={12} muted>El precio no cambia cuotas por sí solo. Escribe la cuota nueva solo de quien debe cambiar; el resto conserva la suya.</Txt>
          {others.map((o) => (
            <Card key={o.id} outlined>
              <MoneyField label={`${o.contact?.name ?? ""} · ${o.label} (hoy ${formatSoles(o.quota)})`} value={quotas[o.id] ?? ""} optional onChange={(v) => { setQuotas((q) => ({ ...q, [o.id]: v })); flow.invalidate(); }} placeholder="Sin cambio" />
            </Card>
          ))}
        </>
      )}
      <FlowResult flow={flow} />
    </Screen>
  );
}

const CAL_KINDS = [
  { id: "shift_renewal", label: "Desplazar renovación" }, { id: "advance_renewal", label: "Adelantar renovación" }, { id: "change_interval", label: "Cambiar frecuencia" },
  { id: "suspend", label: "Suspender" }, { id: "reactivate", label: "Reactivar" },
] as const;
type CalKind = (typeof CAL_KINDS)[number]["id"];
const UNITS: Array<{ id: Interval["unit"]; label: string }> = [{ id: "day", label: "Días" }, { id: "week", label: "Semanas" }, { id: "month", label: "Meses" }, { id: "year", label: "Años" }];

/** Cambios de calendario: cada tipo pide exactamente los datos que exige la API. */
export function ServiceCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const sub = useAsync(() => api.subscription(id), [id]);
  const history = useAsync(() => api.calendarChanges(id), [id]);
  const suspended = sub.data?.status === "suspended";
  const [kind, setKind] = useState<CalKind>("shift_renewal");
  const [date, setDate] = useState("");
  const [unit, setUnit] = useState<Interval["unit"]>("month");
  const [count, setCount] = useState("1");
  const [reason, setReason] = useState("");
  const effectiveKind: CalKind = suspended ? "reactivate" : kind === "reactivate" ? "shift_renewal" : kind;

  const body = (): CalendarChangeBody => {
    const r = reason.trim();
    switch (effectiveKind) {
      case "shift_renewal": case "advance_renewal": return { kind: effectiveKind, newDate: date, reason: r };
      case "change_interval": return { kind: "change_interval", interval: { unit, count: Number.parseInt(count, 10) }, reason: r };
      case "suspend": return { kind: "suspend", reason: r };
      case "reactivate": return { kind: "reactivate", renewalDate: date, reason: r };
    }
  };
  const flow = usePreviewFlow({
    preview: () => api.previewCalendarChange(id, body()),
    apply: (token, key) => api.changeCalendar(id, { ...body(), previewToken: token }, key),
  });
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); flow.invalidate(); };
  const n = Number.parseInt(count, 10);
  const needsDate = effectiveKind === "shift_renewal" || effectiveKind === "advance_renewal" || effectiveKind === "reactivate";
  const ready = reason.trim().length > 0 && (!needsDate || isIsoDate(date)) && (effectiveKind !== "change_interval" || (Number.isInteger(n) && n >= 1));

  if (sub.loading && !sub.data) return <Screen title="Calendario"><Loading /></Screen>;
  return (
    <Screen title="Calendario" subtitle={sub.data?.name}
      footer={<PreviewFooter flow={flow} disabled={!ready} confirmLabel="Aplicar cambio" onConfirm={async () => { if (await flow.confirm()) done(`/service/${id}/manage`); }} />}>
      {suspended && <Notice tone="warn">El servicio está suspendido: solo se puede reactivar indicando la fecha de renovación del proveedor.</Notice>}
      <Card>
        {!suspended && <Choice label="Qué cambió" value={effectiveKind} onChange={touch(setKind)} options={CAL_KINDS.filter((k) => k.id !== "reactivate").map((k) => ({ id: k.id, label: k.label }))} />}
        {(effectiveKind === "shift_renewal" || effectiveKind === "advance_renewal") && <DateField label={effectiveKind === "advance_renewal" ? "Nueva fecha de renovación (anterior a la actual)" : "Nueva fecha de renovación"} value={date} onChange={touch(setDate)} />}
        {effectiveKind === "reactivate" && <DateField label="Fecha de renovación del proveedor" value={date} onChange={touch(setDate)} />}
        {effectiveKind === "change_interval" && (
          <>
            <Choice label="Nueva frecuencia (rige desde la próxima renovación)" value={unit} onChange={touch(setUnit)} options={UNITS} />
            <Field label="Cada cuántas unidades" value={count} onChangeText={touch(setCount)} keyboardType="number-pad" />
          </>
        )}
        <ReasonField value={reason} onChange={touch(setReason)} />
      </Card>
      <Notice tone="info">Los importes ya emitidos no cambian: solo se mueven fechas. La suspensión no descuenta cuota y reactivar no cobra los días del hueco.</Notice>
      <FlowResult flow={flow} />

      <Heading>Historial</Heading>
      {(history.data ?? []).length === 0 ? <Card><Txt muted>Sin cambios de calendario.</Txt></Card> : (history.data ?? []).map((c) => (
        <Card key={c.id} outlined>
          <Txt bold size={14}>{CAL_KINDS.find((k) => k.id === c.kind)?.label ?? c.kind}</Txt>
          <Txt size={12} muted>Efectivo {humanDate(c.effectiveOn)}{c.oldCurrentEnd && c.newCurrentEnd ? ` · fin ${humanDate(c.oldCurrentEnd)} → ${humanDate(c.newCurrentEnd)}` : ""}</Txt>
          <Txt size={12} muted>{c.reason}</Txt>
        </Card>
      ))}
    </Screen>
  );
}

/** Compartido → individual (RN-X08). */
export function ServiceIndividualScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const done = useDone();
  const sub = useAsync(() => api.subscription(id), [id]);
  const [reason, setReason] = useState("");
  const flow = usePreviewFlow({
    preview: () => api.previewSwitchToIndividual(id),
    apply: (token, key) => api.switchToIndividual(id, { reason: reason.trim(), previewToken: token }, key),
  });
  return (
    <Screen title="Pasar a individual" subtitle={sub.data?.name}
      footer={<PreviewFooter flow={flow} previewLabel="Ver qué pasará" confirmLabel="Pasar a individual" danger confirmDisabled={reason.trim().length === 0} onConfirm={async () => { if (await flow.confirm()) done(`/service/${id}`); }} />}>
      <Card><ReasonField value={reason} onChange={setReason} /></Card>
      <Notice tone="info">Todas las plazas de otras personas terminan al final del ciclo en curso. Lo que deban pasa a un préstamo y los ciclos futuros ya pagados se devuelven. Desde ahora nadie más puede ingresar.</Notice>
      <FlowResult flow={flow} />
    </Screen>
  );
}
