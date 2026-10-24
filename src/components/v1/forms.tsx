import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { api, errorMessage } from "../../api/client";
import type { Preview } from "../../api/types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";
import { Button, Card, Field, Loading, Notice, Txt } from "./ui";

// Bloques de formulario compartidos por las pantallas de la Entrega 2. Cada pantalla pide exactamente los campos que
// exige la API (docs 13); el aspecto se afinará después.

export function Label({ children }: { children: React.ReactNode }) {
  return <Txt size={12} muted style={{ marginBottom: 6, textTransform: "uppercase" }}>{children}</Txt>;
}

/** Selección única con chips. */
export function Choice<T extends string>({ label, options, value, onChange }: { label?: string; options: Array<{ id: T; label: string; hint?: string }>; value: T | null; onChange: (v: T) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Label>{label}</Label>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <TouchableOpacity key={o.id} onPress={() => onChange(o.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? `${colors.primary}1A` : "transparent" }}>
              <Text style={{ color: on ? colors.primary : colors.text, fontFamily: "AsapMedium" }}>{o.label}</Text>
              {o.hint ? <Text style={{ color: colors.textSecondary, fontFamily: "Asap", fontSize: 10 }}>{o.hint}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Cuentas activas para elegir. Preselecciona la predeterminada. */
export function AccountPicker({ label = "Cuenta", value, onChange, exclude }: { label?: string; value: string | null; onChange: (id: string) => void; exclude?: string | null }) {
  const accounts = useAsync(() => api.accounts(), []);
  const list = (accounts.data ?? []).filter((a) => a.status === "active" && a.id !== exclude);
  useEffect(() => {
    if (!value && list.length) onChange((list.find((a) => a.isDefault) ?? list[0]!).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, list.length]);
  if (accounts.loading && !accounts.data) return <Loading />;
  if (accounts.error) return <Notice tone="err">{accounts.error}</Notice>;
  if (list.length === 0) return <Notice tone="warn">Primero crea una cuenta desde Inicio.</Notice>;
  return <Choice label={label} options={list.map((a) => ({ id: a.id, label: a.name, hint: formatSoles(a.balance) }))} value={value} onChange={onChange} />;
}

/** Cuenta opcional (p. ej. la cuenta con la que se suele pagar un servicio): permite elegir «Ninguna». */
export function OptionalAccountPicker({ label = "Cuenta", value, onChange }: { label?: string; value: string | null; onChange: (id: string | null) => void }) {
  const accounts = useAsync(() => api.accounts(), []);
  const list = (accounts.data ?? []).filter((a) => a.status === "active");
  if (accounts.loading && !accounts.data) return <Loading />;
  if (accounts.error) return <Notice tone="err">{accounts.error}</Notice>;
  return (
    <Choice label={label} value={value ?? "__none__"} onChange={(v) => onChange(v === "__none__" ? null : v)}
      options={[{ id: "__none__", label: "Ninguna" }, ...list.map((a) => ({ id: a.id, label: a.name }))]} />
  );
}

/** Inicios de ciclo futuros del servicio: la API solo admite cambios que empiezan en uno de ellos. */
export function FutureCyclePicker({ subscriptionId, label = "Rige desde el inicio del ciclo", value, onChange }: { subscriptionId: string; label?: string; value: string | null; onChange: (date: string) => void }) {
  const cycles = useAsync(() => api.cycles(subscriptionId), [subscriptionId]);
  const today = todayLocalIso();
  const starts = (cycles.data ?? []).map((c) => c.startDate).filter((d) => d > today).sort();
  useEffect(() => { if (!value && starts.length) onChange(starts[0]!); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, starts.length]);
  if (cycles.loading && !cycles.data) return <Loading />;
  if (cycles.error) return <Notice tone="err">{cycles.error}</Notice>;
  if (starts.length === 0) return <Notice tone="warn">Todavía no hay un ciclo futuro generado. Genera el siguiente ciclo desde el servicio.</Notice>;
  return <Choice label={label} options={starts.map((d) => ({ id: d, label: `${humanDate(d)} (${d})` }))} value={value} onChange={onChange} />;
}

/** Fecha AAAA-MM-DD con validación. */
export function DateField({ label, value, onChange, optional }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const bad = value !== "" && !isIsoDate(value);
  return <Field label={`${label}${optional ? " (opcional)" : ""} · AAAA-MM-DD`} value={value} onChangeText={onChange} placeholder="2026-12-31" error={bad ? "Fecha inválida" : undefined} />;
}

/** Importe en soles con validación. */
export function MoneyField({ label, value, onChange, optional, placeholder = "0.00" }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean; placeholder?: string }) {
  const bad = value.trim() !== "" && !normalizeMoneyInput(value);
  return <Field label={`${label} (S/)${optional ? " · opcional" : ""}`} value={value} onChangeText={onChange} placeholder={placeholder} keyboardType="decimal-pad" error={bad ? "Importe inválido" : undefined} />;
}

export function ReasonField({ value, onChange, label = "Motivo" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return <Field label={label} value={value} onChangeText={onChange} placeholder="Escribe el motivo" autoCapitalize="sentences" maxLength={200} />;
}

// ───────────────────────── Vista previa genérica ─────────────────────────

const LABELS: Record<string, string> = {
  subscription: "Servicio", seat: "Plaza", contact: "Contacto", receipt: "Cobro", operation: "Operación", effectiveFrom: "Rige desde", effectiveOn: "Efectiva el", requestedOn: "Solicitada el",
  oldQuota: "Cuota actual", newQuota: "Cuota nueva", oldPrice: "Precio actual", newPrice: "Precio nuevo", mode: "Modo", amount: "Importe", adjustments: "Ajustes", adjustment: "Ajuste",
  dueDate: "Vence", pendingBefore: "Pendiente antes", pendingAfter: "Pendiente después", creditFreed: "Crédito liberado", totals: "Totales", cycle: "Ciclo", start: "Inicio", end: "Fin",
  startsOn: "Empieza el", untilDate: "Hasta", cycles: "Ciclos", kind: "Tipo", waivedCharges: "Cargos eximidos", waived: "Eximido", existingDebt: "Deuda anterior", debtChoiceRequired: "Hay que elegir qué hacer con la deuda",
  debtOptions: "Opciones", label: "Plaza", currentQuota: "Cuota actual", proposedQuota: "Cuota propuesta", locked: "Bloqueada por otro cambio", suggestedQuota: "Cuota sugerida", formula: "Fórmula",
  occupiedSeats: "Plazas ocupadas", cyclesAffected: "Ciclos afectados", seats: "Plazas", change: "Detalle del cambio", reasonCode: "Motivo del modo", usedDays: "Días usados", exitDaysLimit: "Límite L (días)",
  supplierPaid: "Proveedor pagado", currentCycle: "Ciclo en curso", currentCharge: "Cargo del ciclo en curso", netBefore: "Cargo antes", chargeAfter: "Cargo después", voidedCharges: "Cargos cancelados",
  refunds: "Devoluciones programadas", total: "Total", items: "Detalle", loan: "Préstamo", components: "Componentes", warnings: "Avisos", statusAfter: "Estado después", oldEnd: "Fin actual", newEnd: "Fin nuevo",
  futureCycles: "Ciclos siguientes", removedCycles: "Ciclos que se eliminan", amountsUnchanged: "Los importes no cambian", old: "Antes", new: "Después", seq: "Nº", rule: "Regla", status: "Estado", hasCharges: "Tiene cargos", note: "Nota", modeAfter: "Modo después",
  before: "Antes", after: "Después", effects: "Efectos", accounts: "Cuentas", name: "Nombre", balanceBefore: "Saldo antes", balanceAfter: "Saldo después", delta: "Diferencia",
  releasedAllocations: "Aplicaciones que se liberan", rebuiltAllocations: "Aplicaciones nuevas", remainder: "Sobrante", reservedTo: "Reservado para", willCreate: "Se creará", reversal: "Reversión", valid: "Válido",
  issues: "Observaciones", obligationsAfter: "Cómo queda lo adeudado", accountId: "Cuenta", date: "Fecha", receivedOn: "Fecha del cobro", description: "Descripción", principal: "Capital", concept: "Concepto",
  periodLabel: "Periodo", totalDebtBefore: "Deuda total antes", totalDebtAfter: "Deuda total después", executedAt: "Ejecutado", applied: "Aplicado", net: "Neto", exemption: "Exención",
};
// Valores técnicos de la API → texto para leer.
const VALUES: Record<string, string> = {
  per_renewal: "En cada renovación", lump: "Todo junto, hoy", finish_cycle: "Termina el ciclo", immediate: "Baja inmediata",
  SUPPLIER_PAID: "El proveedor ya está pagado", NO_LIMIT_DEFINED: "No hay límite L definido", LIMIT_REACHED: "Alcanzó el límite L", EARLY_EXIT: "Salida temprana", FORCED_CYCLE_END: "Fin de ciclo por cambio a individual",
  shift_renewal: "Desplazar renovación", advance_renewal: "Adelantar renovación", change_interval: "Cambiar frecuencia", suspend: "Suspender", reactivate: "Reactivar",
  cycles: "Por ciclos", until_date: "Hasta una fecha", permanent: "Permanente", keep: "Mantener en el servicio", convert: "Convertir en préstamo",
  active: "Vigente", suspended: "Suspendido", personal: "Personal", shared: "Compartido", income: "Ingreso", expense: "Gasto", transfer: "Transferencia",
  REFUND_AND_DEBT: "Hay crédito a devolver y también deuda: puedes cancelar la devolución y aplicar ese crédito al préstamo",
};
const HIDE = new Set(["previewToken", "id", "ownerId"]);
const MONEY_RE = /^-?\d+\.\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIdKey = (k: string) => HIDE.has(k) || /Ids?$/.test(k) && k !== "accountId";

function Scalar({ k, v }: { k: string; v: unknown }) {
  const { colors } = useAppTheme();
  let text: string;
  if (typeof v === "boolean") text = v ? "Sí" : "No";
  else if (typeof v === "string" && MONEY_RE.test(v)) text = formatSoles(v);
  else if (typeof v === "string" && DATE_RE.test(v)) text = humanDate(v) + ` (${v})`;
  else if (v === null || v === undefined) text = "—";
  else text = typeof v === "string" && VALUES[v] ? VALUES[v] : String(v);
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 }}>
      <Text style={{ color: colors.textSecondary, fontFamily: "Asap", fontSize: 13, flexShrink: 1 }}>{LABELS[k] ?? k}</Text>
      <Text style={{ color: colors.text, fontFamily: "AsapBold", fontSize: 13, textAlign: "right", flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

function Node({ k, v, depth }: { k: string; v: unknown; depth: number }) {
  const { colors } = useAppTheme();
  if (isIdKey(k)) return null;
  if (Array.isArray(v)) {
    if (v.length === 0) return <Scalar k={k} v="ninguno" />;
    if (v.every((x) => typeof x !== "object" || x === null)) return <Scalar k={k} v={v.join(", ")} />;
    return (
      <View style={{ marginTop: 4 }}>
        <Text style={{ color: colors.text, fontFamily: "AsapBold", fontSize: 13 }}>{LABELS[k] ?? k}</Text>
        {v.map((x, i) => (
          <View key={i} style={{ marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: `${colors.text}15` }}><Entries obj={x as Record<string, unknown>} depth={depth + 1} /></View>
        ))}
      </View>
    );
  }
  if (v !== null && typeof v === "object") {
    return (
      <View style={{ marginTop: 4 }}>
        <Text style={{ color: colors.text, fontFamily: "AsapBold", fontSize: 13 }}>{LABELS[k] ?? k}</Text>
        <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: `${colors.text}15` }}><Entries obj={v as Record<string, unknown>} depth={depth + 1} /></View>
      </View>
    );
  }
  return <Scalar k={k} v={v} />;
}
function Entries({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  return <>{Object.entries(obj).map(([k, v]) => <Node key={k} k={k} v={v} depth={depth} />)}</>;
}

/** Muestra una vista previa de la API como lista de datos legibles (sin identificadores internos). */
export function PreviewView({ data, hide = [] }: { data: Preview; hide?: string[] }) {
  const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => !hide.includes(k)));
  return <Card outlined><Entries obj={filtered} depth={0} /></Card>;
}

// ───────────────────────── Flujo vista previa → confirmar ─────────────────────────

/**
 * Operaciones con vista previa: 1) "Ver vista previa" pide el cálculo al servidor; 2) "Confirmar" aplica exactamente lo visto
 * con su `previewToken` y una clave de idempotencia. Cualquier cambio en el formulario invalida la vista previa.
 */
export function usePreviewFlow<R = unknown>(opts: { preview: () => Promise<Preview>; apply: (previewToken: string, key: string) => Promise<R> }) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const submit = useSubmit(async (key: string, token: string) => optsRef.current.apply(token, key));

  const run = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError(null);
    try {
      const p = await optsRef.current.preview();
      if (mine === seq.current) setData(p);
    } catch (e) {
      if (mine === seq.current) { setData(null); setError(errorMessage(e)); }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);
  /** Llamar cuando cambia cualquier campo del formulario. */
  const invalidate = useCallback(() => { seq.current++; setData(null); setError(null); setLoading(false); submit.resetKey(); }, [submit]);
  const confirm = useCallback(async (): Promise<R | undefined> => (data?.previewToken ? (submit.submit(data.previewToken) as Promise<R | undefined>) : undefined), [data, submit]);
  return { data, error, loading, run, invalidate, confirm, applying: submit.busy, applyError: submit.error, canConfirm: !!data?.previewToken };
}

/** Pie estándar de un formulario con vista previa: dos botones. */
export function PreviewFooter({ flow, previewLabel = "Ver vista previa", confirmLabel = "Confirmar", onConfirm, disabled, confirmDisabled, danger }: {
  flow: ReturnType<typeof usePreviewFlow>; previewLabel?: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; confirmDisabled?: boolean; danger?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      {flow.canConfirm
        ? <Button title={confirmLabel} onPress={onConfirm} busy={flow.applying} disabled={confirmDisabled} variant={danger ? "danger" : "primary"} />
        : <Button title={previewLabel} onPress={flow.run} busy={flow.loading} disabled={disabled} />}
      {flow.canConfirm && <Button title="Cambiar datos" variant="secondary" onPress={flow.invalidate} />}
    </View>
  );
}

/** Errores y vista previa de un flujo. */
export function FlowResult({ flow, hide }: { flow: ReturnType<typeof usePreviewFlow>; hide?: string[] }) {
  return (
    <>
      {flow.error && <Notice tone="err">{flow.error}</Notice>}
      {flow.data && <PreviewView data={flow.data} hide={hide} />}
      {flow.applyError && <Notice tone="err">{flow.applyError}</Notice>}
    </>
  );
}

/** Categorías activas (categoría → subcategoría) para elegir una. Con `allowNone` se puede dejar sin categoría. */
export function CategoryPicker({ label = "Categoría", value, onChange, allowNone = true }: { label?: string; value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  const cats = useAsync(() => api.categories("active"), []);
  if (cats.loading && !cats.data) return <Loading />;
  if (cats.error) return <Notice tone="err">{cats.error}</Notice>;
  const opts = (cats.data ?? []).flatMap((c) => [{ id: c.id, label: c.name }, ...(c.children ?? []).map((k) => ({ id: k.id, label: `${c.name} › ${k.name}` }))]);
  return (
    <Choice label={label} value={value ?? "__none__"} onChange={(v) => onChange(v === "__none__" ? null : v)}
      options={[...(allowNone ? [{ id: "__none__", label: "Sin categoría" }] : []), ...opts]} />
  );
}
