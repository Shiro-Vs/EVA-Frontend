import React from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import EVAModal from "../../../../components/common/EVAModal";
import { Contact } from "../../../../interfaces/Contact";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { useRemindContact } from "../../../../logic/contacts/useRemindContact";
import { getAdjustedColor } from "../../../../utils/serviceIcons";

interface RemindModalProps {
  visible: boolean;
  onClose: () => void;
  debtors: Contact[];
}

export function RemindModal({ visible, onClose, debtors }: RemindModalProps) {
  const { colors, fonts, isDark } = useAppTheme();
  const {
    selectedId,
    setSelectedId,
    loading,
    message,
    handleShare,
    handleWhatsApp
  } = useRemindContact(visible, debtors);

  const hasDebtors = debtors.length > 0;

  return (
    <EVAModal
      visible={visible}
      title="Cobranza rápida"
      onClose={onClose}
      secondaryButtonText=""
    >
      {!hasDebtors ? (
        <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.incomeStrong} />
          <Text style={{ color: colors.text, fontSize: 15, fontFamily: fonts.family.bold, textAlign: "center" }}>
            Sin deudas en esta vista
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.family.regular, textAlign: "center" }}>
            No hay personas con saldo pendiente que coincidan con el filtro actual.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 12 }}>
            <Text
              style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, marginLeft: 4, color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
            >
              ¿A quién quieres cobrar?
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingHorizontal: 4, paddingVertical: 2 }}
            >
              {debtors.map((d) => {
                const selected = selectedId === d.id;
                const tone = getAdjustedColor(d.color || colors.primary, isDark);
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSelectedId(d.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{ width: 66, alignItems: "center" }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 6,
                        borderWidth: 2,
                        backgroundColor: selected ? `${tone}22` : `${tone}14`,
                        borderColor: selected ? colors.primary : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 18, color: tone, fontFamily: fonts.family.bold }}>
                        {d.nombre.charAt(0).toUpperCase()}
                      </Text>

                      {selected && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 2,
                            backgroundColor: colors.primarySurface,
                            borderColor: colors.elevated,
                          }}
                        >
                          <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ fontSize: 11, color: selected ? colors.primary : colors.textSecondary, fontFamily: fonts.family.bold, textAlign: "center" }}
                      numberOfLines={1}
                    >
                      {d.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, marginLeft: 4 }}>
            <Text
              style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: colors.textSecondary, fontFamily: fonts.family.semiBold }}
            >
              Previsualización del mensaje
            </Text>
            {!loading && (
              <TouchableOpacity
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="Compartir mensaje"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                activeOpacity={0.6}
              >
                <Ionicons name="share-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View
            style={{ padding: 16, borderRadius: 20, marginBottom: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ paddingVertical: 32 }} />
            ) : (
              <Text
                style={{ fontSize: 14, lineHeight: 22, color: colors.text, fontFamily: fonts.family.regular }}
              >
                {message}
              </Text>
            )}
          </View>
        </>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          style={{ flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, color: colors.text, fontFamily: fonts.family.bold }}>
            {hasDebtors ? "Cancelar" : "Cerrar"}
          </Text>
        </TouchableOpacity>

        {hasDebtors && (
          <TouchableOpacity
            onPress={handleWhatsApp}
            disabled={loading || !selectedId}
            accessibilityRole="button"
            style={{
              flex: 1.5,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 48,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: colors.successSurface,
              opacity: loading || !selectedId ? 0.6 : 1,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: fonts.family.bold }}>WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>
    </EVAModal>
  );
}
