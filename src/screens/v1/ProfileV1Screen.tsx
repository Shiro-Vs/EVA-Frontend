import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import { Button, Card, Field, Heading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppThemeContext } from "../../context/ThemeContext";

/** Perfil real y los ajustes que gobiernan el prorrateo: días gratis (g) y límite de baja inmediata (L). RN-I07. */
export default function ProfileV1Screen() {
  const router = useRouter();
  const { profile, setProfile, logout } = useAuth();
  const { theme, toggleTheme } = useAppThemeContext();
  const [freeDays, setFreeDays] = useState(String(profile?.defaultFreeDays ?? 0));
  const [limit, setLimit] = useState(profile?.exitDaysLimit == null ? "" : String(profile.exitDaysLimit));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  if (!profile) return null;

  const save = async () => {
    const g = Number.parseInt(freeDays, 10);
    const l = limit.trim() === "" ? null : Number.parseInt(limit, 10);
    if (!Number.isInteger(g) || g < 0 || (l !== null && (!Number.isInteger(l) || l < 0))) { setMsg({ tone: "err", text: "Usa números enteros de 0 en adelante." }); return; }
    setBusy(true); setMsg(null);
    try {
      setProfile(await api.patchMe({ defaultFreeDays: g, exitDaysLimit: l }, profile.version));
      setMsg({ tone: "ok", text: "Ajustes guardados. Rigen para los ingresos nuevos; los cargos ya emitidos no cambian." });
    } catch (e) { setMsg({ tone: "err", text: errorMessage(e) }); }
    finally { setBusy(false); }
  };

  return (
    <Screen title="Perfil" back={false}>
      <Card><Txt bold size={20}>{profile.displayName}</Txt><Txt muted>{profile.email}</Txt></Card>

      <Heading>Ajustes de cobro</Heading>
      <Card>
        <Field label="Días gratis al incorporar (g)" value={freeDays} onChangeText={setFreeDays} keyboardType="number-pad" />
        <Txt size={12} muted style={{ marginBottom: 14 }}>Si a la persona le faltan g días o menos para la renovación, ese tramo inicial es gratis. 0 = nunca hay tramo gratis.</Txt>
        <Field label="Días usados para terminar el ciclo en una baja (L)" value={limit} onChangeText={setLimit} keyboardType="number-pad" placeholder="Sin definir" />
        <Txt size={12} muted>Sin definir = toda baja termina el ciclo. Se usará al implementar las bajas.</Txt>
      </Card>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Button title="Guardar ajustes" onPress={save} busy={busy} />

      <Heading>Aplicación</Heading>
      <Button title={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"} variant="secondary" onPress={toggleTheme} />
      <Button title="Cerrar sesión" variant="danger" onPress={async () => { await logout(); router.replace("/"); }} />
      <View style={{ height: 8 }} />
    </Screen>
  );
}
