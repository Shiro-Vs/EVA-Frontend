import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceIcon } from "../../../../utils/serviceIcons";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { Subscription } from "../../../../api/types";
import { humanDate } from "../../../../utils/dates";
import { intervalLabel } from "../../../../utils/intervals";
import { formatSoles } from "../../../../utils/money";

interface ServiceHeaderProps {
  service: Subscription;
  accountName: string | null;
  onBack: () => void;
  onEdit: () => void;
  activeTab: "participantes" | "historial";
  onSwitchTab: (tab: "participantes" | "historial") => void;
}

export const ServiceHeader: React.FC<ServiceHeaderProps> = ({ service, accountName, onBack, onEdit, activeTab, onSwitchTab }) => {
  const { colors, fonts } = useAppTheme();
  const shared = service.mode === "shared";
  const tint = service.color || colors.primary;

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 24, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <TouchableOpacity onPress={onBack} accessibilityLabel="Volver" style={{ width: 40, height: 40, backgroundColor: colors.card, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginRight: 16, backgroundColor: `${tint}15` }}>
          <ServiceIcon name={service.icon || "receipt"} size={32} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.family.bold, fontSize: 24 }}>{service.name}</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.medium, fontSize: 14, marginTop: 4 }}>
            {formatSoles(service.terms?.announcedPrice)} • {intervalLabel(service.terms?.interval)}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: `${colors.textSecondary}10`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8, marginBottom: 4 }}>
              <Ionicons name="card-outline" size={10} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 10, marginLeft: 4 }}>{accountName || "Sin cuenta"}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: `${colors.primary}10`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8, marginBottom: 4 }}>
              <Ionicons name={shared ? "people-outline" : "person-outline"} size={10} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: fonts.family.bold, fontSize: 10, marginLeft: 4 }}>{shared ? "Compartido" : "Individual"}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: `${colors.warning}10`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 }}>
              <Ionicons name="calendar-outline" size={10} color={colors.warning} />
              <Text style={{ color: colors.warningStrong, fontFamily: fonts.family.bold, fontSize: 10, marginLeft: 4 }}>
                Renueva {humanDate(service.currentCycle?.endDate)}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={onEdit} accessibilityLabel="Editar servicio" style={{ width: 40, height: 40, backgroundColor: `${colors.primary}15`, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
          <Ionicons name="pencil" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5, width: "100%", marginBottom: 16 }} />

      {shared && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, padding: 4 }}>
          {(["historial", "participantes"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8,
                backgroundColor: activeTab === tab ? colors.background : "transparent",
                shadowColor: activeTab === tab ? "#000" : "transparent", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
                elevation: activeTab === tab ? 2 : 0,
              }}
              onPress={() => onSwitchTab(tab)}
              accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }}
            >
              <Text style={{ fontFamily: fonts.family.bold, fontSize: 12, color: activeTab === tab ? colors.primary : colors.textSecondary }}>
                {tab === "historial" ? "Historial de Pagos" : "Participantes"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default ServiceHeader;
