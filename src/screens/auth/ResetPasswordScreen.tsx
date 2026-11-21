import React, { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Field, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuth } from "../../context/AuthContext";
import { AuthError, recoverPassword, updatePassword, verifyRecoveryCode } from "../../api/supabaseAuth";
import { markCodeCooldown, markCodeSent, useCodeCooldown } from "../../logic/auth/codeCooldown";
import { passwordProblem } from "../../logic/auth/passwordRules";

/** Segundo paso de «Olvidé mi contraseña»: el código de 6 dígitos del correo + la contraseña nueva. Al terminar entra con ella. */
export default function ResetPasswordScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { signInWithPassword } = useAuth();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const cooldown = useCodeCooldown(email);

  const submit = async () => {
    setError(""); setInfo("");
    if (code.length < 6) return setError("Escribe el código de 6 dígitos que te enviamos.");
    const problem = passwordProblem(password);
    if (problem) return setError(`Contraseña nueva: ${problem.toLowerCase()}.`);
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const s = await verifyRecoveryCode(email, code);
      await updatePassword(s.accessToken, password);
      await signInWithPassword(email, password);
      // Esta pantalla está fuera de los guardianes de sesión, así que no se cierra sola al entrar: se va al inicio a mano.
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(""); setInfo("");
    if (cooldown.left > 0) return;
    try {
      await recoverPassword(email);
      markCodeSent(email);
      cooldown.refresh();
      setInfo("Te enviamos un código nuevo.");
    } catch (e) {
      if (e instanceof AuthError && e.retryAfter) { markCodeCooldown(email, e.retryAfter); cooldown.refresh(); }
      setError((e as Error).message);
    }
  };

  const eyeBtn = (
    <TouchableOpacity
      onPress={() => setShowPass((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <Screen title="Nueva contraseña" footer={<Button title="Cambiar contraseña" busy={busy} onPress={submit} />}>
      <Txt muted size={14}>Escribe el código de 6 dígitos que enviamos a {email || "tu correo"} y elige tu contraseña nueva.</Txt>
      {error ? <Notice tone="err">{error}</Notice> : null}
      {info ? <Notice tone="ok">{info}</Notice> : null}
      <Field label="Código del correo" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" placeholder="123456" />
      <Field label="Contraseña nueva" value={password} onChangeText={setPassword} secureTextEntry={!showPass} rightAction={eyeBtn} placeholder="Mínimo 8 caracteres" />
      <Field label="Repite la contraseña" value={repeat} onChangeText={setRepeat} secureTextEntry={!showPass} rightAction={eyeBtn} onSubmitEditing={submit} />
      <TouchableOpacity onPress={resend} disabled={cooldown.left > 0} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }} style={{ minHeight: 44, justifyContent: "center", opacity: cooldown.left > 0 ? 0.5 : 1 }}>
        <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "AsapSemiBold", textAlign: "center" }}>{cooldown.left > 0 ? `Podrás pedir otro código en ${cooldown.left} s` : "¿No llegó? Enviar otro código"}</Text>
      </TouchableOpacity>
    </Screen>
  );
}
