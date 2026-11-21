import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../api/client";
import { Button, Card, Field, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";

const INT_RE = /^\d+$/;

/** Cómo se cobra al incorporar o dar de baja a alguien (antes estaba dentro de Perfil). */
export default function BillingSettingsScreen() {
  const { profile, setProfile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [freeDays, setFreeDays] = useState(String(profile?.defaultFreeDays ?? 0));
  const [limit, setLimit] = useState(profile?.exitDaysLimit == null ? "" : String(profile.exitDaysLimit));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Al volver a esta pantalla refresca profile (y su version) para evitar 409 CONFLICT_VERSION tras cambiar otras preferencias.
  useFocusReload(() => { void refreshProfile(); });

  useEffect(() => {
    if (!profile || dirty) return;
    setDisplayName(profile.displayName);
    setFreeDays(String(profile.defaultFreeDays));
    setLimit(profile.exitDaysLimit == null ? "" : String(profile.exitDaysLimit));
  }, [profile, dirty]);

  const g = INT_RE.test(freeDays.trim()) ? Number.parseInt(freeDays.trim(), 10) : Number.NaN;
  const l = limit.trim() === "" ? null : INT_RE.test(limit.trim()) ? Number.parseInt(limit.trim(), 10) : Number.NaN;
  const nameErr = displayName.trim().length === 0 ? "Escribe tu nombre" : displayName.trim().length > 80 ? "Máximo 80 caracteres" : undefined;
  const freeErr = Number.isInteger(g) && g >= 0 && g <= 365 ? undefined : "Usa un entero entre 0 y 365";
  const limitErr = l === null || (Number.isInteger(l) && l >= 0 && l <= 365) ? undefined : "Usa un entero entre 0 y 365 o déjalo vacío";
  const valid = !nameErr && !freeErr && !limitErr;
  const save = useSubmit(async () => {
    const fresh = (await refreshProfile()) ?? profile!;
    const updated = await api.patchMe({ displayName: displayName.trim(), defaultFreeDays: g, exitDaysLimit: l }, fresh.version);
    setProfile(updated);
    setDirty(false);
    setSaved(true);
  });

  if (!profile) return <Screen title="Ajustes de cobro"><Loading /></Screen>;
  return (
    <Screen title="Ajustes de cobro" footer={<Button title="Guardar ajustes" busy={save.busy} disabled={!valid} onPress={save.submit} />}>
      <Card>
        <Field label="Nombre" value={displayName} onChangeText={(v) => { setDisplayName(v); setDirty(true); setSaved(false); }} autoCapitalize="words" maxLength={80} error={nameErr} />
        <View style={{ gap: 2 }}>
          <Field label="Días gratis al incorporar" value={freeDays} onChangeText={(v) => { setFreeDays(v); setDirty(true); setSaved(false); }} keyboardType="number-pad" maxLength={3} error={freeErr} />
          <Txt size={12} muted style={{ marginLeft: 4 }}>Si a la persona le faltan esos días o menos para la renovación, ese tramo inicial es gratis. 0 = nunca.</Txt>
        </View>
        <View style={{ gap: 2 }}>
          <Field label="Días mínimos para terminar el ciclo en una baja" value={limit} onChangeText={(v) => { setLimit(v); setDirty(true); setSaved(false); }} keyboardType="number-pad" maxLength={3} placeholder="Sin definir" error={limitErr} />
          <Txt size={12} muted style={{ marginLeft: 4 }}>Si la persona lleva esa cantidad de días o más en el ciclo, termina el ciclo sin devolución. Déjalo vacío si no aplica.</Txt>
        </View>
      </Card>
      {saved && <Notice tone="ok">Guardado. Rige para los ingresos nuevos; los cargos ya emitidos no cambian.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}
