import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import BottomSheet from "../../components/common/BottomSheet";
import { useAppTheme } from "../../hooks/useAppTheme";
import { CREATE_ACTIONS, FEATURED_ACTIONS, PRIMARY_MOVEMENTS, quickAdd, useQuickAddOpen, type QuickTone } from "./quickAdd";

/** Hoja inferior del botón «+»: movimientos en 1 toque, registro rápido y grilla limpia de creación. */
export default function QuickAddSheet() {
  const open = useQuickAddOpen();
  const { colors } = useAppTheme();
  const router = useRouter();

  const go = (to: string) => {
    quickAdd.close();
    setTimeout(() => router.push(to as never), 0);
  };

  const toneColor = (t: QuickTone) =>
    t === "expense" ? colors.expenseStrong : t === "income" ? colors.incomeStrong : colors.primary;

  // Empareja las opciones de creación de 2 en 2 para alinearlas en grilla limpia.
  const createRows: Array<[typeof CREATE_ACTIONS[number], typeof CREATE_ACTIONS[number] | undefined]> = [];
  for (let i = 0; i < CREATE_ACTIONS.length; i += 2) {
    createRows.push([CREATE_ACTIONS[i]!, CREATE_ACTIONS[i + 1]]);
  }

  return (
    <BottomSheet visible={open} onClose={quickAdd.close} title="¿Qué quieres registrar?" maxHeight={0.86}>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 14 }}>
        {/* 1. Movimientos principales en 1 toque */}
        <View style={{ gap: 6 }}>
          <Label>Movimiento rápido</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {PRIMARY_MOVEMENTS.map((m) => {
              const ink = toneColor(m.tone);
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => go(m.to)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name={m.icon} size={25} color={ink} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>
                    {m.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Comprobante con IA y cobro */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FEATURED_ACTIONS.map((a) => {
            const ink = colors.sections[a.section].ink;
            return (
              <TouchableOpacity
                key={a.title}
                onPress={() => go(a.to)}
                activeOpacity={0.78}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 13,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Ionicons name={a.icon} size={22} color={ink} />
                  <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                </View>
                <View style={{ gap: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{a.title}</Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>{a.text}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. Crear nuevo (grilla compacta 2 columnas, íconos limpios sin fondo) */}
        <View style={{ gap: 6 }}>
          <Label>Crear nuevo</Label>
          <View style={{ gap: 8 }}>
            {createRows.map(([left, right], ri) => (
              <View key={ri} style={{ flexDirection: "row", gap: 8 }}>
                {[left, right].map((item, ci) =>
                  item ? (
                    <TouchableOpacity
                      key={item.title}
                      onPress={() => go(item.to)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: colors.card,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 11,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Ionicons name={item.icon} size={20} color={colors.sections[item.section].ink} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>{item.title}</Text>
                        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{item.text}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View key={`empty-${ci}`} style={{ flex: 1 }} />
                  ),
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

function Label({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapBold", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
      {children}
    </Text>
  );
}
