import React, { useState } from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { control, radius } from "../../constants/Layout";

interface EVAInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function EVAInput({ label, error, icon, rightAction, style, onFocus, onBlur, editable, multiline, value, ...props }: EVAInputProps) {
  const { colors, fonts } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const hasValue = value !== undefined ? String(value).length > 0 : true;
  const borderColor = error
    ? colors.expenseStrong
    : focused
      ? colors.primary
      : disabled
        ? colors.border
        : hasValue
          ? colors.borderStrong
          : colors.border;

  return (
    <View style={{ marginBottom: 4, width: "100%" }}>
      {label && (
        <Text
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 6,
            marginLeft: 4,
            color: colors.textSecondary,
            fontFamily: fonts.family.semiBold,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          paddingHorizontal: 14,
          paddingVertical: multiline ? 10 : 8,
          borderRadius: radius.md,
          backgroundColor: colors.card,
          borderColor,
          borderWidth: focused || error ? 1.5 : 1,
          minHeight: control.field,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {icon && <View style={{ marginRight: 10, marginTop: multiline ? 2 : 0 }}>{icon}</View>}
        <TextInput
          value={value}
          placeholderTextColor={`${colors.muted}73`}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              fontSize: 15,
              paddingTop: 0,
              paddingBottom: 0,
              color: disabled ? colors.muted : colors.text,
              fontFamily: hasValue ? fonts.family.semiBold : fonts.family.italic,
            },
            style,
          ]}
          {...props}
        />
        {rightAction && <View style={{ marginLeft: 8 }}>{rightAction}</View>}
      </View>
      {error && (
        <Text style={{ fontSize: 11, marginTop: 4, marginLeft: 4, color: colors.expenseStrong, fontFamily: fonts.family.regular }}>
          {error}
        </Text>
      )}
    </View>
  );
}
