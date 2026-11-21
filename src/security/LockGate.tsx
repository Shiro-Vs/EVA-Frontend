import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../hooks/useAppTheme";
import { PIN_LENGTH, shouldLock } from "./lock";
import { biometricEnabled, biometricSupported, clearLock, getLockAfterSeconds, hasPin, lockAvailable, promptBiometric, setLockAfterSeconds, verifyPin } from "./store";

interface LockCtx { enabled: boolean; refresh: () => Promise<void> }
const Ctx = createContext<LockCtx>({ enabled: false, refresh: async () => {} });
export const useLock = () => useContext(Ctx);

const DEFAULT_AFTER = 60;

/** Bloqueo por PIN / huella: se pide al abrir la app y al volver de segundo plano pasado el tiempo elegido. */
export function LockProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoadingSession } = useAuth();
  const uid = user?.uid ?? null;
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const after = useRef(DEFAULT_AFTER);
  const left = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const e = lockAvailable() && (await hasPin());
    setEnabled(e);
    if (!e) setLocked(false);
    try {
      const local = await getLockAfterSeconds();
      if (local !== null) after.current = local;
    } catch { /* sin almacenamiento local: conserva valor actual */ }
    try {
      const s = (await api.preferences()).security.lockAfterSeconds;
      after.current = s;
      void setLockAfterSeconds(s).catch(() => {});
    } catch { /* sin conexión: se conserva el último valor persistido */ }
  }, []);

  // Al abrir la app con sesión restaurada y PIN configurado, arranca bloqueada.
  // Nunca limpia el bloqueo mientras la sesión todavía se está restaurando, ni re-bloquea al refrescar el perfil del mismo usuario.
  useEffect(() => {
    if (isLoadingSession) return;
    if (!uid) {
      setLocked(false);
      setEnabled(false);
      if (lockAvailable()) clearLock().catch(() => {});
      return;
    }
    hasPin().then((e) => { setEnabled(e); if (e) setLocked(true); }).catch(() => {});
    refresh().catch(() => {});
  }, [uid, isLoadingSession, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") left.current = Date.now();
      else if (s === "active" && shouldLock({ enabled, now: Date.now(), backgroundedAt: left.current, lockAfterSeconds: after.current })) setLocked(true);
      if (s === "active") left.current = null;
    });
    return () => sub.remove();
  }, [enabled]);

  const value = useMemo(() => ({ enabled, refresh }), [enabled, refresh]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {user && enabled && locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </Ctx.Provider>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useAppTheme();
  const { logout } = useAuth();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [busy, setBusy] = useState(false);

  const tryBiometric = useCallback(async () => {
    try { if (await promptBiometric()) onUnlock(); } catch { /* cancelado: queda el PIN */ }
  }, [onUnlock]);

  useEffect(() => {
    (async () => {
      if ((await biometricEnabled()) && (await biometricSupported())) { setBio(true); await tryBiometric(); }
    })().catch(() => {});
  }, [tryBiometric]);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      const r = await verifyPin(value);
      if (r.ok) { onUnlock(); return; }
      setPin("");
      setMsg(
        r.waitSeconds > 0
          ? `Demasiados intentos. Espera ${r.waitSeconds} s.`
          : `PIN incorrecto. Te ${r.remaining === 1 ? "queda 1 intento" : `quedan ${r.remaining} intentos`}.`
      );
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 20, backgroundColor: colors.background }} accessibilityViewIsModal>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Ionicons name="lock-closed" size={44} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 22, fontFamily: "AsapBold" }}>EVA está bloqueada</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "Asap", textAlign: "center" }}>Ingresa tu PIN de {PIN_LENGTH} dígitos</Text>
          <TextInput
            value={pin} onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, PIN_LENGTH); setPin(d); setMsg(null); if (d.length === PIN_LENGTH) void submit(d); }}
            keyboardType="number-pad" secureTextEntry maxLength={PIN_LENGTH} autoFocus editable={!busy} accessibilityLabel="PIN"
            style={{ width: 180, textAlign: "center", fontSize: 28, letterSpacing: 8, fontFamily: "AsapBold", color: colors.text, borderBottomWidth: 2, borderColor: colors.primary, paddingVertical: 6 }}
          />
          {msg && <Text style={{ color: colors.expenseStrong, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>{msg}</Text>}
          {bio && (
            <TouchableOpacity onPress={() => void tryBiometric()} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }} style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 44, paddingHorizontal: 14 }}>
              <Ionicons name="finger-print" size={22} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "AsapSemiBold" }}>Usar huella</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { clearLock().catch(() => {}); void logout(); }} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Olvidé mi PIN · cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
