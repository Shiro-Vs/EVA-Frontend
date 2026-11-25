import React, { useState } from "react";
import { ActivityIndicator, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { ModulesPreferences } from "../../api/types";
import BottomSheet from "../../components/common/BottomSheet";
import { Button, Card, Notice, Screen, Txt } from "../../components/v1/ui";
import { MODULE_PRESETS, useModules, type ModulePresetId } from "../../context/ModulesContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { cmpMoney, formatSoles } from "../../utils/money";

interface BlockerItem {
  module: string;
  reason: string;
  actionLabel: string;
  route: string;
}

/** Valida de forma estricta qué módulos tienen datos activos antes de permitir ocultarlos. */
async function checkModuleBlockers(current: ModulesPreferences, next: ModulesPreferences): Promise<BlockerItem[]> {
  const turningOff = {
    services: current.services && !next.services,
    people: current.people && !next.people,
    loans: current.loans && !next.loans,
    plan: current.plan && !next.plan,
  };
  if (!turningOff.services && !turningOff.people && !turningOff.loans && !turningOff.plan) return [];

  const [subs, summary, loans, bankLoans, budgets, goals, recurring] = await Promise.all([
    turningOff.services || turningOff.people ? api.subscriptions().catch(() => []) : Promise.resolve([]),
    turningOff.people ? api.summary().catch(() => null) : Promise.resolve(null),
    turningOff.people || turningOff.loans ? api.loans().catch(() => []) : Promise.resolve([]),
    turningOff.loans ? api.bankLoans("active").catch(() => []) : Promise.resolve([]),
    turningOff.plan ? api.budgets(undefined, "active").catch(() => []) : Promise.resolve([]),
    turningOff.plan ? api.goals("active").catch(() => []) : Promise.resolve([]),
    turningOff.plan ? api.recurringTemplates("active").catch(() => []) : Promise.resolve([]),
  ]);

  const blockers: BlockerItem[] = [];

  if (turningOff.people) {
    const sharedActive = subs.filter((s) => s.mode === "shared" && s.status !== "archived");
    if (sharedActive.length > 0) {
      blockers.push({
        module: "Personas",
        reason: `Tienes ${sharedActive.length} ${sharedActive.length === 1 ? "servicio compartido activo" : "servicios compartidos activos"}. Pásalos a individual o archívalos primero.`,
        actionLabel: "Ir a Servicios",
        route: "/planning",
      });
    }
    if (summary && cmpMoney(summary.receivable.pending, "0.00") > 0) {
      blockers.push({
        module: "Personas",
        reason: `Todavía tienes ${formatSoles(summary.receivable.pending)} por cobrar a personas.`,
        actionLabel: "Ir a Personas",
        route: "/contacts",
      });
    }
    const openPersonLoans = loans.filter((l) => l.status === "open" && l.contactId);
    if (openPersonLoans.length > 0) {
      blockers.push({
        module: "Personas",
        reason: `Tienes ${openPersonLoans.length} ${openPersonLoans.length === 1 ? "préstamo abierto" : "préstamos abiertos"} con personas.`,
        actionLabel: "Ir a Préstamos",
        route: "/loans",
      });
    }
  }

  if (turningOff.services) {
    const activeSubs = subs.filter((s) => s.status !== "archived");
    if (activeSubs.length > 0) {
      blockers.push({
        module: "Servicios",
        reason: `Tienes ${activeSubs.length} ${activeSubs.length === 1 ? "servicio activo" : "servicios activos"}. Archívalos o elimínalos primero.`,
        actionLabel: "Ir a Servicios",
        route: "/planning",
      });
    }
  }

  if (turningOff.loans) {
    const openLoans = loans.filter((l) => l.status === "open");
    if (openLoans.length > 0) {
      blockers.push({
        module: "Préstamos",
        reason: `Tienes ${openLoans.length} ${openLoans.length === 1 ? "préstamo abierto" : "préstamos abiertos"} entre personas.`,
        actionLabel: "Ir a Préstamos",
        route: "/loans",
      });
    }
    const activeBank = bankLoans.filter((b) => b.status === "active");
    if (activeBank.length > 0) {
      blockers.push({
        module: "Préstamos",
        reason: `Tienes ${activeBank.length} ${activeBank.length === 1 ? "préstamo bancario activo" : "préstamos bancarios activos"}.`,
        actionLabel: "Ir a Bancarios",
        route: "/bank-loans",
      });
    }
  }

  if (turningOff.plan) {
    const parts: string[] = [];
    if (budgets.length > 0) parts.push(`${budgets.length} ${budgets.length === 1 ? "presupuesto" : "presupuestos"}`);
    if (goals.length > 0) parts.push(`${goals.length} ${goals.length === 1 ? "meta" : "metas"}`);
    if (recurring.length > 0) parts.push(`${recurring.length} ${recurring.length === 1 ? "recurrente" : "recurrentes"}`);
    if (parts.length > 0) {
      blockers.push({
        module: "Planificación",
        reason: `Tienes activos: ${parts.join(", ")}. Archívalos o ciérralos antes de desactivar Plan.`,
        actionLabel: "Ir a Plan",
        route: "/plan",
      });
    }
  }

  return blockers;
}

export function ModulesSettingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { modules, preset, updateModules } = useModules();
  const [checking, setChecking] = useState(false);
  const [blockers, setBlockers] = useState<BlockerItem[] | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const tryApply = async (next: ModulesPreferences, label?: string) => {
    setSavedMsg(null);
    setChecking(true);
    try {
      const issues = await checkModuleBlockers(modules, next);
      if (issues.length > 0) {
        setBlockers(issues);
        return;
      }
      await updateModules(next);
      setSavedMsg(label ? `Perfil «${label}» aplicado.` : "Módulos actualizados.");
    } finally {
      setChecking(false);
    }
  };

  const toggleOne = (key: keyof ModulesPreferences, value: boolean) => {
    void tryApply({ ...modules, [key]: value });
  };

  const rows: Array<{
    key: keyof ModulesPreferences;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    desc: string;
  }> = [
    {
      key: "services",
      icon: "receipt-outline",
      title: "Servicios y suscripciones",
      desc: modules.people ? "Suscripciones propias y compartidas con ciclos" : "Tus suscripciones personales (Netflix, iCloud, etc.)",
    },
    {
      key: "people",
      icon: "people-outline",
      title: "Personas y cobros",
      desc: "Contactos, servicios compartidos, cobros y devoluciones",
    },
    {
      key: "loans",
      icon: "swap-horizontal-outline",
      title: "Préstamos",
      desc: modules.people ? "Préstamos entre personas y préstamos bancarios" : "Préstamos bancarios y cuotas",
    },
    {
      key: "plan",
      icon: "flag-outline",
      title: "Planificación (Plan)",
      desc: "Presupuestos, metas de ahorro y movimientos recurrentes",
    },
  ];

  return (
    <Screen title="Módulos de EVA" subtitle="Elige qué apartados quieres ver en tu app">
      {/* Perfiles rápidos */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "AsapBold", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
          Perfiles rápidos
        </Text>
        <View style={{ gap: 8 }}>
          {(["essential", "personal", "full"] as Array<Exclude<ModulePresetId, "custom">>).map((id) => {
            const p = MODULE_PRESETS[id];
            const on = preset === id;
            return (
              <TouchableOpacity
                key={id}
                disabled={checking}
                onPress={() => void tryApply(p.modules, p.label)}
                activeOpacity={0.78}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: on ? `${colors.primary}16` : colors.card,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: on ? colors.primary : colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{p.label}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "Asap" }}>{p.desc}</Text>
                </View>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={21} color={on ? colors.primary : colors.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Interruptores individuales */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginLeft: 4 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "AsapBold", textTransform: "uppercase", letterSpacing: 1 }}>
            Personalizar a mano
          </Text>
          {checking && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {rows.map((r, i) => (
            <View
              key={r.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Ionicons name={r.icon} size={21} color={modules[r.key] ? colors.primary : colors.muted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>{r.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{r.desc}</Text>
              </View>
              <Switch
                value={modules[r.key]}
                disabled={checking}
                onValueChange={(v) => toggleOne(r.key, v)}
                accessibilityLabel={r.title}
              />
            </View>
          ))}
        </Card>
      </View>

      <Txt size={12} muted style={{ marginHorizontal: 4 }}>
        Inicio y Dinero (cuentas, ingresos, gastos, tarjetas y resumen del mes) siempre están disponibles. Para evitar descuadres, solo puedes desactivar un módulo cuando no tiene elementos activos ni saldos pendientes.
      </Txt>

      {savedMsg && <Notice tone="ok">{savedMsg}</Notice>}

      <BottomSheet
        visible={!!blockers}
        onClose={() => setBlockers(null)}
        title="Antes de desactivar"
        maxHeight={0.75}
      >
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Notice tone="warn">
            No podemos desactivar este apartado todavía porque tiene elementos activos o pendientes:
          </Notice>
          {(blockers ?? []).map((b, idx) => (
            <View
              key={idx}
              style={{
                gap: 8,
                padding: 12,
                borderRadius: 16,
                backgroundColor: `${colors.text}07`,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warningStrong} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>{b.module}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "Asap", lineHeight: 18 }}>{b.reason}</Text>
                </View>
              </View>
              <Button
                title={b.actionLabel}
                variant="secondary"
                size="compact"
                icon="arrow-forward-outline"
                onPress={() => {
                  setBlockers(null);
                  setTimeout(() => router.push(b.route as never), 120);
                }}
              />
            </View>
          ))}
          <Button title="Entendido" variant="outline" onPress={() => setBlockers(null)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
