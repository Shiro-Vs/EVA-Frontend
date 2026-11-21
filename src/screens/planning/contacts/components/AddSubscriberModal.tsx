import React from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EVAModal from "../../../../components/common/EVAModal";
import EVAAlert from "../../../../components/common/EVAAlert";
import { Contact } from "../../../../interfaces/Contact";
import { useAddSubscriber } from "../../../../logic/contacts/useAddSubscriber";
import { getAdjustedColor, ServiceIcon } from "../../../../utils/serviceIcons";

import { useAppTheme } from "../../../../hooks/useAppTheme";

interface AddSubscriberModalProps {
  visible: boolean;
  onClose: () => void;
  contact: Contact | null;
  onSuccess?: () => void;
}

export function AddSubscriberModal({ visible, onClose, contact }: AddSubscriberModalProps) {
  const { colors, fonts, isDark } = useAppTheme();
  
  const {
    services,
    loading,
    selectedServiceId,
    setSelectedServiceId,
    alertConfig,
    setAlertConfig,
    handleSave
  } = useAddSubscriber(visible, contact, onClose);

  if (!contact) return null;

  return (
    <>
      <EVAModal
        visible={visible}
        title={`Asignar a ${contact.nombre}`}
        onClose={onClose}
        primaryButtonText={
          services.length === 0
            ? "Entendido"
            : (selectedServiceId ? "Continuar" : undefined)
        }
        onPrimaryAction={services.length === 0 ? onClose : handleSave}
        secondaryButtonText={services.length === 0 ? "" : "Cerrar"}
      >
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
          >
            Elegir servicio
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
          ) : services.length === 0 ? (
            <View
              style={{ padding: 16, borderRadius: 16, alignItems: "center", backgroundColor: colors.card }}
            >
              <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.incomeStrong} />
              <Text
                style={{ fontSize: 12, textAlign: "center", marginTop: 8, color: colors.textSecondary, fontFamily: fonts.family.regular }}
              >
                No hay servicios compartidos con plazas libres
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 2 }}
            >
              {services.map((s) => {
                const selected = selectedServiceId === s.id;
                const iconColor = getAdjustedColor(s.color || colors.primary, isDark);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelectedServiceId(s.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{
                      width: 104,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      backgroundColor: selected ? `${colors.primary}15` : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                  >
                    <ServiceIcon name={s.icon ?? "receipt"} color={iconColor} size={24} />
                    <Text
                      style={{ fontSize: 11, textAlign: "center", marginTop: 8, color: selected ? colors.primary : colors.textSecondary, fontFamily: fonts.family.bold }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

      </EVAModal>

      <EVAAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onDismiss={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}
