import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";

interface EVAAlertProps {
  visible: boolean;
  type?: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  iconName?: string;
  buttonText?: string;
  onClose: () => void;
  secondaryButtonText?: string;
  onSecondaryAction?: () => void;
  horizontalButtons?: boolean;
  onDismiss?: () => void;
}

export default function EVAAlert({
  visible,
  type = "info",
  title,
  message,
  iconName,
  buttonText = "Entendido",
  onClose,
  secondaryButtonText,
  onSecondaryAction,
  horizontalButtons = false,
  onDismiss,
}: EVAAlertProps) {
  const { colors, fonts, isDark } = useAppTheme();

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      onClose();
    }
  };

  const getThemeVars = () => {
    const alertTheme = (colors as any).alert[type] || (colors as any).alert.info;
    let iconNameStr = iconName;
    
    if (!iconNameStr) {
      switch (type) {
        case "success":
          iconNameStr = "checkmark-circle";
          break;
        case "error":
        case "warning":
          iconNameStr = "alert-circle";
          break;
        default:
          iconNameStr = "information-circle";
          break;
      }
    }

    const buttonStyle =
      type === "success"
        ? { bg: colors.successSurface, fg: "#FFFFFF" }
        : type === "error"
          ? { bg: colors.dangerSurface, fg: "#FFFFFF" }
          : type === "warning"
            ? { bg: colors.warningSurface, fg: colors.onWarning }
            : { bg: colors.primarySurface, fg: colors.onPrimary };

    return {
      name: iconNameStr,
      bg: alertTheme.bg,
      border: alertTheme.border,
      iconColor: alertTheme.icon,
      buttonBg: buttonStyle.bg,
      buttonFg: buttonStyle.fg,
    };
  };

  const themeVars = getThemeVars();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleDismiss}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? "rgba(0,0,0,0.85)"
                : "rgba(0,0,0,0.5)",
            },
          ]}
        />

        <View
          accessibilityViewIsModal
          style={{
            width: "88%",
            maxWidth: 400,
            borderRadius: 24,
            padding: 20,
            alignItems: "center",
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 14,
          }}
        >
          {/* Icon Section */}
          <View
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: themeVars.bg,
              borderColor: themeVars.border,
            }}
          >
            <Ionicons name={themeVars.name as any} size={32} color={themeVars.iconColor} />
          </View>

          {/* Text Section */}
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 22,
              textAlign: "center",
              marginBottom: 8,
              fontFamily: fonts.family.bold,
              color: colors.text,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              textAlign: "center",
              fontSize: 15,
              lineHeight: 22,
              marginBottom: 20,
              paddingHorizontal: 8,
              fontFamily: fonts.family.regular,
              color: colors.textSecondary,
            }}
          >
            {message}
          </Text>

          {/* Buttons Section */}
          <View
            style={{
              width: "100%",
              flexDirection: horizontalButtons ? "row" : "column",
              gap: 10,
            }}
          >
            {secondaryButtonText && (
              <TouchableOpacity
                onPress={onSecondaryAction}
                accessibilityRole="button"
                style={{
                  flex: horizontalButtons ? 1 : undefined,
                  width: horizontalButtons ? undefined : "100%",
                  height: 48,
                  paddingHorizontal: 16,
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
                  style={{ fontSize: 15, fontFamily: fonts.family.semiBold, color: colors.text }}
                >
                  {secondaryButtonText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              style={{
                flex: horizontalButtons ? 1 : undefined,
                width: horizontalButtons ? undefined : "100%",
                height: 48,
                paddingHorizontal: 16,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: themeVars.buttonBg,
                shadowColor: themeVars.buttonBg,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={{ color: themeVars.buttonFg, fontSize: 16, fontFamily: fonts.family.bold }}
              >
                {buttonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
