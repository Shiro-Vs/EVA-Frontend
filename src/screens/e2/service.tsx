import React, { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type CalendarChangeBody } from "../../api/client";
import type { DeleteSubscriptionPreview, Interval } from "../../api/types";
import BottomSheet from "../../components/common/BottomSheet";
import { Choice, DateField, FlowResult, FutureCyclePicker, MoneyField, PreviewFooter, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, ErrorBox, Field, Heading, Loading, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { useFocusReload } from "../../hooks/useFocusReload";
import { intervalLabel } from "../../utils/intervals";
import { humanDate, isIsoDate } from "../../utils/dates";
import { cmpMoney, formatSoles, normalizeMoneyInput } from "../../utils/money";

/** Gestión de un servicio: precio, calendario, cambio a individual, plazas y versiones de precio. */
export function ServiceManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const router = useRouter();
  const dialog = useDialog();
  const sub = useAsync(() => api.subscription(id), [id]);
  const terms = useAsync(() => api.terms(id), [id]);
  const seats = useAsync(() => api.seats(id), [id]);
  const [refreshing, setRefreshing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeleteSubscriptionPreview | null>(null);
  const [unpaidHandling, setUnpaidHandling] = useState<"convert_to_loan" | "discard">("convert_to_loan");
  const reload = React.useCallback(() => { void sub.reload(); void terms.reload(); void seats.reload(); }, [sub.reload, terms.reload, seats.reload]);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([sub.reload(), terms.reload(), seats.reload()]); } finally { setRefreshing(false); }
  }, [sub.reload, terms.reload, seats.reload]);
  useFocusReload(reload);
  const restore = useSubmit(async () => api.restoreSubscription(id));

  if (sub.loading && !sub.data) return <Screen title="Gestionar servicio"><Loading /></Screen>;
  if (sub.error || !sub.data) return <Screen title="Gestionar servicio"><ErrorBox message={sub.error ?? "No se encontró el servicio."} onRetry={sub.reload} /></Screen>;
  const s = sub.data;
  const suspended = s.status === "suspended";
  const full = s.occupiedSeats >= s.capacity;

  const doArchive = async () => {
    if (archiving) return;
    const ok = await dialog.confirm({
      title: `¿Archivar ${s.name}?`,
      message: "Dejará de generar ciclos nuevos, pero conservará todo su historial. Podrás restaurarlo desde Servicios → Archivados.",
      confirmLabel: "Archivar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    setArchiving(true);
    try {
      await api.archiveSubscription(id);
      router.replace("/planning" as never);
    } catch (e) {
      await dialog.fail(e, "No se pudo archivar");
    } finally {
      setArchiving(false);
    }
  };

  const openDeletePreview = async () => {
    if (loadingDelete) return;
    setLoadingDelete(true);
    try {
      const p = await api.previewDeleteSubscription(id);
      setUnpaidHandling("convert_to_loan");
      setDeletePreview(p);
    } catch (e) {
      await dialog.fail(e, "No se pudo revisar el servicio");
    } finally {
      setLoadingDelete(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletePreview || deleting) return;
    setDeleting(true);
    try {
      const hasDebt = deletePreview.pendingDebts.length > 0;
      const res = await api.deleteSubscription(id, {
        force: !deletePreview.isEmpty,
        ...(hasDebt ? { unpaidHandling } : {}),
      });
      setDeletePreview(null);
      if (res.convertedLoans && res.convertedLoans.length > 0) {
        const n = res.convertedLoans.length;
        await dialog.success(
          "Servicio eliminado",
          `Se pasó a préstamo la deuda pendiente de ${n} ${n === 1 ? "persona" : "personas"}.`,
        );
      }
      router.replace("/planning" as never);
    } catch (e) {
      setDeletePreview(null);
      await dialog.fail(e, "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const impactLines = deletePreview ? [
    deletePreview.impact.participants > 0
      ? `Se eliminarán ${deletePreview.impact.participants} ${deletePreview.impact.participants === 1 ? "participante" : "participantes"} y sus plazas en este servicio.`
      : null,
    deletePreview.impact.charges > 0
      ? `Se borrarán ${deletePreview.impact.charges} ${deletePreview.impact.charges === 1 ? "cargo" : "cargos"} y el historial de ciclos del servicio.`
      : null,
    deletePreview.impact.supplierPayments > 0
      ? `Se perderá el registro de ${deletePreview.impact.supplierPayments} ${deletePreview.impact.supplierPayments === 1 ? "pago" : "pagos"} al proveedor dentro del servicio (tus movimientos y saldos de cuenta no se borran).`
      : null,
    deletePreview.impact.appliedPaymentsCount > 0
      ? `Los ${formatSoles(deletePreview.impact.appliedPaymentsTotal)} ya cobrados a participantes quedarán como crédito libre en sus contactos.`
      : null,
    deletePreview.impact.activeReservations > 0
      ? `Se liberarán ${formatSoles(deletePreview.impact.activeReservationsTotal)} en anticipos reservados (pasarán a crédito libre).`
      : null,
    deletePreview.impact.calendarChanges > 0
      ? `Se borrarán ${deletePreview.impact.calendarChanges} ${deletePreview.impact.calendarChanges === 1 ? "cambio" : "cambios"} de calendario.`
      : null,
  ].filter((x): x is string => x !== null) : [];

  return (
    <Screen title={s.name} subtitle="Gestionar servicio" refreshing={refreshing} onRefresh={onRefresh}>
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip status={suspended ? "overdue" : s.status === "archived" ? "converted" : "paid"} label={suspended ? "Suspendido" : s.status === "archived" ? "Archivado" : "Activo"} />
          <Chip status="exempt" label={s.mode === "shared" ? "Compartido" : "Personal"} />
        </View>
        {s.terms && <Txt size={13} muted>{formatSoles(s.terms.announcedPrice)} · {intervalLabel(s.terms.interval)} · renueva el día {Number(s.terms.anchor.slice(8))}</Txt>}
        <Txt size={13} muted>{s.occupiedSeats}/{s.capacity} plazas ocupadas</Txt>
      </Card>

      <View style={{ gap: 10 }}>
        <Button title="Cambiar precio del proveedor" icon="pricetag-outline" onPress={() => router.push(`/service/${id}/price` as never)} disabled={suspended || s.status === "archived"} />
        <Button title={suspended ? "Reactivar o ver calendario" : "Calendario: desplazar, suspender…"} variant="secondary" icon="calendar-outline" onPress={() => router.push(`/service/${id}/calendar` as never)} disabled={s.status === "archived"} />
        {s.mode === "shared" && <Button title="Pasar a individual" variant="secondary" icon="person-outline" onPress={() => router.push(`/service/${id}/individual` as never)} disabled={suspended || s.status === "archived"} />}
      </View>

      {s.mode === "shared" && (
        <>
          <Heading
            action={
              <Button
                title={full ? "Lleno" : "Incorporar"}
                icon="person-add-outline"
                variant="secondary"
                size="small"
                disabled={suspended || s.status === "archived" || full}
                onPress={() => router.push({ pathname: "/service/join", params: { id } })}
              />
            }
          >
            Plazas y cuotas
          </Heading>
          <Txt size={12} muted>Toca un participante para cambiar su cuota, darle cortesía o darlo de baja.</Txt>
          {(seats.data ?? []).map((x) => x.isOwner ? (
            <Card key={x.id} outlined>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt bold>Tú · {x.label}</Txt>
                  <Txt size={12} muted>Titular del servicio · sin cuota fija</Txt>
                </View>
                <Chip status="exempt" label="Titular" />
              </View>
            </Card>
          ) : (
            <RowLink key={x.id} onPress={() => router.push(`/seat/${x.id}` as never)}>
              <View style={{ flex: 1 }}>
                <Txt bold>{x.contact?.name ?? "—"} · {x.label}</Txt>
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

      {s.status === "archived" ? (
        <>
          <Heading>Restaurar</Heading>
          <Button title="Restaurar servicio" icon="refresh-outline" busy={restore.busy} onPress={async () => { if (await restore.submit()) void reload(); }} />
          {restore.error && <Notice tone="err">{restore.error}</Notice>}
        </>
      ) : (
        <>
          <Heading>Archivar</Heading>
          <Button title="Archivar servicio" variant="secondary" icon="archive-outline" busy={archiving} onPress={doArchive} />
          <Txt size={12} muted>Conserva todo el historial. No se archiva con plazas activas de terceros ni con crédito reservado.</Txt>
        </>
      )}

      <Heading>Eliminar</Heading>
      <Button title="Eliminar servicio" variant="outlineDanger" icon="trash-outline" busy={loadingDelete} onPress={openDeletePreview} />
      <Txt size={12} muted>Antes de borrar te mostraremos qué datos se perderán y qué hacer si alguien todavía te debe.</Txt>

      <BottomSheet
        visible={!!deletePreview}
        onClose={() => { if (!deleting) setDeletePreview(null); }}
        title={`Eliminar ${s.name}`}
        maxHeight={0.85}
      >
        {deletePreview && (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <Notice tone="err">
              Esta acción eliminará «{s.name}» definitivamente y no se puede deshacer.
            </Notice>

            {deletePreview.isEmpty ? (
              <Card outlined>
                <Txt size={13} muted>
                  Este servicio no tiene pagos, participantes ni deudas pendientes. Puedes eliminarlo sin afectar tus cuentas ni contactos.
                </Txt>
              </Card>
            ) : (
              <>
                <View style={{ gap: 6 }}>
                  <Txt bold size={14}>Qué se perderá o cambiará</Txt>
                  <Card outlined>
                    <View style={{ gap: 8 }}>
                      {impactLines.map((line, idx) => (
                        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <Ionicons name="alert-circle-outline" size={16} color={colors.warningStrong} style={{ marginTop: 1 }} />
                          <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "Asap", lineHeight: 18 }}>{line}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>

                {deletePreview.pendingDebts.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Txt bold size={14}>Personas que todavía te deben ({formatSoles(deletePreview.totalPendingDebt)})</Txt>
                    <Card outlined>
                      <View style={{ gap: 6 }}>
                        {deletePreview.pendingDebts.map((d) => (
                          <View key={d.contactId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{d.contactName}</Text>
                            <Text style={{ color: colors.expenseStrong, fontSize: 14, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{formatSoles(d.amount)}</Text>
                          </View>
                        ))}
                      </View>
                    </Card>

                    <Choice
                      label="¿Qué hacemos con lo que aún te deben?"
                      value={unpaidHandling}
                      onChange={setUnpaidHandling}
                      options={[
                        { id: "convert_to_loan", label: "Pasar a deuda (préstamo)", hint: "Crea un préstamo por cada persona para no perder ese cobro" },
                        { id: "discard", label: "Descartar deuda", hint: "Borra los cargos pendientes; ya no te los deberán" },
                      ]}
                    />
                  </View>
                )}
              </>
            )}

            <View style={{ gap: 8, marginTop: 4 }}>
              <Button
                title="Eliminar definitivamente"
                variant="danger"
                icon="trash-outline"
                busy={deleting}
                onPress={confirmDelete}
              />
              {!deletePreview.isEmpty && s.status !== "archived" && (
                <Button
                  title="Mejor archivar (conserva el historial)"
                  variant="secondary"
                  icon="archive-outline"
                  disabled={deleting}
                  onPress={() => { setDeletePreview(null); setTimeout(() => void doArchive(), 150); }}
                />
              )}
              <Button
                title="Cancelar"
                variant="outline"
                disabled={deleting}
                onPress={() => setDeletePreview(null)}
              />
            </View>
          </View>
        )}
      </BottomSheet>
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
        {others.length > 0 && (
          <Choice label="Cómo se cobra la diferencia de lo ya emitido" value={mode} onChange={touch(setMode)}
            options={[
              { id: "per_renewal", label: "En cada renovación", hint: "Se ajusta cada ciclo al renovarse" },
              { id: "lump", label: "Todo junto, hoy", hint: "Se cobra la diferencia de una vez" },
            ]} />
        )}
        <ReasonField value={reason} onChange={touch(setReason)} />
      </Card>

      {others.length > 0 && (
        <>
          <Heading action={flow.data?.suggestedQuota ? <Button title={`Usar ${formatSoles(String(flow.data.suggestedQuota.amount))} en todas`} variant="secondary" size="small" onPress={() => { setQuotas(Object.fromEntries(others.map((o) => [o.id, String(flow.data!.suggestedQuota.amount)]))); flow.invalidate(); }} /> : undefined}>Cuotas</Heading>
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
            <Field label="Cantidad" value={count} onChangeText={touch(setCount)} keyboardType="number-pad" />
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
