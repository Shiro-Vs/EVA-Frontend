import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api } from "../api/client";
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
  /** @deprecated Camino del login simulado anterior; no guarda token. */
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    setProfile(null);
    setLegacyUser(null);
  }, []);

  // Un 401 en cualquier llamada cierra la sesión.
  useEffect(() => { session.onUnauthorized(() => { void logout(); }); }, [logout]);

  // Restaura la sesión: si hay token guardado, lo valida pidiendo el perfil.
  useEffect(() => {
    (async () => {
      try {
        if (await session.getToken()) setProfile(await api.me());
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

  const value = useMemo<AuthContextType>(
    () => ({ user: profile ? toUser(profile) : legacyUser, profile, isLoadingSession, signInWithToken, signInWithPassword, signUp, signInWithGoogle, setProfile, login, logout }),
    [profile, legacyUser, isLoadingSession, signInWithToken, signInWithPassword, signUp, signInWithGoogle, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
