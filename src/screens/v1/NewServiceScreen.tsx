import React, { useEffect, useMemo, useRef, useState } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api, errorMessage, type SubscriptionBody } from "../../api/client";
import type { SubscriptionPreview } from "../../api/types";
import { Button, Card, Field, Heading, KV, Money, Notice, Screen, Txt } from "../../components/v1/ui";
import { ServiceStylePicker } from "../../components/v1/ServiceStylePicker";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getServiceDefaults } from "../../utils/serviceIcons";
import { useSubmit } from "../../hooks/useAsync";
import { addMonthsIso, humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { normalizeMoneyInput } from "../../utils/money";

const FREQ = [{ id: "1", label: "Mensual", count: 1 }, { id: "3", label: "Cada 3 meses", count: 3 }, { id: "12", label: "Anual", count: 12 }];

export default function NewServiceScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"shared" | "personal">("shared");
  const [capacity, setCapacity] = useState("4");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState(1);
  const [start, setStart] = useState(todayLocalIso());
  const [next, setNext] = useState(addMonthsIso(todayLocalIso(), 1) ?? "");
  const [nextTouched, setNextTouched] = useState(false);
  const [occupied, setOccupied] = useState(4);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [style, setStyle] = useState({ icon: "receipt", color: colors.primary });
  const [styleTouched, setStyleTouched] = useState(false);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const cap = Math.max(1, Number.parseInt(capacity, 10) || 1);
  const priceNorm = normalizeMoneyInput(price);

  // Sugiere ícono y color según el nombre (Netflix, Spotify…) mientras no se elijan a mano.
  useEffect(() => {
    if (!styleTouched && name.trim()) setStyle(getServiceDefaults(name));
  }, [name, styleTouched]);

  // Propone la fecha del siguiente pago (inicio + frecuencia) mientras el usuario no la edite a mano.
  useEffect(() => {
    if (!nextTouched && isIsoDate(start)) setNext(addMonthsIso(start, months) ?? "");
  }, [start, months, nextTouched]);

  const body = useMemo<SubscriptionBody | null>(() => {
    if (!name.trim() || !priceNorm || !isIsoDate(start) || !isIsoDate(next)) return null;
    return { name: name.trim(), mode, capacity: mode === "personal" ? 1 : cap, announcedPrice: priceNorm, interval: { unit: "month", count: months }, startDate: start, nextPaymentDate: next };
  }, [name, mode, cap, priceNorm, months, start, next]);

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

  const Chipbtn = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? `${colors.primary}1A` : "transparent" }}>
      <Text style={{ color: on ? colors.primary : colors.text, fontFamily: "AsapMedium" }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen title="Nuevo servicio" footer={<Button title="Crear servicio" onPress={save} busy={create.busy} disabled={!preview} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); create.resetKey(); }} placeholder="Netflix" autoCapitalize="words" />
        <ServiceStylePicker icon={style.icon} color={style.color} onChange={(v) => { setStyle(v); setStyleTouched(true); }} />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Chipbtn on={mode === "shared"} label="Compartido" onPress={() => setMode("shared")} />
          <Chipbtn on={mode === "personal"} label="Personal" onPress={() => setMode("personal")} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {mode === "shared" && <View style={{ flex: 1 }}><Field label="Plazas (contándote)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /></View>}
          <View style={{ flex: 1 }}><Field label="Precio anunciado (S/)" value={price} onChangeText={setPrice} placeholder="45.00" keyboardType="decimal-pad" error={price && !priceNorm ? "Importe inválido" : undefined} /></View>
        </View>
        <Txt size={12} muted style={{ marginBottom: 6 }}>FRECUENCIA</Txt>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {FREQ.map((f) => <Chipbtn key={f.id} on={months === f.count} label={f.label} onPress={() => setMonths(f.count)} />)}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Inicio (AAAA-MM-DD)" value={start} onChangeText={setStart} placeholder="2026-10-07" error={start && !isIsoDate(start) ? "Fecha inválida" : undefined} /></View>
          <View style={{ flex: 1 }}><Field label="Siguiente pago" value={next} onChangeText={(t) => { setNext(t); setNextTouched(true); }} placeholder="2026-11-07" error={next && !isIsoDate(next) ? "Fecha inválida" : undefined} /></View>
        </View>
        <Txt size={12} muted>La fecha del siguiente pago es la que informa tu proveedor; EVA la compara con lo calculado.</Txt>
      </Card>

      {previewError && <Notice tone="err">{previewError}</Notice>}
      {preview && (
        <>
          {preview.calendar.ok ? (
            <Notice tone="ok">El calendario coincide: el siguiente pago es el {humanDate(preview.calendar.expectedNextPayment)}.</Notice>
          ) : (
            <View style={{ gap: 8 }}>
              <Notice tone="warn">El proveedor indica el {humanDate(next)} pero el cálculo da el {humanDate(preview.calendar.expectedNextPayment)} ({preview.calendar.diffDays > 0 ? "+" : ""}{preview.calendar.diffDays} días). Prevalece la fecha del proveedor.</Notice>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Switch value={confirmMismatch} onValueChange={setConfirmMismatch} />
                <Txt>Confirmo esta fecha</Txt>
              </View>
            </View>
          )}
          {mode === "shared" && (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt muted>Plazas ocupadas (contándote)</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <TouchableOpacity onPress={() => setOccupied((o) => Math.max(1, o - 1))} accessibilityLabel="Menos plazas"><Txt bold size={22}>−</Txt></TouchableOpacity>
                  <Txt bold>{Math.min(occupied, cap)}</Txt>
                  <TouchableOpacity onPress={() => setOccupied((o) => Math.min(cap, o + 1))} accessibilityLabel="Más plazas"><Txt bold size={22}>+</Txt></TouchableOpacity>
                </View>
              </View>
              <Txt muted style={{ marginTop: 8 }}>Cuota sugerida por plaza</Txt>
              <Money value={preview.suggestedQuota.amount} size={28} />
              <Txt size={12} muted style={{ marginTop: 4 }}>{preview.suggestedQuota.formula}. Podrás poner la cuota que acuerdes con cada persona.</Txt>
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
