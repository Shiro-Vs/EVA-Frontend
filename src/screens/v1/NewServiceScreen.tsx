import React, { useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api, errorMessage, type SubscriptionBody } from "../../api/client";
import type { SubscriptionPreview } from "../../api/types";
import { Button, Card, Field, Heading, KV, Money, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { ServiceStylePicker } from "../../components/v1/ServiceStylePicker";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getServiceDefaults } from "../../utils/serviceIcons";
import { useSubmit } from "../../hooks/useAsync";
import { Choice, OptionalAccountPicker } from "../../components/v1/forms";
import { SelectField } from "../../components/v1/Select";
import { DateInput } from "../../components/v1/DatePicker";
import { addMonthsIso, humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { normalizeMoneyInput } from "../../utils/money";

type Unit = "day" | "week" | "month" | "year";
const UNITS: Array<{ id: Unit; label: string }> = [{ id: "day", label: "Días" }, { id: "week", label: "Semanas" }, { id: "month", label: "Meses" }, { id: "year", label: "Años" }];

/** Frecuencias habituales de cobro del proveedor. «Otra» pide el detalle (cada cuántos días, semanas, meses o años). */
const FREQUENCIES: Array<{ id: string; label: string; unit?: Unit; count?: number }> = [
  { id: "m1", label: "Mensual", unit: "month", count: 1 },
  { id: "y1", label: "Anual", unit: "year", count: 1 },
  { id: "w1", label: "Semanal", unit: "week", count: 1 },
  { id: "m2", label: "Cada 2 meses", unit: "month", count: 2 },
  { id: "m3", label: "Trimestral (cada 3 meses)", unit: "month", count: 3 },
  { id: "m6", label: "Semestral (cada 6 meses)", unit: "month", count: 6 },
  { id: "custom", label: "Otra frecuencia…" },
];

/** Propone la fecha del siguiente pago (inicio + frecuencia); el proveedor tiene la última palabra y la API la compara. */
function suggestNext(start: string, unit: Unit, count: number): string {
  if (!isIsoDate(start)) return "";
  if (unit === "month") return addMonthsIso(start, count) ?? "";
  if (unit === "year") return addMonthsIso(start, 12 * count) ?? "";
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (unit === "week" ? 7 : 1) * count);
  return d.toISOString().slice(0, 10);
}

