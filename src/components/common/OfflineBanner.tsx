import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { connectivity, useConnectivity } from "../../api/connectivity";
import { session } from "../../api/http";
import { useAppTheme } from "../../hooks/useAppTheme";
import { humanDate, todayLocalIso } from "../../utils/dates";

/** Aviso fijo cuando se muestran datos guardados por falta de conexión (RN-OF02). Se reintenta solo cada 20 segundos. */
export default function OfflineBanner() {
  const { offline, dataAt } = useConnectivity();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      const base = (await session.getBaseUrl()).replace(/\/v1\/?$/, "");
      const r = await fetch(`${base}/healthz`);
      if (r.ok) connectivity.setOnline();
    } catch { /* sigue sin conexión */ }
    setBusy(false);
  };
  useEffect(() => {
    if (!offline) return;
    const t = setInterval(() => { void retry(); }, 20_000);
    return () => clearInterval(t);
  }, [offline]);

  if (!offline) return null;
  const when = dataAt ? `${humanDate(todayLocalIso(new Date(dataAt)))} ${new Date(dataAt).toTimeString().slice(0, 5)}` : "";
  return (
    <View accessibilityRole="alert" style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: colors.alert.warning.bg, borderBottomWidth: 1, borderBottomColor: colors.alert.warning.border, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: "AsapBold", fontSize: 12 }}>Sin conexión</Text>
        <Text style={{ color: colors.text, fontFamily: "Asap", fontSize: 11 }}>Estás viendo datos guardados{when ? ` del ${when}` : ""}. Registrar y editar se habilita al reconectar.</Text>
      </View>
      <TouchableOpacity onPress={retry} disabled={busy} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.alert.warning.border }}>
        <Text style={{ color: colors.text, fontFamily: "AsapMedium", fontSize: 12 }}>{busy ? "…" : "Reintentar"}</Text>
      </TouchableOpacity>
    </View>
  );
}
