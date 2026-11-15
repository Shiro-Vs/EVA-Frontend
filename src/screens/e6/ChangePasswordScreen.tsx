import React, { useState } from "react";
import { Button, Field, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { AuthError, signInWithPassword, updatePassword } from "../../api/supabaseAuth";
import { passwordProblem } from "../../logic/auth/passwordRules";
import { useDone } from "../../hooks/useDone";

/** Cambiar la contraseña con la sesión abierta: se pide la actual (se comprueba con Supabase) y se fija la nueva. */
export function ChangePasswordScreen() {
  const { profile } = useAuth();
  const dialog = useDialog();
  const done = useDone();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
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
      await dialog.success("Contraseña cambiada", "Usa la nueva la próxima vez que inicies sesión.");
      done("/more");
    } catch (e) {
      setError(e instanceof AuthError && e.code === "invalid_credentials" ? "La contraseña actual no es correcta." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Cambiar contraseña" footer={<Button title="Guardar contraseña" busy={busy} onPress={submit} />}>
      <Txt muted size={14}>Si entraste con Google no tienes una contraseña de EVA: cámbiala desde tu cuenta de Google.</Txt>
      {error ? <Notice tone="err">{error}</Notice> : null}
      <Field label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry />
      <Field label="Contraseña nueva" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8, una mayúscula y un número" />
      <Field label="Repite la contraseña nueva" value={repeat} onChangeText={setRepeat} secureTextEntry onSubmitEditing={submit} />
    </Screen>
  );
}
