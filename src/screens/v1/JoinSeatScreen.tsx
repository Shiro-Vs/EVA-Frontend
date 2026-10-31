import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, errorMessage, type SeatBody } from "../../api/client";
import type { SeatPreview } from "../../api/types";
import { Button, Card, Chip, ErrorBox, Field, Heading, KV, Loading, Money, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { normalizeMoneyInput } from "../../utils/money";

const MODE_LABEL = { full_cycle: ["Ciclo completo", "unpaid"], trial_free: ["Tramo gratis", "paid"], partial_charged: ["Tramo cobrado", "partial"] } as const;
const WARN_TEXT: Record<string, string> = {
  CAPACITY_EXCEEDED: "No hay plazas libres en esa fecha.",
  TRAMO_EXCEDE_CICLO: "El tramo calculado superaba la cuota; se limita a la cuota completa.",
};

export default function JoinSeatScreen() {
  const { colors } = useAppTheme();
  const { id, contactId: presetContact } = useLocalSearchParams<{ id: string; contactId?: string }>();
  const contacts = useAsync(() => api.contacts(), []);
  const [contactId, setContactId] = useState<string | null>(presetContact ?? null);
  const [newName, setNewName] = useState("");
  const [label, setLabel] = useState("Cuenta 1");
  const [quota, setQuota] = useState("");
  const [joinDate, setJoinDate] = useState(todayLocalIso());
  const [threshold, setThreshold] = useState("");
  const [preview, setPreview] = useState<SeatPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const quotaNorm = normalizeMoneyInput(quota);
  const body = useMemo<SeatBody | null>(() => {
    if (!contactId || !label.trim() || !quotaNorm || !isIsoDate(joinDate)) return null;
    const g = threshold.trim() === "" ? null : Number.parseInt(threshold, 10);
    if (g !== null && (!Number.isInteger(g) || g < 0)) return null;
    return { contactId, label: label.trim(), quota: quotaNorm, joinDate, ...(g !== null ? { freeDaysThreshold: g } : {}) };
  }, [contactId, label, quotaNorm, joinDate, threshold]);

  const seq = useRef(0);
  useEffect(() => {
    if (!body) { setPreview(null); setPreviewError(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const p = await api.previewSeat(id, body);
        if (mine === seq.current) { setPreview(p); setPreviewError(null); }
      } catch (e) {
        if (mine === seq.current) { setPreview(null); setPreviewError(errorMessage(e)); }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [body, id]);

  const join = useSubmit(async (key: string) => {
    if (!body || !preview) throw new Error("Completa los datos y revisa la vista previa.");
    return api.createSeat(id, { ...body, previewToken: preview.previewToken }, key);
  });
  const done = useDone();
  const confirm = async () => { if (await join.submit()) done(`/service/${id}`); };

  const addContact = async () => {
    if (!newName.trim()) return;
    setAddError(null);
    try {
      const c = await api.createContact({ name: newName.trim() });
      setNewName("");
      await contacts.reload();
      setContactId(c.id);
    } catch (e) { setAddError(errorMessage(e)); }
  };

  const calc = preview?.calculation;
  const blocked = !preview || preview.warnings.includes("CAPACITY_EXCEEDED");

  return (
    <Screen title="Incorporar participante" footer={<Button title="Confirmar ingreso" onPress={confirm} busy={join.busy} disabled={blocked} />}>
      <Heading>Persona</Heading>
      {contacts.loading && !contacts.data ? <Loading /> : contacts.error ? <ErrorBox message={contacts.error} onRetry={contacts.reload} /> : (
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {(contacts.data ?? []).filter((c) => c.status === "active").map((c) => (
              <TouchableOpacity key={c.id} onPress={() => { setContactId(c.id); join.resetKey(); }} accessibilityRole="radio" accessibilityState={{ selected: contactId === c.id }}
                style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: 99, borderWidth: 1, borderColor: contactId === c.id ? colors.primary : colors.border, backgroundColor: contactId === c.id ? `${colors.primary}1A` : "transparent" }}>
                <Text style={{ color: contactId === c.id ? colors.primary : colors.text, fontFamily: "AsapMedium" }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}><Field label="O agrega a alguien nuevo" value={newName} onChangeText={setNewName} placeholder="Nombre" autoCapitalize="words" /></View>
            <View style={{ marginBottom: 16 }}><Button title="Agregar" variant="secondary" onPress={addContact} disabled={!newName.trim()} /></View>
          </View>
          {addError && <Notice tone="err">{addError}</Notice>}
        </Card>
      )}

      <Heading>Plaza y cuota</Heading>
      <Card>
        <Field label="Nombre de la plaza" value={label} onChangeText={(t) => { setLabel(t); join.resetKey(); }} placeholder="Cuenta 1" autoCapitalize="sentences" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Cuota por ciclo (S/)" value={quota} onChangeText={(t) => { setQuota(t); join.resetKey(); }} placeholder="10.00" keyboardType="decimal-pad" error={quota && !quotaNorm ? "Importe inválido" : undefined} /></View>
          <View style={{ flex: 1 }}><Field label="Ingreso (AAAA-MM-DD)" value={joinDate} onChangeText={(t) => { setJoinDate(t); join.resetKey(); }} error={joinDate && !isIsoDate(joinDate) ? "Fecha inválida" : undefined} /></View>
        </View>
        <Field label="Días gratis para esta plaza (opcional)" value={threshold} onChangeText={(t) => { setThreshold(t); join.resetKey(); }} placeholder="Usa el de tu perfil" keyboardType="number-pad" error={threshold.trim() !== "" && !(Number.parseInt(threshold, 10) >= 0) ? "Usa un número entero" : undefined} />
      </Card>

      {previewError && <Notice tone="err">{previewError}</Notice>}
      {preview && calc && (
        <>
          <Heading>Qué se cobrará</Heading>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Txt muted size={13}>{calc.mode === "full_cycle" ? "Ingreso el día de renovación" : `Días restantes hasta el ${humanDate(preview.cycle.endDate)}`}</Txt>
                {calc.mode !== "full_cycle" && <Txt bold size={17}>{calc.remainingDays} días</Txt>}
              </View>
              <Chip status={MODE_LABEL[calc.mode][1]} label={MODE_LABEL[calc.mode][0]} />
            </View>
            {calc.mode !== "full_cycle" && (
              <View style={{ marginTop: 8 }}>
                <KV label={`Prorrateo (cuota × ${calc.remainingDays} / ${calc.baseDays})`} value={`S/ ${calc.prorated}`} />
                <KV label={`Exención por umbral (${calc.remainingDays} ≤ ${calc.freeDaysThreshold}?)`} value={calc.exemption !== "0.00" ? `− S/ ${calc.exemption}` : "no"} />
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <Txt bold size={16}>Cobro neto</Txt><Money value={calc.net} size={28} />
            </View>
            <Txt size={12} muted style={{ marginTop: 6 }}>{calc.formula}</Txt>
          </Card>
          <Card outlined>
            <KV label="Hoy (vence el ingreso)" value={`S/ ${calc.net}`} strong />
            <KV label={`Desde el ${humanDate(preview.next.cycleStart)} (ciclo completo)`} value={`S/ ${preview.next.amount}`} />
            <KV label="Ocupación" value={`${preview.occupancy.occupied} / ${preview.occupancy.capacity} plazas`} />
          </Card>
          {preview.warnings.map((w) => <Notice key={w} tone="warn">{WARN_TEXT[w] ?? w}</Notice>)}
          <Txt size={12} muted>Agregar a alguien en EVA no lo agrega en el servicio del proveedor.</Txt>
        </>
      )}
      {join.error && <Notice tone="err">{join.error}</Notice>}
    </Screen>
  );
}
