import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { api } from "../../api/client";
import type { AnalysisScope } from "../../api/types";
import { Choice, DateField, Label } from "../../components/v1/forms";
import { MultiSelectField } from "../../components/v1/MultiSelect";
import { Loading, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { todayLocalIso } from "../../utils/dates";

/** Lee un archivo local (foto o PDF) como base64, sin el prefijo `data:`. */
export async function uriToBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
export const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Selección múltiple con chips. */
export function MultiChoice({ label, options, value, onChange, empty, select }: { label?: string; options: Array<{ id: string; label: string }>; value: string[]; onChange: (v: string[]) => void; empty?: string; select?: boolean }) {
  const { colors } = useAppTheme();
  if (options.length === 0) return empty ? <Txt size={12} muted>{empty}</Txt> : null;
  if (select || options.length > 6) return <MultiSelectField label={label} options={options} value={value} onChange={onChange} />;
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Label>{label}</Label>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <TouchableOpacity key={o.id} onPress={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ paddingHorizontal: 12, minHeight: 32, justifyContent: "center", borderRadius: 99, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? `${colors.primary}1A` : "transparent" }}>
              <Text style={{ color: on ? colors.primary : colors.text, fontFamily: "AsapMedium" }}>{on ? "✓ " : ""}{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type Preset = "month" | "prev" | "30" | "custom";
const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function presetRange(preset: Exclude<Preset, "custom">, now = new Date()): { from: string; to: string } {
  if (preset === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayLocalIso(now) };
  if (preset === "prev") return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: todayLocalIso(now) };
}

/** Alcance del análisis: periodo, cuentas, categorías y servicios. Solo lo que se elija se analiza (07 §9). */
export function ScopeForm({ value, onChange, accountsOnly }: { value: AnalysisScope; onChange: (s: AnalysisScope) => void; accountsOnly?: boolean }) {
  const accounts = useAsync(() => api.accounts(), []);
  const cats = useAsync(() => api.categories("active"), []);
  const subs = useAsync(() => api.subscriptions(), []);
  const [preset, setPreset] = React.useState<Preset>("month");
  const set = (patch: Partial<AnalysisScope>) => onChange({ ...value, ...patch });
  const choose = (p: Preset) => { setPreset(p); if (p !== "custom") onChange({ ...value, ...presetRange(p) }); };
  if ((accounts.loading && !accounts.data) || (cats.loading && !cats.data)) return <Loading />;
  const catOpts = (cats.data ?? []).flatMap((c) => [{ id: c.id, label: c.name }, ...(c.children ?? []).map((k) => ({ id: k.id, label: `${c.name} › ${k.name}`, indent: true }))]);
  return (
    <>
      <Choice label="¿De cuándo?" value={preset} onChange={choose} options={[{ id: "month", label: "Este mes" }, { id: "prev", label: "Mes pasado" }, { id: "30", label: "30 días" }, { id: "custom", label: "Fechas" }]} />
      {preset === "custom" && (
        <>
          <DateField label="Desde" value={value.from} onChange={(v) => set({ from: v })} />
          <DateField label="Hasta" value={value.to} onChange={(v) => set({ to: v })} />
        </>
      )}
      <MultiSelectField label="Cuentas" emptyText="Todas las cuentas" noun="cuentas" options={(accounts.data ?? []).filter((a) => a.status === "active").map((a) => ({ id: a.id, label: a.name }))} value={value.accountIds ?? []} onChange={(v) => set({ accountIds: v })} />
      {!accountsOnly && <MultiSelectField label="Categorías" emptyText="Todas las categorías" noun="categorías" options={catOpts} value={value.categoryIds ?? []} onChange={(v) => set({ categoryIds: v })} />}
      {!accountsOnly && ((subs.data ?? []).length > 0
        ? <MultiSelectField label="Servicios compartidos" emptyText="No incluir" noun="servicios" hint="Si no eliges ninguno, los cobros y pagos de servicios compartidos no entran al análisis." options={(subs.data ?? []).map((s) => ({ id: s.id, label: s.name }))} value={value.subscriptionIds ?? []} onChange={(v) => set({ subscriptionIds: v })} />
        : <Txt size={12} muted>Aún no tienes servicios compartidos.</Txt>)}
    </>
  );
}

export const initialScope = (): AnalysisScope => ({ ...presetRange("month") });
