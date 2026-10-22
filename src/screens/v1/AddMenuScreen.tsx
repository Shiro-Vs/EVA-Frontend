import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";

const ACTIONS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; text: string; to: string }> = [
  { icon: "cash-outline", title: "Registrar un cobro", text: "Elige a la persona que te pagó", to: "/contacts" },
  { icon: "calendar-outline", title: "Nuevo servicio", text: "Netflix, Spotify… con su calendario", to: "/service/new" },
  { icon: "wallet-outline", title: "Nueva cuenta", text: "Banco, efectivo, billetera o tarjeta", to: "/account/new" },
  { icon: "person-add-outline", title: "Nuevo contacto", text: "Alguien que comparte un servicio", to: "/contacts" },
];

export default function AddMenuScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <Screen title="¿Qué quieres hacer?" back={false}>
      {ACTIONS.map((a) => (
        <RowLink key={a.title} onPress={() => router.push(a.to as never)}>
          <Ionicons name={a.icon} size={24} color={colors.primary} />
          <View style={{ flex: 1 }}><Txt bold>{a.title}</Txt><Txt size={12} muted>{a.text}</Txt></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </RowLink>
      ))}
    </Screen>
  );
}
