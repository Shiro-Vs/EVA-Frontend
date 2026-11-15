import { useState } from "react";
import { AuthError, recoverPassword, supabaseConfigured } from "../../api/supabaseAuth";
import { markCodeCooldown, markCodeSent, useCodeCooldown } from "./codeCooldown";

export function useForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const cooldown = useCodeCooldown(email);
  
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info",
    iconName: undefined as string | undefined,
  });

  const validateEmail = (text: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(text);
  };

  const handleResetPassword = async () => {
    if (cooldown.left > 0) return;
    if (!email.trim()) {
      setError("El correo es obligatorio");
      return;
    }
    if (!validateEmail(email)) {
      setError("Ingresa un correo válido");
      return;
    }

    if (!supabaseConfigured()) {
      setAlertConfig({ visible: true, title: "Recuperación próximamente", message: "Todavía no está conectado el servicio de cuentas en esta versión de prueba.", type: "info", iconName: "construct-outline" });
      return;
    }
    try {
      await recoverPassword(email);
      markCodeSent(email);
      cooldown.refresh();
    } catch (e) {
      if (e instanceof AuthError && e.retryAfter) { markCodeCooldown(email, e.retryAfter); cooldown.refresh(); }
      setAlertConfig({ visible: true, title: "No se pudo enviar", message: (e as Error).message, type: "error", iconName: "warning-outline" });
      return;
    }
    // Siempre se informa lo mismo: no se revela si el correo tiene cuenta.
    setAlertConfig({
      visible: true,
      title: "Código enviado",
      message: "Si " + email + " tiene una cuenta, te enviamos un código de 6 dígitos. Escríbelo en la siguiente pantalla para elegir tu contraseña nueva.",
      type: "success",
      iconName: "mail-unread-outline",
    });
  };

  return {
    email,
    setEmail,
    error,
    setError,
    alertConfig,
    setAlertConfig,
    handleResetPassword,
    secondsLeft: cooldown.left,
  };
}
