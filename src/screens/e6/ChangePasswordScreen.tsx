import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AuthError, signInWithPassword, updatePassword } from "../../api/supabaseAuth";
import { session } from "../../api/http";
import { passwordProblem } from "../../logic/auth/passwordRules";
import { useDone } from "../../hooks/useDone";

/** Cambiar la contraseña con la sesión abierta: se pide la actual (se comprueba con Supabase) y se fija la nueva. */
export function ChangePasswordScreen() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const dialog = useDialog();
  const done = useDone();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!profile?.email) return setError("No se pudo leer tu correo. Cierra sesión y vuelve a entrar.");
    if (!current) return setError("Escribe tu contraseña actual.");
    const problem = passwordProblem(password);
    if (problem) return setError(`Contraseña nueva: ${problem.toLowerCase()}.`);
    if (password !== repeat) return setError("Las contraseñas nuevas no coinciden.");
    if (password === current) return setError("La contraseña nueva debe ser distinta a la actual.");
    setBusy(true);
    try {
      const s = await signInWithPassword(profile.email, current);
      await updatePassword(s.accessToken, password);
      await session.setToken(s.accessToken);
      await session.setRefreshToken(s.refreshToken);
      await dialog.success("Contraseña cambiada", "Usa la nueva la próxima vez que inicies sesión.");
      done("/more");
    } catch (e) {
      setError(e instanceof AuthError && e.code === "invalid_credentials" ? "La contraseña actual no es correcta." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const eyeBtn = (
    <TouchableOpacity
      onPress={() => setShowPass((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={showPass ? "Ocultar contraseñas" : "Mostrar contraseñas"}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const ready = current.length > 0 && password.length > 0 && repeat.length > 0;

  return (
    <Screen title="Cambiar contraseña" footer={<Button title="Guardar contraseña" busy={busy} disabled={!ready} onPress={submit} />}>
      <Txt muted size={14}>Si entraste con Google no tienes una contraseña de EVA: cámbiala desde tu cuenta de Google.</Txt>
      {error ? <Notice tone="err">{error}</Notice> : null}
      <Card>
        <Field label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry={!showPass} rightAction={eyeBtn} />
        <Field label="Contraseña nueva" value={password} onChangeText={setPassword} secureTextEntry={!showPass} rightAction={eyeBtn} placeholder="Mínimo 8 caracteres" />
        <Txt size={12} muted style={{ marginLeft: 4 }}>Debe tener al menos 8 caracteres, una mayúscula y un número.</Txt>
        <Field label="Repite la contraseña nueva" value={repeat} onChangeText={setRepeat} secureTextEntry={!showPass} rightAction={eyeBtn} onSubmitEditing={submit} />
      </Card>
    </Screen>
  );
}
