import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../hooks/useAppTheme";
import BottomSheet from "../../components/common/BottomSheet";
import { QUICK_GROUPS, quickAdd, useQuickAddOpen } from "./quickAdd";

/** Hoja inferior del botón «+»: solo acciones de registrar y crear. */
export default function QuickAddSheet() {
  const open = useQuickAddOpen();
  const { colors } = useAppTheme();
  const router = useRouter();

  const go = (to: string) => { quickAdd.close(); setTimeout(() => router.push(to as never), 0); };

  return (
    <BottomSheet visible={open} onClose={quickAdd.close} title="¿Qué quieres hacer?" maxHeight={0.82}>
      {QUICK_GROUPS.map((g) => (
        <View key={g.title} style={{ marginTop: 8, paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapBold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{g.title}</Text>
          <View style={{ backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: `${colors.text}08`, overflow: "hidden" }}>
            {g.items.map((a, i) => (
              <TouchableOpacity key={a.title} onPress={() => go(a.to)} activeOpacity={0.7} accessibilityRole="button"
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.text}08` }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sections[a.section].tint }}>
                  <Ionicons name={a.icon as never} size={20} color={colors.sections[a.section].ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{a.title}</Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{a.text}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}
