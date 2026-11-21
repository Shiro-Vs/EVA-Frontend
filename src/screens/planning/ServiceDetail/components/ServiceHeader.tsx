import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Subscription } from "../../../../api/types";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { daysUntil, whenText } from "../../../dashboard/attention";
import { todayLocalIso } from "../../../../utils/dates";
import { intervalLabel } from "../../../../utils/intervals";
import { formatSoles } from "../../../../utils/money";
import type { ServiceTab } from "../../../../logic/serviceDetail/useServiceDetail";
import { getAdjustedColor, ServiceIcon } from "../../../../utils/serviceIcons";

interface ServiceHeaderProps {
  service: Subscription;
  accountName: string | null;
  onBack: () => void;
  onMenu: () => void;
  activeTab: ServiceTab;
  onSwitchTab: (tab: ServiceTab) => void;
}

function Chip({ icon, text, color, bg }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string; bg: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: "100%" }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontFamily: "AsapBold", flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

/** Cabecera del servicio: volver y acciones, ícono con su color, nombre, precio y datos clave; con pestañas si es compartido. */
export const ServiceHeader: React.FC<ServiceHeaderProps> = ({ service, accountName, onBack, onMenu, activeTab, onSwitchTab }) => {
  const { colors, isDark } = useAppTheme();
  const shared = service.mode === "shared";
  const tone = getAdjustedColor(service.color || colors.primary, isDark);
  const end = service.currentCycle?.endDate ?? null;
  const d = end ? daysUntil(end, todayLocalIso()) : null;
  const soon = d !== null && d <= 3;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onMenu} accessibilityRole="button" accessibilityLabel="Acciones del servicio" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: `${tone}26` }}>
          <ServiceIcon name={service.icon || "receipt"} size={32} color={tone} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontFamily: "AsapBold" }}>{service.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "AsapMedium" }}>
            <Text style={{ color: colors.text, fontFamily: "AsapBold" }}>{formatSoles(service.terms?.announcedPrice)}</Text> · {intervalLabel(service.terms?.interval)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            <Chip icon={shared ? "people-outline" : "person-outline"} text={shared ? `Compartido · ${service.occupiedSeats}/${service.capacity}` : "Personal"} color={colors.primary} bg={`${colors.primary}1A`} />
            {end && d !== null && <Chip icon="calendar-outline" text={`Renueva ${whenText(d)}`} color={soon ? colors.warningStrong : colors.textSecondary} bg={soon ? `${colors.warning}26` : `${colors.text}10`} />}
            <Chip icon="card-outline" text={accountName || "Sin cuenta"} color={colors.textSecondary} bg={`${colors.text}10`} />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {((shared ? ["ciclo", "participantes", "historial"] : ["ciclo", "historial"]) as ServiceTab[]).map((tab) => {
          const on = activeTab === tab;
          const meta = tab === "ciclo" ? { label: "Ciclo", icon: "sync-outline" } : tab === "historial" ? { label: "Historial", icon: "time-outline" } : { label: "Personas", icon: "people-outline" };
          return (
            <TouchableOpacity key={tab} onPress={() => onSwitchTab(tab)} accessibilityRole="tab" accessibilityState={{ selected: on }} activeOpacity={0.7} style={{ flex: 1, minHeight: 44, justifyContent: "flex-end", alignItems: "center", paddingTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 10, paddingHorizontal: 4 }}>
                <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={16} color={on ? colors.primary : colors.muted} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: on ? "AsapBold" : "AsapMedium", fontSize: 14, color: on ? colors.text : colors.textSecondary, flexShrink: 1 }}>{meta.label}</Text>
              </View>
              <View style={{ height: 3, width: "60%", borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: on ? colors.primary : "transparent", marginBottom: -1 }} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default ServiceHeader;
