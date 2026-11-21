// TEMPORAL: apartado para probar todas las notificaciones de EVA en el celular.
// Para eliminarlo después: borra este archivo, quita su importación/uso en src/screens/e5/settings.tsx
// y quita `scheduleTestNotification` en src/notifications/scheduler.ts.

import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Heading, KV, Notice, Txt } from "../components/v1/ui";
import { useAppTheme } from "../hooks/useAppTheme";
import { scheduleTestNotification, syncReminders, type Permission } from "./scheduler";

interface TestSample {
  kind: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  discreetBody: string;
  detailBody: string;
  route: string;
  routeLabel: string;
}

const SAMPLES: TestSample[] = [
  {
    kind: "renewal",
    label: "Renovación de servicio",
    icon: "repeat-outline",
    discreetBody: "Tienes renovaciones próximas",
    detailBody: "Renueva Netflix (S/ 45.00)",
    route: "/(main)/planning",
    routeLabel: "Servicios",
  },
  {
    kind: "collection",
    label: "Cobros pendientes",
    icon: "people-outline",
    discreetBody: "Tienes cobros por revisar",
    detailBody: "2 cobro(s) por S/ 40.00",
    route: "/contacts",
    routeLabel: "Contactos",
  },
  {
    kind: "recurring",
    label: "Movimiento recurrente",
    icon: "calendar-outline",
    discreetBody: "Tienes movimientos recurrentes por decidir",
    detailBody: "Alquiler (S/ 800.00)",
    route: "/recurring",
    routeLabel: "Recurrentes",
  },
  {
    kind: "loan",
    label: "Cuota de préstamo bancario",
    icon: "card-outline",
    discreetBody: "Tienes cuotas de préstamo próximas",
    detailBody: "Préstamo Personal: cuota 3 (S/ 250.00)",
    route: "/bank-loans",
    routeLabel: "Préstamos",
  },
  {
    kind: "budget",
    label: "Presupuesto en umbral",
    icon: "pie-chart-outline",
    discreetBody: "Un presupuesto necesita tu atención",
    detailBody: "Alimentación al 85 %",
    route: "/budgets",
    routeLabel: "Presupuestos",
  },
  {
    kind: "capture",
    label: "Propuestas de captura",
    icon: "scan-outline",
    discreetBody: "Tienes propuestas por revisar",
    detailBody: "3 propuesta(s) por revisar",
    route: "/capture",
    routeLabel: "Bandeja de captura",
  },
];

const DELAYS = [
  { seconds: 2, label: "En 2 s (app abierta)" },
  { seconds: 10, label: "En 10 s (sal de la app)" },
] as const;

export function NotificationTestSection({
  discreet,
  perm,
  scheduledCount,
  onSyncDone,
}: {
  discreet: boolean;
  perm: Permission;
  scheduledCount: number | null;
  onSyncDone: () => void;
}) {
  const { colors } = useAppTheme();
  const [delay, setDelay] = useState<number>(2);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const sendOne = async (s: TestSample) => {
    setStatus(null);
    setBusyKey(s.kind);
    try {
      const body = discreet ? s.discreetBody : s.detailBody;
      await scheduleTestNotification({ title: "EVA", body, route: s.route, delaySeconds: delay });
      setStatus({
        tone: "ok",
        text: `«${s.label}» llegará en ${delay} s${delay >= 10 ? " (minimiza EVA ahora para probarla en segundo plano)" : ""}. Al tocarla abrirá ${s.routeLabel}.`,
      });
    } catch (e) {
      setStatus({ tone: "err", text: (e as Error)?.message || "No se pudo programar la notificación de prueba." });
    } finally {
      setBusyKey(null);
    }
  };

  const sendAll = async () => {
    setStatus(null);
    setBusyKey("__all__");
    try {
      for (let i = 0; i < SAMPLES.length; i++) {
        const s = SAMPLES[i]!;
        const body = discreet ? s.discreetBody : s.detailBody;
        await scheduleTestNotification({
          title: "EVA",
          body,
          route: s.route,
          delaySeconds: delay + i * 3,
        });
      }
      setStatus({
        tone: "ok",
        text: `Se programaron las ${SAMPLES.length} notificaciones (saldrán cada 3 s empezando en ${delay} s).`,
      });
    } catch (e) {
      setStatus({ tone: "err", text: (e as Error)?.message || "No se pudieron programar las pruebas." });
    } finally {
      setBusyKey(null);
    }
  };

  const syncNow = async () => {
    setStatus(null);
    setBusyKey("__sync__");
    try {
      const res = await syncReminders();
      onSyncDone();
      if (!res) {
        setStatus({ tone: "err", text: "Sin permiso o dispositivo no compatible para sincronizar." });
      } else {
        setStatus({
          tone: "ok",
          text: `Sincronización lista: ${res.total} aviso(s) reales programados en tu celular (${res.scheduled} nuevos, ${res.cancelled} cancelados).`,
        });
      }
    } catch (e) {
      setStatus({ tone: "err", text: (e as Error)?.message || "Error al sincronizar recordatorios." });
    } finally {
      setBusyKey(null);
    }
  };

  const disabled = perm === "unsupported" || perm === "denied";

  return (
    <>
      <Heading action={<Badge text="Temporal" tone="warn" />}>Pruebas de notificaciones</Heading>
      <Card>
        <Notice tone="warn">
          Apartado temporal para verificar que los 6 tipos de notificación de EVA llegan con sonido, banner y abren su pantalla al tocarlas.
        </Notice>

        <KV
          label="Programadas en este celular"
          value={scheduledCount === null ? "—" : String(scheduledCount)}
          strong
        />
        <KV
          label="Modo de texto actual"
          value={discreet ? "Discreto (genérico)" : "Con detalle"}
        />

        <View style={{ gap: 6, marginTop: 2 }}>
          <Txt size={12} bold muted>Cuándo disparar la prueba</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {DELAYS.map((d) => {
              const on = delay === d.seconds;
              return (
                <TouchableOpacity
                  key={d.seconds}
                  onPress={() => setDelay(d.seconds)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? colors.primarySurface : `${colors.primary}14`,
                  }}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Probar todas (6)"
              icon="notifications-outline"
              size="compact"
              disabled={disabled || busyKey !== null}
              busy={busyKey === "__all__"}
              onPress={sendAll}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Sincronizar reales"
              icon="refresh-outline"
              variant="secondary"
              size="compact"
              disabled={disabled || busyKey !== null}
              busy={busyKey === "__sync__"}
              onPress={syncNow}
            />
          </View>
        </View>

        {status && <Notice tone={status.tone}>{status.text}</Notice>}

        <View style={{ gap: 8, marginTop: 4 }}>
          {SAMPLES.map((s) => {
            const preview = discreet ? s.discreetBody : s.detailBody;
            return (
              <View
                key={s.kind}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: colors.elevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}>
                  <Ionicons name={s.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt bold size={13} numberOfLines={1}>{s.label}</Txt>
                  <Txt size={12} muted numberOfLines={2}>{preview}</Txt>
                  <Txt size={11} color={colors.primary}>Al tocar → {s.routeLabel}</Txt>
                </View>
                <Button
                  title="Probar"
                  variant="secondary"
                  size="small"
                  disabled={disabled || busyKey !== null}
                  busy={busyKey === s.kind}
                  onPress={() => void sendOne(s)}
                />
              </View>
            );
          })}
        </View>
      </Card>
    </>
  );
}
