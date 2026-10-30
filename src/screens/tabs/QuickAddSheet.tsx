import React from "react";
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { QUICK_GROUPS, quickAdd, useQuickAddOpen } from "./quickAdd";

/** Hoja inferior del botón «+»: solo acciones de registrar y crear. */
export default function QuickAddSheet() {
  const open = useQuickAddOpen();
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (to: string) => { quickAdd.close(); setTimeout(() => router.push(to as never), 0); };

  return (
    <Modal transparent visible={open} animationType="slide" statusBarTranslucent onRequestClose={quickAdd.close}>
      <Pressable style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)" }} onPress={quickAdd.close} accessibilityLabel="Cerrar" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: insets.bottom + 12, maxHeight: "82%" }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: `${colors.text}20` }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 22, fontFamily: "AsapBold" }} accessibilityRole="header">¿Qué quieres hacer?</Text>
          <TouchableOpacity onPress={quickAdd.close} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {QUICK_GROUPS.map((g) => (
            <View key={g.title} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapBold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{g.title}</Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: `${colors.text}08`, overflow: "hidden" }}>
                {g.items.map((a, i) => (
                  <TouchableOpacity key={a.title} onPress={() => go(a.to)} activeOpacity={0.7} accessibilityRole="button"
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.text}08` }}>
                    <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12` }}>
                      <Ionicons name={a.icon as never} size={20} color={colors.primary} />
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
        </ScrollView>
      </View>
    </Modal>
  );
}
