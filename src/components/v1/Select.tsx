import React, { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import BottomSheet from "../common/BottomSheet";

export interface SelectOption<T extends string = string> { id: T; label: string; hint?: string }

/** Campo de selección: muestra lo elegido y abre una hoja con la lista (no crece con la cantidad de opciones). */
export function SelectField<T extends string>({ label, value, options, onChange, placeholder = "Elegir…", clearLabel, onClear }: {
  label?: string; value: T | null; options: Array<SelectOption<T>>; onChange: (v: T) => void; placeholder?: string;
  /** Si se indica, la lista incluye una primera fila (p. ej. «Ninguna») que llama a `onClear`. */
  clearLabel?: string; onClear?: () => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.id === value) ?? null;
  const searchable = options.length > 8;
  const shown = useMemo(() => (q.trim() ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : options), [options, q]);
  const close = () => { setOpen(false); setQ(""); };
  const pick = (fn: () => void) => { fn(); close(); };

  return (
    <View style={{ marginBottom: 4 }}>
      {label ? <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 }}>{label}</Text> : null}
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${label ?? "Elegir"}: ${current?.label ?? "sin elegir"}`}
        style={{ minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: current ? colors.text : colors.muted, fontSize: 15, fontFamily: current ? "AsapBold" : "Asap" }}>{current ? current.label : placeholder}</Text>
        {current?.hint ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", maxWidth: "40%" }}>{current.hint}</Text> : null}
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={close} title={label ?? "Elegir"} maxHeight={0.7}>
        {searchable && (
          <View style={{ marginHorizontal: 8, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.card }}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.text, fontFamily: "Asap", fontSize: 14 }} />
          </View>
        )}
        {clearLabel && onClear && <Row label={clearLabel} selected={value === null} onPress={() => pick(onClear)} muted />}
        {shown.map((o) => <Row key={o.id} label={o.label} hint={o.hint} selected={o.id === value} onPress={() => pick(() => onChange(o.id))} />)}
        {shown.length === 0 && <Text style={{ color: colors.textSecondary, fontFamily: "Asap", padding: 16, textAlign: "center" }}>Sin resultados.</Text>}
      </BottomSheet>
    </View>
  );
}

function Row({ label, hint, selected, onPress, muted }: { label: string; hint?: string; selected: boolean; onPress: () => void; muted?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ selected }}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: selected ? `${colors.primary}14` : "transparent" }}>
      <Text numberOfLines={1} style={{ flex: 1, color: muted ? colors.textSecondary : colors.text, fontSize: 15, fontFamily: selected ? "AsapBold" : "Asap" }}>{label}</Text>
      {hint ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", maxWidth: "40%" }}>{hint}</Text> : null}
      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}
