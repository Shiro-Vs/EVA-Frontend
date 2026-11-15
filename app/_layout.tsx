import "../global.css";
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import LoadingSplash from "../src/components/common/LoadingSplash";
import OfflineBanner from "../src/components/common/OfflineBanner";
import { View } from "react-native";
import { useFonts } from 'expo-font';
import { ThemeProvider, useAppThemeContext } from "../src/context/ThemeContext";
import { useAppTheme } from "../src/hooks/useAppTheme";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { DialogProvider } from "../src/context/DialogContext";
import { LockProvider } from "../src/security/LockGate";
import { useReminderSync } from "../src/notifications/useReminderSync";
import { UpdatePrompt } from "../src/updates/UpdatePrompt";

// Prevenir que el splash screen nativo se oculte automáticamente
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { theme, isDark } = useAppThemeContext();
  const { colors } = useAppTheme();
  const { user, isLoadingSession } = useAuth();
  useReminderSync();
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    'Asap': require('../assets/fuentes/asap/Asap-Regular.otf'),
    'AsapMedium': require('../assets/fuentes/asap/Asap-Medium.otf'),
    'AsapSemiBold': require('../assets/fuentes/asap/Asap-SemiBold.otf'),
    'AsapBold': require('../assets/fuentes/asap/Asap-Bold.otf'),
    'AsapItalic': require('../assets/fuentes/asap/Asap-Italic.otf'),
    'AsapMediumItalic': require('../assets/fuentes/asap/Asap-MediumItalic.otf'),
    'AsapSemiBoldItalic': require('../assets/fuentes/asap/Asap-SemiBoldItalic.otf'),
    'AsapBoldItalic': require('../assets/fuentes/asap/Asap-BoldItalic.otf'),
  });

  useEffect(() => {
    if (fontError) console.error("Error cargando fuentes:", fontError);
  }, [fontError]);

  // La pantalla de carga nativa y la de la app son iguales (mismo fondo y logo del tema del teléfono), así que no hay un
  // segundo «cargando»: se oculta la nativa cuando hay fuentes y la de la app se desvanece cuando además se restauró la sesión.
  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);
  const appIsReady = fontsDone && !isLoadingSession;

  // Si las fuentes no han cargado, no renderizamos NADA para evitar que se vea la fuente del sistema
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} className={theme}>
      {/* La barra de estado sigue el tema de la app (no el del teléfono): íconos claros sobre fondo oscuro y al revés. */}
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaProvider>
        {/*
          Stack.Protected condiciona que pantallas existen en el navegador
          segun el estado de sesion, en vez de renderizar todas siempre y
          redirigir despues. Redirigir con router.replace() desde un efecto
          es fragil aqui: app/index.tsx y app/(main)/index.tsx resuelven al
          mismo path "/" (los grupos no aparecen en la URL), y un replace()
          del lado del cliente puede quedar ambiguo entre ambos, dejando la
          pantalla protegida visible sin sesion. Ver docs/06-auditoria-tecnica.md.
        */}
        <OfflineBanner />
        <UpdatePrompt />
        {/* Fondo del tema en cada pantalla: sin esto, durante la transición se ve un fondo blanco/negro que «parpadea». */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right", animationDuration: 200 }}>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="index" />
            <Stack.Screen name="register" />
          </Stack.Protected>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(main)" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>

      {showSplash && (
        <LoadingSplash
          isReady={appIsReady}
          onAnimationComplete={() => setShowSplash(false)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LockProvider>
          <DialogProvider>
            <RootLayoutContent />
          </DialogProvider>
        </LockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
