import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { quickAdd } from "../../screens/tabs/quickAdd";
import type { SectionKey } from "../../constants/Colors";

const SECTION_OF: Record<string, SectionKey> = { index: "home", money: "money", planning: "services", people: "people", plan: "plan", more: "more" };
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export default function EVATabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Animación de pulso para el botón central
  const scale = useSharedValue(1);
  const auraScale = useSharedValue(1);
  const auraOpacity = useSharedValue(0.5);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraScale.value }],
    opacity: auraOpacity.value,
  }));

  useEffect(() => {
    // Pulso del botón principal
    scale.value = withRepeat(
      withTiming(1.1, { duration: 1200 }), 
      -1, 
      true
    );

    // Animación del Aura (onda expansiva)
    auraScale.value = withRepeat(
      withTiming(1.35, { duration: 1500 }), 
      -1, 
      false
    );
    auraOpacity.value = withRepeat(
      withTiming(0, { duration: 1500 }), 
      -1, 
      false
    );
  }, []);

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={[
        styles.tabBar,
        { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: "#000" }
      ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Botón Central (+): abre la hoja de acciones rápidas, no navega
          if (route.name === "add") {
            return (
                <View key={route.key} style={styles.centerButtonContainer}>
                  {/* Aura / Onda Expansiva */}
                  <Animated.View style={[styles.aura, auraStyle, { backgroundColor: colors.fab }]} />
                  
                  {/* Botón Principal */}
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      quickAdd.open();
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Nuevo: registrar o crear"
                  >
                    <Animated.View style={[styles.centerButton, animatedStyle, { backgroundColor: colors.fab, shadowColor: colors.fab }]}>
                      <Ionicons name="add" size={32} color={colors.onFab} />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
            );
          }

          // Iconos normales
          const getIcon = (name: string, focused: boolean) => {
            const color = focused ? (colors.sections[SECTION_OF[name] ?? "home"].ink) : colors.textSecondary;
            let iconName: any = "help-circle";

            if (name === "index") iconName = focused ? "grid" : "grid-outline";
            if (name === "money") iconName = focused ? "wallet" : "wallet-outline";
            if (name === "planning") iconName = focused ? "receipt" : "receipt-outline";
            if (name === "people") iconName = focused ? "people" : "people-outline";
            if (name === "plan") iconName = focused ? "flag" : "flag-outline";
            if (name === "more") iconName = focused ? "apps" : "apps-outline";

            return <Ionicons name={iconName} size={22} color={color} />;
          };

          const labelText = typeof label === "string" ? label : route.name;

          const shownLabel = labelText === "index" ? "Inicio" : labelText;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={shownLabel}
            >
              {getIcon(route.name, isFocused)}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.sections[SECTION_OF[route.name] ?? "home"].ink : colors.textSecondary, fontFamily: fonts.family.medium }
                ]}
              >
                {shownLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  tabBar: {
    flexDirection: "row",
    height: 65,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    width: "100%",
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  centerButtonContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 56,
    height: 56,
    top: -20,
  },
  aura: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }
});
