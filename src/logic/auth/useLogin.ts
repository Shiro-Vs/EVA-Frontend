import { useState } from "react";
import { errorMessage } from "../../api/client";
import { devLogin, session } from "../../api/http";
import { supabaseConfigured } from "../../api/supabaseAuth";
import { useAuth } from "../../context/AuthContext";

export function useLogin() {
  const { signInWithToken, signInWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Estados de error
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const validateEmail = (text: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(text);
  };

  // Estados de alerta
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info",
    iconName: undefined as string | undefined,
  });

  const handleLogin = async () => {
    if (isAuthenticating) return;

    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = "El correo es obligatorio";
      isValid = false;
    } else if (!validateEmail(email)) {
      newErrors.email = "Correo inválido";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "La contraseña es obligatoria";
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) return;
    if (!supabaseConfigured()) {
      setAlertConfig({ visible: true, title: "Inicio con correo próximamente", message: "Esta versión de prueba todavía no está conectada al servicio de cuentas. Entra con el botón «Entrar en modo desarrollo».", type: "info", iconName: "construct-outline" });
      return;
    }
    setIsAuthenticating(true);
    try {
      await signInWithPassword(email, password);
    } catch (error) {
      setAlertConfig({ visible: true, title: "No se pudo entrar", message: (error as Error).message, type: "error", iconName: "warning-outline" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  /** Entrar con Google (solo en la app del teléfono y con el servicio de cuentas configurado). */
  const handleGoogleLogin = async () => {
    if (isAuthenticating) return;
    if (!supabaseConfigured()) {
      setAlertConfig({ visible: true, title: "Google próximamente", message: "Todavía no está conectado el servicio de cuentas. Entra con «Entrar en modo desarrollo».", type: "info", iconName: "construct-outline" });
      return;
    }
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAlertConfig({ visible: true, title: "No se pudo entrar con Google", message: (error as Error).message, type: "error", iconName: "warning-outline" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  /** Acceso de desarrollo: el servidor entrega un token del usuario de desarrollo (solo con AUTH_MODE=dev). */
  const handleDevLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const base = await session.getBaseUrl();
      await signInWithToken(await devLogin(base), base);
    } catch (error) {
      setAlertConfig({
        visible: true,
        title: "No se pudo entrar",
        message: errorMessage(error),
        type: "error",
        iconName: "warning-outline",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    isAuthenticating,
    errors,
    setErrors,
    alertConfig,
    setAlertConfig,
    handleLogin,
    handleGoogleLogin,
    handleDevLogin,
  };
}
