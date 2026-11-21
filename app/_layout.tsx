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
  const { theme, isDark, loaded: themeLoaded } = useAppThemeContext();
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
  const fontsDone = (fontsLoaded || !!fontError) && themeLoaded; // fuentes y paleta guardada: así la pantalla de carga ya sale con tus colores
  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);
  const appIsReady = fontsDone && !isLoadingSession;

  // Si las fuentes no han cargado, no renderizamos NADA para evitar que se vea la fuente del sistema
  if (!fontsDone) {
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
          pantalla protegida visible sin sesion.
        */}
        <OfflineBanner />
        <UpdatePrompt />
        {/* Fondo del tema en cada pantalla: sin esto, durante la transición se ve un fondo blanco/negro que «parpadea». */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right", animationDuration: 200 }}>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="index" />
            <Stack.Screen name="register" />
            <Stack.Screen name="forgot-password" />
          </Stack.Protected>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(main)" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="classify" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="finance" />
            <Stack.Screen name="panel" />
            <Stack.Screen name="account/new" />
            <Stack.Screen name="account/[id]/index" />
            <Stack.Screen name="account/[id]/edit" />
            <Stack.Screen name="account/[id]/card" />
            <Stack.Screen name="account/[id]/reconcile" />
            <Stack.Screen name="account/[id]/statement/new" />
            <Stack.Screen name="account/[id]/installments/new" />
            <Stack.Screen name="analysis/index" />
            <Stack.Screen name="analysis/chats" />
            <Stack.Screen name="analysis/chat/[id]" />
            <Stack.Screen name="analysis/saved/[id]" />
            <Stack.Screen name="bank-loans/index" />
            <Stack.Screen name="bank-loans/new" />
            <Stack.Screen name="bank-loan/[id]/index" />
            <Stack.Screen name="bank-loan/[id]/pay" />
            <Stack.Screen name="bank-loan/[id]/change" />
            <Stack.Screen name="budgets/index" />
            <Stack.Screen name="budgets/new" />
            <Stack.Screen name="budgets/[id]" />
            <Stack.Screen name="capture/index" />
            <Stack.Screen name="capture/new" />
            <Stack.Screen name="capture/batch" />
            <Stack.Screen name="capture/rules" />
            <Stack.Screen name="capture/proposal/[id]" />
            <Stack.Screen name="capture/document/[id]/index" />
            <Stack.Screen name="capture/document/[id]/loan" />
            <Stack.Screen name="card-statement/[id]" />
            <Stack.Screen name="contact/[id]/index" />
            <Stack.Screen name="contact/[id]/receipts" />
            <Stack.Screen name="contact/[id]/convert" />
            <Stack.Screen name="export/index" />
            <Stack.Screen name="export/contact" />
            <Stack.Screen name="goals/index" />
            <Stack.Screen name="goals/accounts" />
            <Stack.Screen name="goals/new" />
            <Stack.Screen name="goals/[id]" />
            <Stack.Screen name="loans/index" />
            <Stack.Screen name="loans/new" />
            <Stack.Screen name="loan/[id]" />
            <Stack.Screen name="operation/new" />
            <Stack.Screen name="operation/[id]/index" />
            <Stack.Screen name="operation/[id]/correct" />
            <Stack.Screen name="receipt/new" />
            <Stack.Screen name="receipt/[id]/index" />
            <Stack.Screen name="receipt/[id]/correct" />
            <Stack.Screen name="receipt/[id]/reverse" />
            <Stack.Screen name="recurring/index" />
            <Stack.Screen name="recurring/new" />
            <Stack.Screen name="recurring/[id]" />
            <Stack.Screen name="recurring/occurrence/[id]" />
            <Stack.Screen name="refunds/index" />
            <Stack.Screen name="refunds/new" />
            <Stack.Screen name="reports/index" />
            <Stack.Screen name="reports/snapshot/[id]" />
            <Stack.Screen name="rules/index" />
            <Stack.Screen name="rules/new" />
            <Stack.Screen name="seat/[id]/index" />
            <Stack.Screen name="seat/[id]/quota" />
            <Stack.Screen name="seat/[id]/courtesy" />
            <Stack.Screen name="seat/[id]/exit" />
            <Stack.Screen name="service/new" />
            <Stack.Screen name="service/join" />
            <Stack.Screen name="service/pay" />
            <Stack.Screen name="service/[id]/index" />
            <Stack.Screen name="service/[id]/manage" />
            <Stack.Screen name="service/[id]/price" />
            <Stack.Screen name="service/[id]/calendar" />
            <Stack.Screen name="service/[id]/individual" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/account" />
            <Stack.Screen name="settings/billing" />
            <Stack.Screen name="settings/dashboard" />
            <Stack.Screen name="settings/general" />
            <Stack.Screen name="settings/lock" />
            <Stack.Screen name="settings/notifications" />
            <Stack.Screen name="settings/password" />
            <Stack.Screen name="settings/backups/index" />
            <Stack.Screen name="settings/backups/[id]" />
          </Stack.Protected>
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="+not-found" />
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
