import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";

interface EVAModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  primaryButtonText?: string;
  onPrimaryAction?: () => void;
  secondaryButtonText?: string;
  onSecondaryAction?: () => void;
  scrollEnabled?: boolean;
  isSuccess?: boolean;
  isDestructive?: boolean;
}

export default function EVAModal({
  visible,
  title,
  onClose,
  children,
  primaryButtonText = "Guardar",
  onPrimaryAction,
  secondaryButtonText = "Cancelar",
  onSecondaryAction,
  scrollEnabled = true,
  isSuccess = false,
  isDestructive = false,
}: EVAModalProps) {
  const { colors, fonts, isDark } = useAppTheme();

  const primaryBg = isSuccess
    ? colors.successSurface
    : isDestructive
      ? colors.dangerSurface
      : colors.primarySurface;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.overlay}
      >
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" }
          ]}
          onPress={onClose}
        />
        
        <View
          accessibilityViewIsModal
          style={{
            width: "88%",
            maxWidth: 420,
            maxHeight: "85%",
            borderRadius: 24,
            padding: 20,
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            borderWidth: 1,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 14,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Text
              numberOfLines={2}
              accessibilityRole="header"
              style={{ flex: 1, fontSize: 20, color: colors.text, fontFamily: fonts.family.bold }}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ gap: 8 }}
            nestedScrollEnabled={true}
            scrollEnabled={scrollEnabled}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Buttons Section */}
          {(secondaryButtonText || (primaryButtonText && onPrimaryAction)) && (
            <View style={{ flexDirection: "row", gap: 10, paddingTop: 4 }}>
              {secondaryButtonText ? (
                <TouchableOpacity
                  onPress={onSecondaryAction || onClose}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    height: 48,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={{ fontSize: 15, color: colors.text, fontFamily: fonts.family.bold }}
                  >
                    {secondaryButtonText}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {primaryButtonText && onPrimaryAction ? (
                <TouchableOpacity
                  onPress={onPrimaryAction}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    height: 48,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: primaryBg,
                    shadowColor: primaryBg,
                    shadowOpacity: 0.2,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                  activeOpacity={0.8}
                  disabled={isSuccess}
                >
                  {isSuccess ? (
                    <Ionicons name="checkmark-circle" size={26} color={colors.onPrimary} />
                  ) : (
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={{ color: colors.onPrimary, fontSize: 15, fontFamily: fonts.family.bold }}
                    >
                      {primaryButtonText}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
