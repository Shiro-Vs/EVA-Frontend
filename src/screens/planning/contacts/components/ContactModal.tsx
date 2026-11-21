import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EVAModal from "../../../../components/common/EVAModal";
import { Contact } from "../../../../interfaces/Contact";
import { PRESET_COLORS, getAdjustedColor } from "../../../../utils/serviceIcons";
import { useContactModal } from "../../../../logic/contacts/useContactModal";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { EVAInput } from "../../../../components/common/EVAInput";
import { EVASeparator } from "../../../../components/common/EVASeparator";

const isLightHex = (hex: string) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
};

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  contactDraft: Omit<Contact, "id">;
  setContactDraft: React.Dispatch<React.SetStateAction<Omit<Contact, "id">>>;
  isEditing: boolean;
}

export function ContactModal({
  visible,
  onClose,
  onSave,
  contactDraft,
  setContactDraft,
  isEditing,
}: ContactModalProps) {
  const { colors, fonts, isDark } = useAppTheme();
  const { errors, validateAndSave, clearErrors } = useContactModal(contactDraft, onSave);

  return (
    <EVAModal
      visible={visible}
      title={isEditing ? "Editar contacto" : "Nuevo contacto"}
      onClose={onClose}
      primaryButtonText={isEditing ? "Guardar" : "Crear"}
      onPrimaryAction={validateAndSave}
    >
      <View style={{ gap: 4 }}>
        <EVAInput
          label="Nombre completo"
          value={contactDraft.nombre}
          onChangeText={(text) => {
            setContactDraft((prev) => ({ ...prev, nombre: text }));
            clearErrors();
          }}
          placeholder="Ej. Juan Pérez"
          error={errors.nombre}
        />

        <EVASeparator />
        <Text
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, marginLeft: 4, color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
        >
          Color identificador
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}
          style={{ marginBottom: 8 }}
        >
          {PRESET_COLORS.map((c) => {
            const adjustedColor = getAdjustedColor(c, isDark);
            const isSelected = contactDraft.color === c;
            const checkColor = isLightHex(adjustedColor) ? "#06141B" : "#FFFFFF";
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setContactDraft((prev) => ({ ...prev, color: c }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Color ${c}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: adjustedColor,
                  borderWidth: isSelected ? 3 : 0,
                  borderColor: colors.text,
                  opacity: isSelected ? 1 : 0.85,
                }}
                activeOpacity={0.8}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={checkColor} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <EVASeparator />
        <Text
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, marginLeft: 4, color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
        >
          Información opcional
        </Text>
        <EVAInput
          icon={<Ionicons name="call-outline" size={20} color={colors.muted} />}
          value={contactDraft.telefono}
          onChangeText={(text) => setContactDraft((prev) => ({ ...prev, telefono: text }))}
          placeholder="Teléfono (opcional)"
          keyboardType="phone-pad"
        />
        <EVAInput
          icon={<Ionicons name="mail-outline" size={20} color={colors.muted} />}
          value={contactDraft.email}
          onChangeText={(text) => setContactDraft((prev) => ({ ...prev, email: text }))}
          placeholder="Correo (opcional)"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <EVAInput
          icon={<Ionicons name="document-text-outline" size={20} color={colors.muted} />}
          value={contactDraft.notas}
          onChangeText={(text) => setContactDraft((prev) => ({ ...prev, notas: text }))}
          placeholder="Notas (opcional)"
        />
      </View>
    </EVAModal>
  );
}