export default function NewServiceScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"shared" | "personal">("shared");
  const [capacity, setCapacity] = useState("4");
  const [price, setPrice] = useState("");
  const [freq, setFreq] = useState("m1");
  const [customUnit, setCustomUnit] = useState<Unit>("month");
  const [count, setCount] = useState("1");
  const [preferred, setPreferred] = useState<string | null>(null);
  const [start, setStart] = useState(todayLocalIso());
  const [next, setNext] = useState(suggestNext(todayLocalIso(), "month", 1));
  const [nextTouched, setNextTouched] = useState(false);
  const [occupied, setOccupied] = useState(4);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [style, setStyle] = useState({ icon: "receipt", color: colors.primary });
  const [styleTouched, setStyleTouched] = useState(false);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const cap = Math.max(1, Number.parseInt(capacity, 10) || 1);
  const preset = FREQUENCIES.find((f) => f.id === freq)!;
  const unit: Unit = preset.unit ?? customUnit;
  const cnt = preset.count ?? Math.max(1, Number.parseInt(count, 10) || 1);
  const priceNorm = normalizeMoneyInput(price);

  // Sugiere ícono y color según el nombre (Netflix, Spotify…) mientras no se elijan a mano.
  useEffect(() => {
    if (!styleTouched && name.trim()) setStyle(getServiceDefaults(name));
  }, [name, styleTouched]);

  // Propone la fecha del siguiente pago (inicio + frecuencia) mientras el usuario no la edite a mano.
  useEffect(() => {
    if (!nextTouched && isIsoDate(start)) setNext(suggestNext(start, unit, cnt));
  }, [start, unit, cnt, nextTouched]);

  const body = useMemo<SubscriptionBody | null>(() => {
    if (!name.trim() || !priceNorm || !isIsoDate(start) || !isIsoDate(next)) return null;
    return { name: name.trim(), mode, capacity: mode === "personal" ? 1 : cap, announcedPrice: priceNorm, interval: { unit, count: cnt }, startDate: start, nextPaymentDate: next, ...(preferred ? { preferredAccountId: preferred } : {}) };
  }, [name, mode, cap, priceNorm, unit, cnt, start, next, preferred]);

  // Vista previa en vivo (con espera breve para no consultar en cada tecla).
  const seq = useRef(0);
  useEffect(() => {
    setConfirmMismatch(false);
    if (!body) { setPreview(null); setPreviewError(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const p = await api.previewSubscription({ ...body, occupiedSeats: Math.min(occupied, body.capacity) });
        if (mine === seq.current) { setPreview(p); setPreviewError(null); }
      } catch (e) {
        if (mine === seq.current) { setPreview(null); setPreviewError(errorMessage(e)); }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [body, occupied]);

  const create = useSubmit(async (key: string) => {
    if (!body || !preview) throw new Error("Completa los datos y revisa la vista previa.");
    if (!preview.calendar.ok && !confirmMismatch) throw Object.assign(new Error("Confirma la fecha del proveedor para continuar."), { code: "CALENDAR_MISMATCH_UNCONFIRMED" });
    return api.createSubscription({ ...body, icon: style.icon, color: style.color, previewToken: preview.previewToken, confirmCalendarMismatch: preview.calendar.ok ? undefined : true }, key);
  });
  const save = async () => { const r = await create.submit(); if (r) router.replace(`/service/${r.id}`); };

  return (
    <Screen title="Nuevo servicio" footer={<Button title="Crear servicio" onPress={save} busy={create.busy} disabled={!preview} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); create.resetKey(); }} placeholder="Netflix" autoCapitalize="words" />
        <ServiceStylePicker icon={style.icon} color={style.color} onChange={(v) => { setStyle(v); setStyleTouched(true); }} />
        <Choice label="Tipo" options={[{ id: "shared", label: "Compartido" }, { id: "personal", label: "Personal" }]} value={mode} onChange={setMode} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {mode === "shared" && <View style={{ flex: 1 }}><Field label="Plazas" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /></View>}
          <View style={{ flex: 1 }}><Field label="Precio (S/)" value={price} onChangeText={setPrice} placeholder="45.00" keyboardType="decimal-pad" error={price && !priceNorm ? "Importe inválido" : undefined} /></View>
        </View>
        <SelectField label="Cada cuánto cobra el proveedor" value={freq} onChange={setFreq} options={FREQUENCIES.map((f) => ({ id: f.id, label: f.label }))} />
        {freq === "custom" && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Cada" value={count} onChangeText={setCount} keyboardType="number-pad" /></View>
            <View style={{ flex: 1.4 }}><SelectField label="Unidad" value={customUnit} onChange={setCustomUnit} options={UNITS} /></View>
          </View>
        )}
        <DateInput label="Inicio" value={start} onChange={setStart} />
        <DateInput label="Siguiente pago" value={next} onChange={(t) => { setNext(t); setNextTouched(true); }} />
        <OptionalAccountPicker label="Cuenta de pago (opcional)" value={preferred} onChange={setPreferred} />
        <Txt size={12} muted>El siguiente pago es el que informa tu proveedor; EVA lo compara con lo calculado.</Txt>
      </Card>

      {previewError && <Notice tone="err">{previewError}</Notice>}
      {preview && (
        <>
          {preview.calendar.ok ? (
            <Notice tone="ok">El calendario coincide: el siguiente pago es el {humanDate(preview.calendar.expectedNextPayment)}.</Notice>
          ) : (
            <View style={{ gap: 8 }}>
              <Notice tone="warn">El proveedor indica el {humanDate(next)} pero el cálculo da el {humanDate(preview.calendar.expectedNextPayment)} ({preview.calendar.diffDays > 0 ? "+" : ""}{preview.calendar.diffDays} días). Prevalece la fecha del proveedor.</Notice>
              <SwitchRow label="Confirmo esta fecha" value={confirmMismatch} onValueChange={setConfirmMismatch} />
            </View>
          )}
          {mode === "shared" && (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Txt muted style={{ flex: 1, flexShrink: 1 }}>Plazas ocupadas (contándote)</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setOccupied((o) => Math.max(1, o - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Menos plazas"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.borderStrong }}
                  >
                    <Txt bold size={20}>−</Txt>
                  </TouchableOpacity>
                  <Txt bold size={16} style={{ minWidth: 22, textAlign: "center" }}>{Math.min(occupied, cap)}</Txt>
                  <TouchableOpacity
                    onPress={() => setOccupied((o) => Math.min(cap, o + 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Más plazas"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.borderStrong }}
                  >
                    <Txt bold size={20}>+</Txt>
                  </TouchableOpacity>
                </View>
              </View>
              <Txt muted style={{ marginTop: 4 }}>Cuota sugerida por plaza</Txt>
              <Money value={preview.suggestedQuota.amount} size={28} />
              <Txt size={12} muted>{preview.suggestedQuota.formula}. Podrás poner la cuota que acuerdes con cada persona.</Txt>
            </Card>
          )}
          <Heading>Primeros ciclos</Heading>
          <Card outlined>
            {preview.cycles.map((c) => <KV key={c.seq} label={`Ciclo ${c.seq}`} value={`${humanDate(c.startDate)} → ${humanDate(c.endDate)}`} strong />)}
          </Card>
        </>
      )}
      {create.error && <Notice tone="err">{create.error}</Notice>}
    </Screen>
  );
}
