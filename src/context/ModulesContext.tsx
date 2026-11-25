import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import type { ModulesPreferences } from "../api/types";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "eva_modules_pref";

export const DEFAULT_MODULES: ModulesPreferences = {
  services: true,
  people: true,
  loans: true,
  plan: true,
};

export type ModulePresetId = "essential" | "personal" | "full" | "custom";

export const MODULE_PRESETS: Record<Exclude<ModulePresetId, "custom">, { label: string; desc: string; modules: ModulesPreferences }> = {
  essential: {
    label: "Esencial",
    desc: "Solo ingresos, gastos, cuentas y tarjetas",
    modules: { services: false, people: false, loans: false, plan: false },
  },
  personal: {
    label: "Personal",
    desc: "Agrega tus suscripciones propias, presupuestos y metas",
    modules: { services: true, people: false, loans: false, plan: true },
  },
  full: {
    label: "Completo",
    desc: "Todo activado: servicios compartidos, personas, préstamos y plan",
    modules: { services: true, people: true, loans: true, plan: true },
  },
};

export function detectModulePreset(m: ModulesPreferences): ModulePresetId {
  for (const id of ["essential", "personal", "full"] as const) {
    const p = MODULE_PRESETS[id].modules;
    if (p.services === m.services && p.people === m.people && p.loans === m.loans && p.plan === m.plan) {
      return id;
    }
  }
  return "custom";
}

function normalizeModules(raw: unknown): ModulesPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_MODULES;
  const o = raw as Record<string, unknown>;
  return {
    services: typeof o.services === "boolean" ? o.services : true,
    people: typeof o.people === "boolean" ? o.people : true,
    loans: typeof o.loans === "boolean" ? o.loans : true,
    plan: typeof o.plan === "boolean" ? o.plan : true,
  };
}

interface ModulesContextValue {
  modules: ModulesPreferences;
  preset: ModulePresetId;
  loaded: boolean;
  updateModules: (next: ModulesPreferences) => Promise<void>;
  refreshModules: () => Promise<void>;
}

const ModulesContext = createContext<ModulesContextValue>({
  modules: DEFAULT_MODULES,
  preset: "full",
  loaded: false,
  updateModules: async () => {},
  refreshModules: async () => {},
});

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModulesPreferences>(DEFAULT_MODULES);
  const [loaded, setLoaded] = useState(false);

  // Carga local inmediata para que la barra inferior no parpadee al abrir la app.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setModules(normalizeModules(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const refreshModules = useCallback(async () => {
    if (!user) return;
    try {
      const p = await api.preferences();
      if (p.modules) {
        const clean = normalizeModules(p.modules);
        setModules(clean);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(() => {});
      }
    } catch {
      // Silencioso: conserva lo guardado localmente si no hay red o backend aún no soporta `modules`.
    }
  }, [user]);

  useEffect(() => {
    if (user) void refreshModules();
  }, [user, refreshModules]);

  const updateModules = useCallback(async (next: ModulesPreferences) => {
    const clean = normalizeModules(next);
    setModules(clean);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(() => {});
    try {
      await api.savePreferences({ modules: clean });
    } catch {
      // Si el backend aún está desplegando o sin red, queda aplicado localmente y se sincronizará luego.
    }
  }, []);

  const preset = useMemo(() => detectModulePreset(modules), [modules]);

  return (
    <ModulesContext.Provider value={{ modules, preset, loaded, updateModules, refreshModules }}>
      {children}
    </ModulesContext.Provider>
  );
}

export const useModules = () => useContext(ModulesContext);
