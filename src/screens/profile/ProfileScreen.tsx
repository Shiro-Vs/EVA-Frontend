import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAppThemeContext } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api, errorMessage } from "../../api/client";
import { EVAInput } from "../../components/common/EVAInput";
import EVAAlert from "../../components/common/EVAAlert";

export default function ProfileScreen() {
  const { theme, toggleTheme } = useAppThemeContext();
  const { colors, fonts } = useAppTheme();
  const { logout, profile, setProfile } = useAuth();

  const [freeDays, setFreeDays] = useState(String(profile?.defaultFreeDays ?? 0));
  const [limit, setLimit] = useState(profile?.exitDaysLimit == null ? "" : String(profile.exitDaysLimit));
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ visible: boolean; title: string; message: string; type: "success" | "error" | "warning" }>({
    visible: false, title: "", message: "", type: "success",
  });

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 px-6 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const saveSettings = async () => {
    const g = Number.parseInt(freeDays, 10);
    const l = limit.trim() === "" ? null : Number.parseInt(limit, 10);
    if (!Number.isInteger(g) || g < 0 || (l !== null && (!Number.isInteger(l) || l < 0))) {
      setAlert({ visible: true, title: "Dato inválido", message: "Usa números enteros de 0 en adelante.", type: "warning" });
      return;
    }
    setSaving(true);
    try {
      setProfile(await api.patchMe({ defaultFreeDays: g, exitDaysLimit: l }, profile.version));
      setAlert({ visible: true, title: "¡Guardado!", message: "Rige para los ingresos nuevos; los cargos ya emitidos no cambian.", type: "success" });
    } catch (e) {
      setAlert({ visible: true, title: "No se pudo guardar", message: errorMessage(e), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const label = { color: colors.textSecondary, fontFamily: fonts.family.semiBold };

  return (
    <SafeAreaView className="flex-1 px-6" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="items-center mt-10 mb-8">
          <View
            className="w-24 h-24 rounded-full items-center justify-center border-4 shadow-sm"
            style={{ backgroundColor: `${colors.primary}10`, borderColor: colors.card }}
          >
            <Ionicons name="person" size={50} color={colors.primary} />
          </View>
          <Text className="font-asap-bold text-2xl mt-4" style={{ color: colors.text }}>
            {profile.displayName}
          </Text>
          <Text className="font-asap" style={{ color: colors.textSecondary }}>
            {profile.email}
          </Text>
        </View>

        <Text className="text-[10px] uppercase tracking-widest mb-3 ml-1" style={label}>Ajustes de cobro</Text>
        <View className="rounded-3xl border p-5 mb-8" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <EVAInput label="Días gratis al incorporar (g)" value={freeDays} onChangeText={setFreeDays} keyboardType="number-pad" />
          <Text className="text-xs mb-4 -mt-2 ml-1" style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}>
            Si a la persona le faltan g días o menos para la renovación, ese tramo inicial es gratis. 0 = nunca.
          </Text>
          <EVAInput label="Días para terminar el ciclo en una baja (L)" value={limit} onChangeText={setLimit} keyboardType="number-pad" placeholder="Sin definir" />
          <TouchableOpacity
            onPress={saveSettings}
            disabled={saving}
            className="h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color="white" /> : <Text className="text-white" style={{ fontFamily: fonts.family.bold }}>Guardar ajustes</Text>}
          </TouchableOpacity>
        </View>

        <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <TouchableOpacity
            className="flex-row items-center p-5 border-b"
            style={{ borderBottomColor: `${colors.text}05` }}
            onPress={() => router.push("/account/new")}
          >
            <View className="w-8 items-center">
              <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            </View>
            <Text className="flex-1 ml-3 font-asap-medium" style={{ color: colors.text }}>
              Nueva cuenta
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center p-5 border-b"
            style={{ borderBottomColor: `${colors.text}05` }}
            onPress={toggleTheme}
          >
            <View className="w-8 items-center">
              <Ionicons name={theme === "light" ? "moon-outline" : "sunny-outline"} size={22} color={colors.primary} />
            </View>
            <Text className="flex-1 ml-3 font-asap-medium" style={{ color: colors.text }}>
              Cambiar Tema
            </Text>
            <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontFamily: "AsapBold" }}>
                {theme === "light" ? "CLÁSICO" : "SLATE"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center p-5" onPress={handleLogout}>
            <View className="w-8 items-center">
              <Ionicons name="log-out-outline" size={22} color={colors.expense} />
            </View>
            <Text className="flex-1 ml-3 font-asap-medium" style={{ color: colors.expense }}>
              Cerrar Sesión
            </Text>
          </TouchableOpacity>
        </View>
        <View className="h-24" />
      </ScrollView>

      <EVAAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((p) => ({ ...p, visible: false }))}
        onDismiss={() => setAlert((p) => ({ ...p, visible: false }))}
      />
    </SafeAreaView>
  );
}
