import React from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EVAModal from "../../../../components/common/EVAModal";
import EVAAlert from "../../../../components/common/EVAAlert";
import { Contact } from "../../../../interfaces/Contact";
import { useAddSubscriber } from "../../../../logic/contacts/useAddSubscriber";
import { ServiceIcon } from "../../../../utils/serviceIcons";

import { useAppTheme } from "../../../../hooks/useAppTheme";

interface AddSubscriberModalProps {
  visible: boolean;
  onClose: () => void;
  contact: Contact | null;
  onSuccess?: () => void;
}

export function AddSubscriberModal({ visible, onClose, contact }: AddSubscriberModalProps) {
  const { colors, fonts } = useAppTheme();
  
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
        secondaryButtonText="Cerrar"
      >
        <View className="mb-6">
          <Text 
            className="text-[10px] uppercase tracking-widest mb-4 ml-1"
            style={{ color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
          >
            Elegir Servicio
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} className="py-4" />
          ) : services.length === 0 ? (
            <View 
              className="p-6 rounded-2xl items-center"
              style={{ backgroundColor: colors.card }}
            >
              <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.income} />
              <Text 
                className="text-[11px] text-center mt-2"
                style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
              >
                No hay servicios compartidos con plazas libres
              </Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              className="flex-row -mx-2 px-2"
            >
              {services.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedServiceId(s.id)}
                  className="mr-3 items-center p-3 rounded-2xl border"
                  style={{ 
                    width: 100,
                    backgroundColor: selectedServiceId === s.id ? `${colors.primary}15` : colors.card,
                    borderColor: selectedServiceId === s.id ? colors.primary : "transparent"
                  }}
                >
                  <ServiceIcon name={s.icon ?? "receipt"} color={s.color ?? "#3B82F6"} size={24} />
                  <Text 
                    className="text-[10px] text-center mt-2"
                    style={{ color: selectedServiceId === s.id ? colors.primary : colors.textSecondary, fontFamily: fonts.family.bold }}
                    numberOfLines={1}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
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
