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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color, fontSize: 11, fontFamily: "AsapBold" }}>{text}</Text>
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
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onMenu} accessibilityRole="button" accessibilityLabel="Acciones del servicio" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: `${tone}26` }}>
          <ServiceIcon name={service.icon || "receipt"} size={32} color={tone} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontFamily: "AsapBold" }}>{service.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "AsapMedium" }}>
            <Text style={{ color: colors.text, fontFamily: "AsapBold" }}>{formatSoles(service.terms?.announcedPrice)}</Text> · {intervalLabel(service.terms?.interval)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            <Chip icon={shared ? "people-outline" : "person-outline"} text={shared ? `Compartido · ${service.occupiedSeats}/${service.capacity}` : "Personal"} color={colors.primary} bg={`${colors.primary}1A`} />
            {end && d !== null && <Chip icon="calendar-outline" text={`Renueva ${whenText(d)}`} color={soon ? colors.warningStrong : colors.textSecondary} bg={soon ? `${colors.warning}26` : `${colors.text}10`} />}
            <Chip icon="card-outline" text={accountName || "Sin cuenta"} color={colors.textSecondary} bg={`${colors.text}10`} />
          </View>
        </View>
      </View>

      {(
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border }}>
          {((shared ? ["ciclo", "participantes", "historial"] : ["ciclo", "historial"]) as ServiceTab[]).map((tab) => {
            const on = activeTab === tab;
            return (
              <TouchableOpacity key={tab} onPress={() => onSwitchTab(tab)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: on ? colors.primarySurface : "transparent" }}>
                <Text style={{ fontFamily: "AsapBold", fontSize: 12, color: on ? colors.onPrimary : colors.textSecondary }}>{tab === "ciclo" ? "Ciclo" : tab === "historial" ? "Historial" : "Participantes"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default ServiceHeader;
