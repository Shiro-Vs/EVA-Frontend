import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api } from "../api/client";
import { NO_NATIVE, nativeGoogleAvailable, nativeGoogleIdToken } from "../api/googleNative";
import { storage } from "../api/storage";
import * as sb from "../api/supabaseAuth";
import { ApiError, session } from "../api/http";
import type { Profile } from "../api/types";
import { User } from "../interfaces/User";

interface AuthContextType {
  /** Forma heredada que usan el guardia de rutas y las pantallas antiguas. */
  user: User | null;
  /** Perfil real devuelto por la API (docs 13 §2). */
  profile: Profile | null;
  isLoadingSession: boolean;
  /** Entrar con un token (desarrollo: `npm run dev:token` en EVA-Backend; luego Supabase). */
  signInWithToken: (token: string, baseUrl?: string) => Promise<void>;
  /** Inicio de sesión real (Supabase): correo y contraseña. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Registro real. Devuelve true si hace falta confirmar el correo antes de entrar. */
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  setProfile: (p: Profile) => void;
  refreshProfile: () => Promise<Profile | null>;
  /** @deprecated Camino del login simulado anterior; no guarda token. */
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Último perfil conocido: al abrir la app se entra directo al inicio sin esperar a la red (el servidor puede tardar en despertar). */
const PROFILE_KEY = "eva.profile";
const leerPerfil = async (): Promise<Profile | null> => {
  try { const raw = await storage.get(PROFILE_KEY); return raw ? (JSON.parse(raw) as Profile) : null; } catch { return null; }
};

const toUser = (p: Profile): User => ({
  uid: p.id,
  correo: p.email ?? "",
  nombre_pantalla: p.displayName,
  moneda_principal: p.currency,
  preferencias_ia: { auto_categorizar: false, asistente_voz: false },
  fecha_creacion: p.createdAt,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legacyUser, setLegacyUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const logout = useCallback(async () => {
    await session.setToken(null);
    await storage.remove(PROFILE_KEY).catch(() => {});
    setProfile(null);
    setLegacyUser(null);
  }, []);

  // Un 401 en cualquier llamada cierra la sesión.
  useEffect(() => { session.onUnauthorized(() => { void logout(); }); }, [logout]);

  // Guarda el perfil cada vez que cambia (para el próximo arranque).
  useEffect(() => { if (profile) void storage.set(PROFILE_KEY, JSON.stringify(profile)).catch(() => {}); }, [profile]);

  // Restaura la sesión. Con token y perfil guardados se entra al instante y el perfil se renueva en segundo plano;
  // un 401 cierra la sesión por el camino normal. Sin perfil guardado (primera vez tras actualizar) se espera a la red.
  useEffect(() => {
    (async () => {
      try {
        if (await session.getToken()) {
          const guardado = await leerPerfil();
          if (guardado) {
            setProfile(guardado);
            setIsLoadingSession(false);
            api.me().then(setProfile).catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.warn("No se pudo renovar el perfil", e); });
            return;
          }
          setProfile(await api.me());
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await session.setToken(null);
        else console.warn("No se pudo restaurar la sesión", e);
      } finally {
        setIsLoadingSession(false);
      }
    })();
  }, []);

  /** Guarda la sesión (token + token de renovación) y carga el perfil; si falla, no deja nada a medias. */
  const establish = useCallback(async (s: sb.AuthSession) => {
    await session.setToken(s.accessToken);
    await session.setRefreshToken(s.refreshToken);
    try { setProfile(await api.me()); } catch (e) { await session.setToken(null); throw e; }
  }, []);

  // Renovación automática del token ante un 401 (Supabase).
  useEffect(() => {
    session.setRefresher(async () => {
      const rt = await session.getRefreshToken();
      if (!rt || !sb.supabaseConfigured()) return null;
      const s = await sb.refreshSession(rt);
      await session.setToken(s.accessToken);
      await session.setRefreshToken(s.refreshToken);
      return s.accessToken;
    });
    return () => session.setRefresher(undefined);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => { await establish(await sb.signInWithPassword(email, password)); }, [establish]);
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const r = await sb.signUp(email, password, name);
    if (r.session) await establish(r.session);
    return { needsConfirmation: r.needsConfirmation };
  }, [establish]);
  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === "web") throw new sb.AuthError("web", "Entrar con Google está disponible en la app del teléfono.");
    // En el APK se abre la hoja del sistema con tus cuentas de Google; en Expo Go (sin módulo nativo) se usa el navegador.
    if (nativeGoogleAvailable()) {
      try {
        const idToken = await nativeGoogleIdToken();
        if (!idToken) throw new sb.AuthError("cancelled", "Se canceló el inicio con Google.");
        await establish(await sb.signInWithGoogleIdToken(idToken));
        return;
      } catch (e) {
        if (!(e instanceof Error) || e.message !== NO_NATIVE) throw e;
      }
    }
    const redirectTo = "eva://auth-callback";
    const r = await WebBrowser.openAuthSessionAsync(sb.googleAuthUrl(redirectTo), redirectTo);
    if (r.type !== "success") throw new sb.AuthError("cancelled", "Se canceló el inicio con Google.");
    await establish(sb.parseAuthRedirect(r.url));
  }, [establish]);

  const signInWithToken = useCallback(async (token: string, baseUrl?: string) => {
    if (baseUrl) await session.setBaseUrl(baseUrl);
    await session.setToken(token.trim());
    try {
      setProfile(await api.me());
    } catch (e) {
      await session.setToken(null);
      throw e;
    }
  }, []);

  const login = useCallback(async (u: User) => { setLegacyUser(u); }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.me();
      setProfile(p);
      return p;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user: profile ? toUser(profile) : legacyUser, profile, isLoadingSession, signInWithToken, signInWithPassword, signUp, signInWithGoogle, setProfile, refreshProfile, login, logout }),
    [profile, legacyUser, isLoadingSession, signInWithToken, signInWithPassword, signUp, signInWithGoogle, refreshProfile, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
