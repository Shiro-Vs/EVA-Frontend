import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image, // Cambiado a Image nativo para sincronización total
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useAppTheme } from "../../hooks/useAppTheme";

const LOGO_LIGHT_BG = require("../../../assets/LogoEVA_Fclaro.png");
const LOGO_DARK_BG = require("../../../assets/LogoEVA_Foscuro.png");

interface LoadingSplashProps {
  onAnimationComplete?: () => void;
  isReady?: boolean;
}

export default function LoadingSplash({
  onAnimationComplete,
  isReady,
}: LoadingSplashProps) {
  const { colors, isDark } = useAppTheme();

  // Usamos colores dinámicos para evitar el flash blanco
  const themeColors = colors;
  const logoSource = isDark ? LOGO_DARK_BG : LOGO_LIGHT_BG;
  const textColor = isDark ? themeColors.text : themeColors.primary; // Azul EVA o Slate Text

  // Sin animación de entrada: esta pantalla es idéntica a la nativa (mismo fondo, mismo logo, mismo tamaño), así que
  // arranca ya visible y solo se anima la salida. Si entrara con efecto, se vería como una segunda carga.
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    if (isReady) {
      containerOpacity.value = withTiming(
        0,
        {
          duration: 400, // Salida rápida (400ms)
          easing: Easing.inOut(Easing.quad),
        },
        (finished) => {
          if (finished && onAnimationComplete) {
            runOnJS(onAnimationComplete)();
          }
        },
      );
    }
  }, [isReady]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    backgroundColor: themeColors.background,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.content}>
        <Image 
          source={logoSource} 
          style={styles.logo} 
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 250, // Logo más grande
    height: 250,
  },
});
