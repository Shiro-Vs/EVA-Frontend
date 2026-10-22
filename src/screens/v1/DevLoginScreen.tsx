import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage } from "../../api/client";
import { devLogin, session } from "../../api/http";
import { Button, Card, Field, Notice, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useAppTheme";

/**
 * Acceso de desarrollo (docs 15, E1): se pega el token que emite `npm run dev:token` en EVA-Backend.
 * El acceso real con Google/correo (Supabase) se conecta en la tarea 0.11 y reemplaza esta pantalla.
 */
export default function DevLoginScreen() {
  const { colors } = useAppTheme();
  const { signInWithToken } = useAuth();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void session.getBaseUrl().then(setUrl); }, []);

  const enterAsDev = async () => {
    setBusy(true); setError(null);
    try {
      await signInWithToken(await devLogin(url), url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const enter = async () => {
    if (!token.trim()) { setError("Pega el token de desarrollo."); return; }
    setBusy(true); setError(null);
    try {
      await signInWithToken(token, url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: "center" }}>
      <View style={{ gap: 14, maxWidth: 520, width: "100%", alignSelf: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 40, fontFamily: "AsapBold" }}>EVA</Text>
        <Txt muted>Entrada de desarrollo. El acceso con Google y correo llega con Supabase.</Txt>
        <Card>
          <Field label="Servidor (API)" value={url} onChangeText={setUrl} placeholder="http://192.168.1.X:3000/v1" keyboardType="url" />
          <Field label="Token de desarrollo" value={token} onChangeText={setToken} placeholder="Pega aquí el resultado de npm run dev:token" multiline numberOfLines={4} secureTextEntry={false} />
          <Txt size={12} muted>En un teléfono físico usa la IP de tu PC en la red WiFi; en el emulador de Android, http://10.0.2.2:3000/v1.</Txt>
        </Card>
        {error && <Notice tone="err">{error}</Notice>}
        <Button title="Entrar como usuario de desarrollo" onPress={enterAsDev} busy={busy} />
        <Button title="Entrar con un token" variant="secondary" onPress={enter} busy={busy} />
      </View>
    </SafeAreaView>
  );
}
