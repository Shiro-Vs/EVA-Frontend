import React, { useState } from "react";
import { api } from "../../api/client";
import { Button, Card, Field, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useSubmit } from "../../hooks/useAsync";

/** Cómo se cobra al incorporar o dar de baja a alguien (antes estaba dentro de Perfil). */
export default function BillingSettingsScreen() {
  const { profile, setProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [freeDays, setFreeDays] = useState(String(profile?.defaultFreeDays ?? 0));
  const [limit, setLimit] = useState(profile?.exitDaysLimit == null ? "" : String(profile.exitDaysLimit));
  const [saved, setSaved] = useState(false);

  const g = Number.parseInt(freeDays, 10);
  const l = limit.trim() === "" ? null : Number.parseInt(limit, 10);
  const valid = displayName.trim().length > 0 && Number.isInteger(g) && g >= 0 && (l === null || (Number.isInteger(l) && l >= 0));
  const save = useSubmit(async () => {
    setProfile(await api.patchMe({ displayName: displayName.trim(), defaultFreeDays: g, exitDaysLimit: l }, profile!.version));
    setSaved(true);
  });

  if (!profile) return <Screen title="Ajustes de cobro"><Loading /></Screen>;
  return (
    <Screen title="Ajustes de cobro" footer={<Button title="Guardar ajustes" busy={save.busy} disabled={!valid} onPress={save.submit} />}>
      <Card>
        <Field label="Nombre" value={displayName} onChangeText={(v) => { setDisplayName(v); setSaved(false); }} autoCapitalize="words" />
        <Field label="Días gratis al incorporar (g)" value={freeDays} onChangeText={(v) => { setFreeDays(v); setSaved(false); }} keyboardType="number-pad" error={Number.isInteger(g) && g >= 0 ? undefined : "Usa un entero de 0 en adelante"} />
        <Txt size={12} muted>Si a la persona le faltan g días o menos para la renovación, ese tramo inicial es gratis. 0 = nunca.</Txt>
        <Field label="Días para terminar el ciclo en una baja (L)" value={limit} onChangeText={(v) => { setLimit(v); setSaved(false); }} keyboardType="number-pad" placeholder="Sin definir" />
      </Card>
      {saved && <Notice tone="ok">Guardado. Rige para los ingresos nuevos; los cargos ya emitidos no cambian.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}
