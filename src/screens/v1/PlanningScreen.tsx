import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { Button, Empty, ErrorBox, Loading, Money, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanRange } from "../../utils/dates";

export default function PlanningScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const subs = useAsync(() => api.subscriptions(), []);
  useFocusReload(subs.reload);

  return (
    <Screen title="Planes" back={false}>
      <RowLink onPress={() => router.push("/contacts")}>
        <Ionicons name="people" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Txt bold>Contactos</Txt>
          <Txt size={12} muted>Quién participa y cuánto debe</Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </RowLink>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <Txt bold size={18}>Servicios</Txt>
        <TouchableOpacity onPress={() => router.push("/service/new")} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontFamily: "AsapBold" }}>+ Nuevo servicio</Text>
        </TouchableOpacity>
      </View>

      {subs.loading && !subs.data ? <Loading /> : subs.error ? <ErrorBox message={subs.error} onRetry={subs.reload} /> : (subs.data ?? []).length === 0 ? (
        <Empty icon="calendar-outline" title="Crea tu primer servicio" text="Netflix, Spotify… Registra el plan, su calendario y quién participa."
          action={<View style={{ width: "100%", marginTop: 8 }}><Button title="Nuevo servicio" onPress={() => router.push("/service/new")} /></View>} />
      ) : (subs.data ?? []).map((s) => (
        <RowLink key={s.id} onPress={() => router.push(`/service/${s.id}`)}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.primary}1A`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={s.mode === "shared" ? "people" : "person"} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold>{s.name}</Txt>
            <Txt size={12} muted>{s.mode === "shared" ? `${s.occupiedSeats} / ${s.capacity} plazas` : "Personal"}{s.currentCycle ? ` · ${humanRange(s.currentCycle.startDate, s.currentCycle.endDate)}` : ""}</Txt>
          </View>
          <Money value={s.terms?.announcedPrice ?? "0.00"} />
        </RowLink>
      ))}
    </Screen>
  );
}
