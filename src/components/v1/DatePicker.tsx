import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../common/BottomSheet";
import { useAppTheme } from "../../hooks/useAppTheme";
import { MONTHS_ES, WEEKDAYS_ES, formatDateTyping, monthGrid, parseIso, shiftMonth, toIso } from "../../utils/calendar";
import { todayLocalIso } from "../../utils/dates";
import { Field } from "./ui";

/** Calendario en una hoja inferior: elige un día, cambia de mes con las flechas y de año tocando el título. */
export function CalendarSheet({ visible, value, onSelect, onClose, title = "Elegir fecha" }: { visible: boolean; value: string; onSelect: (iso: string) => void; onClose: () => void; title?: string }) {
  const { colors } = useAppTheme();
  const today = todayLocalIso();
  const start = parseIso(value) ?? parseIso(today)!;
  const [view, setView] = useState({ year: start.year, month: start.month });
  const [mode, setMode] = useState<"days" | "months">("days");
  const sel = parseIso(value);
  const t = parseIso(today)!;

  // Cada vez que se abre vuelve al mes de la fecha elegida.
  React.useEffect(() => { if (visible) { const s = parseIso(value) ?? parseIso(todayLocalIso())!; setView({ year: s.year, month: s.month }); setMode("days"); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDay = (d: number) => { onSelect(toIso(view.year, view.month, d)); onClose(); };
  const Nav = ({ icon, onPress, label }: { icon: "chevron-back" | "chevron-forward"; onPress: () => void; label: string }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12` }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scrollable={false} maxHeight={0.8}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Nav icon="chevron-back" label={mode === "days" ? "Mes anterior" : "Año anterior"} onPress={() => setView((v) => (mode === "days" ? shiftMonth(v.year, v.month, -1) : { ...v, year: v.year - 1 }))} />
        <TouchableOpacity onPress={() => setMode((m) => (m === "days" ? "months" : "days"))} accessibilityRole="button" accessibilityLabel="Cambiar mes o año" style={{ paddingHorizontal: 12, minHeight: 40, justifyContent: "center" }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{mode === "days" ? `${MONTHS_ES[view.month - 1]} ${view.year}` : String(view.year)} ▾</Text>
        </TouchableOpacity>
        <Nav icon="chevron-forward" label={mode === "days" ? "Mes siguiente" : "Año siguiente"} onPress={() => setView((v) => (mode === "days" ? shiftMonth(v.year, v.month, 1) : { ...v, year: v.year + 1 }))} />
      </View>

      {mode === "months" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingVertical: 6 }}>
          {MONTHS_ES.map((m, i) => {
            const on = view.month === i + 1;
            return (
              <TouchableOpacity key={m} onPress={() => { setView((v) => ({ ...v, month: i + 1 })); setMode("days"); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ width: "30%", minHeight: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.primarySurface : `${colors.primary}10` }}>
                <Text style={{ color: on ? colors.onPrimary : colors.text, fontFamily: "AsapMedium", fontSize: 14 }}>{m.slice(0, 3)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: "row" }}>
            {WEEKDAYS_ES.map((w, i) => <Text key={i} style={{ flex: 1, textAlign: "center", color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", paddingVertical: 6 }}>{w}</Text>)}
          </View>
          {monthGrid(view.year, view.month).map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row" }}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={{ flex: 1, height: 42 }} />;
                const on = !!sel && sel.year === view.year && sel.month === view.month && sel.day === d;
                const isToday = t.year === view.year && t.month === view.month && t.day === d;
                return (
                  <TouchableOpacity key={di} onPress={() => pickDay(d)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${d} de ${MONTHS_ES[view.month - 1]} de ${view.year}`}
                    style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.primarySurface : "transparent", borderWidth: isToday && !on ? 1.5 : 0, borderColor: colors.primary }}>
                      <Text style={{ color: on ? colors.onPrimary : colors.text, fontFamily: on || isToday ? "AsapBold" : "Asap", fontSize: 14 }}>{d}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <TouchableOpacity onPress={() => { onSelect(today); onClose(); }} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}>
          <Text style={{ color: colors.primary, fontFamily: "AsapBold", fontSize: 14 }}>Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontFamily: "AsapMedium", fontSize: 14 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

/**
 * Campo de fecha: se puede escribir (solo números; los guiones se ponen solos → AAAA-MM-DD) o elegir en el calendario.
 * El valor que entrega es siempre texto parcial mientras se escribe y «AAAA-MM-DD» cuando está completo.
 */
export function DateInput({ label, value, onChange, optional, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean; placeholder?: string; error?: string }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const bad = value !== "" && value.length === 10 && !parseIso(value);
  const incomplete = value !== "" && value.length < 10;
  return (
    <>
      <Field
        label={`${label}${optional ? " (opcional)" : ""}`}
        value={value}
        onChangeText={(t) => onChange(formatDateTyping(t))}
        placeholder={placeholder ?? todayLocalIso()}
        keyboardType="number-pad"
        maxLength={10}
        error={error ?? (bad ? "Esa fecha no existe" : incomplete ? "Escribe AAAA-MM-DD o usa el calendario" : undefined)}
        rightAction={
          <TouchableOpacity onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Abrir calendario: ${label}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      <CalendarSheet visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} title={label} />
    </>
  );
}
