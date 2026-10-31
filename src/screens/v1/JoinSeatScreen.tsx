import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { api, errorMessage, type SeatBody } from "../../api/client";
import type { SeatPreview } from "../../api/types";
import { Button, Field, KV, Notice, Screen, Txt } from "../../components/v1/ui";
import { DateInput } from "../../components/v1/DatePicker";
import { SelectField } from "../../components/v1/Select";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { normalizeMoneyInput } from "../../utils/money";

const MODE_TEXT = {
  full_cycle: "Entra al inicio del ciclo: paga la cuota completa.",
  trial_free: "Entra casi al final del ciclo: este tramo no se le cobra.",
  partial_charged: "Entra a mitad de ciclo: paga solo los días que le quedan.",
} as const;
const WARN_TEXT: Record<string, string> = {
  CAPACITY_EXCEEDED: "No hay plazas libres en esa fecha.",
  TRAMO_EXCEDE_CICLO: "El tramo calculado superaba la cuota; se limita a la cuota completa.",
};

/** Alta de un participante en un servicio compartido: persona, cuota e ingreso; el cobro lo calcula el servidor y se muestra antes de confirmar. */
export default function JoinSeatScreen() {
  const { colors } = useAppTheme();
  const { id, contactId: presetContact } = useLocalSearchParams<{ id: string; contactId?: string }>();
  const service = useAsync(() => api.subscription(id), [id]);
  const contacts = useAsync(() => api.contacts(), []);
  const seats = useAsync(() => api.seats(id), [id]);
  const [contactId, setContactId] = useState<string | null>(presetContact ?? null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [quota, setQuota] = useState("");
  const [joinDate, setJoinDate] = useState(todayLocalIso());
  const [threshold, setThreshold] = useState("");
  const [more, setMore] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [preview, setPreview] = useState<SeatPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // La cuota y el nombre de la plaza se sugieren a partir de las plazas que ya hay (el usuario puede cambiarlos).
  useEffect(() => {
    const list = seats.data;
    if (!list) return;
    if (!quota) { const q = list.find((s) => !s.isOwner)?.quota; if (q) setQuota(q); }
    if (!label) setLabel(`Cuenta ${list.length}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats.data]);

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
      setNewName(""); setAdding(false);
      await contacts.reload();
      setContactId(c.id); join.resetKey();
    } catch (e) { setAddError(errorMessage(e)); }
  };

  const calc = preview?.calculation;
  const blocked = !preview || preview.warnings.includes("CAPACITY_EXCEEDED");
  const seated = new Set((seats.data ?? []).map((x) => x.contact?.id));
  const people = (contacts.data ?? []).filter((c) => c.status === "active" && (!seated.has(c.id) || c.id === contactId)).map((c) => ({ id: c.id, label: c.name }));
  const edit = (set: (v: string) => void) => (v: string) => { set(v); join.resetKey(); };

  return (
    <Screen title="Incorporar participante" subtitle={service.data ? `${service.data.name} · ${service.data.occupiedSeats}/${service.data.capacity} plazas` : undefined}
      footer={<Button title="Confirmar ingreso" onPress={confirm} busy={join.busy} disabled={blocked} />}>
      <View>
        <SelectField label="Persona" value={contactId} options={people} onChange={(v) => { setContactId(v); join.resetKey(); }} placeholder={contacts.loading && !contacts.data ? "Cargando…" : "Elegir persona"} />
        {adding ? (
          <View style={{ marginTop: -4, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}><Field label="Nombre de la persona nueva" value={newName} onChangeText={setNewName} placeholder="Nombre" autoCapitalize="words" autoFocus /></View>
              <View style={{ marginBottom: 16 }}><Button title="Agregar" size="compact" onPress={addContact} disabled={!newName.trim()} /></View>
            </View>
            {addError && <Notice tone="err">{addError}</Notice>}
          </View>
        ) : (
          <TouchableOpacity onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 12, marginLeft: 4 }}>
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "AsapBold" }}>Persona nueva</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Cuota por ciclo (S/)" value={quota} onChangeText={edit(setQuota)} placeholder="10.00" keyboardType="decimal-pad" error={quota && !quotaNorm ? "Importe inválido" : undefined} /></View>
        <View style={{ flex: 1 }}><DateInput label="Ingresa el" value={joinDate} onChange={edit(setJoinDate)} /></View>
      </View>

      <TouchableOpacity onPress={() => setMore(!more)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, marginLeft: 4 }}>
        <Ionicons name={more ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "AsapBold" }}>Más opciones</Text>
      </TouchableOpacity>
      {more && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Nombre de la plaza" value={label} onChangeText={edit(setLabel)} placeholder="Cuenta 1" autoCapitalize="sentences" /></View>
          <View style={{ flex: 1 }}><Field label="Días gratis" value={threshold} onChangeText={edit(setThreshold)} placeholder="Los de tu perfil" keyboardType="number-pad" error={threshold.trim() !== "" && !(Number.parseInt(threshold, 10) >= 0) ? "Número entero" : undefined} /></View>
        </View>
      )}

      {previewError && <Notice tone="err">{previewError}</Notice>}
      {preview && calc && (
        <View style={{ backgroundColor: colors.primarySurface, borderRadius: 22, padding: 16, gap: 8 }}>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 11, fontFamily: "AsapMedium", letterSpacing: 1.2, textTransform: "uppercase" }}>Se le cobrará al ingresar</Text>
          <Text style={{ color: colors.onPrimary, fontSize: 30, fontFamily: "AsapBold" }}>S/ {calc.net}</Text>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 13, fontFamily: "Asap" }}>{MODE_TEXT[calc.mode]}</Text>
          <Text style={{ color: colors.onPrimary, fontSize: 13, fontFamily: "AsapMedium" }}>Desde el {humanDate(preview.next.cycleStart)}: S/ {preview.next.amount} por ciclo · plazas {preview.occupancy.occupied}/{preview.occupancy.capacity}</Text>
        </View>
      )}
      {preview && calc && (
        <View>
          <TouchableOpacity onPress={() => setCalcOpen(!calcOpen)} accessibilityRole="button" accessibilityState={{ expanded: calcOpen }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <Ionicons name={calcOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "AsapBold" }}>Ver cómo se calculó</Text>
          </TouchableOpacity>
          {calcOpen && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {calc.mode !== "full_cycle" && <KV label={`Días restantes hasta el ${humanDate(preview.cycle.endDate)}`} value={`${calc.remainingDays} de ${calc.baseDays}`} />}
              {calc.mode !== "full_cycle" && <KV label="Proporcional" value={`S/ ${calc.prorated}`} />}
              {calc.exemption !== "0.00" && <KV label={`Tramo gratis (${calc.freeDaysThreshold} días o menos)`} value={`− S/ ${calc.exemption}`} />}
              <KV label="Cobro neto" value={`S/ ${calc.net}`} strong />
              <Txt size={12} muted>{calc.formula}</Txt>
            </View>
          )}
        </View>
      )}
      {preview?.warnings.map((w) => <Notice key={w} tone="warn">{WARN_TEXT[w] ?? w}</Notice>)}
      {join.error && <Notice tone="err">{join.error}</Notice>}
      <Txt size={12} muted>Agregar a alguien en EVA no lo agrega en el servicio del proveedor.</Txt>
    </Screen>
  );
}
