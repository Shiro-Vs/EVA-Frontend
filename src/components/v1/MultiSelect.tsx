import React, { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import BottomSheet from "../common/BottomSheet";
import type { SelectOption } from "./Select";

/**
 * Selección múltiple en una hoja: el campo resume lo elegido («Todas», «BCP y Yape», «3 cuentas») y la lista abre con casillas.
 * Reemplaza a una pared de etiquetas cuando hay muchas opciones.
 */
export function MultiSelectField({ label, options, value, onChange, emptyText = "Todas", noun = "elegidas", hint }: {
  label?: string; options: Array<SelectOption & { indent?: boolean }>; value: string[]; onChange: (v: string[]) => void;
  /** Qué se muestra cuando no hay nada elegido. */
  emptyText?: string; noun?: string; hint?: string;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const short = (l: string) => l.replace(/^.* › /, "");
  const names = value.map((id) => options.find((o) => o.id === id)?.label).filter((l): l is string => !!l).map(short);
  const summary = value.length === 0 ? emptyText : names.length <= 2 ? names.join(" y ") : `${value.length} ${noun}`;
  const searchable = options.length > 8;
  const shown = useMemo(() => (q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options), [options, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const close = () => { setOpen(false); setQ(""); };

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 }}>{label}</Text> : null}
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${label ?? "Elegir"}: ${summary}`}
        style={{ minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: value.length ? colors.primary : colors.borderStrong, backgroundColor: colors.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: value.length ? colors.text : colors.textSecondary, fontSize: 15, fontFamily: value.length ? "AsapBold" : "Asap" }}>{summary}</Text>
        {value.length > 0 ? (
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
            <Text style={{ color: colors.onPrimary, fontSize: 11, fontFamily: "AsapBold" }}>{value.length}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {hint ? <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", marginTop: 4, marginLeft: 4 }}>{hint}</Text> : null}

      <BottomSheet visible={open} onClose={close} title={label ?? "Elegir"} maxHeight={0.75}>
        {searchable && (
          <View style={{ marginHorizontal: 8, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.card }}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.text, fontFamily: "Asap", fontSize: 14 }} />
          </View>
        )}
        {shown.map((o) => {
          const on = value.includes(o.id);
          return (
            <TouchableOpacity key={o.id} onPress={() => toggle(o.id)} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ minHeight: 46, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 10 + (o.indent && !q.trim() ? 22 : 0), paddingRight: 10, borderRadius: 14, backgroundColor: on ? `${colors.primary}14` : "transparent" }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.primarySurface : colors.borderStrong, backgroundColor: on ? colors.primarySurface : "transparent", alignItems: "center", justifyContent: "center" }}>
                {on ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: o.indent ? "Asap" : "AsapMedium" }}>{o.indent && !q.trim() ? short(o.label) : o.label}</Text>
              {o.hint ? <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{o.hint}</Text> : null}
            </TouchableOpacity>
          );
        })}
        {shown.length === 0 && <Text style={{ color: colors.textSecondary, fontFamily: "Asap", padding: 16, textAlign: "center" }}>Sin resultados.</Text>}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 4 }}>
          <TouchableOpacity onPress={() => onChange([])} disabled={value.length === 0} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14`, opacity: value.length === 0 ? 0.5 : 1 }}>
            <Text style={{ color: colors.primary, fontFamily: "AsapBold", fontSize: 14 }}>Quitar selección</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
            <Text style={{ color: colors.onPrimary, fontFamily: "AsapBold", fontSize: 14 }}>Listo</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}
