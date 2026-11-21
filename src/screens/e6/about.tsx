import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { session } from "../../api/http";
import { Badge, Button, Card, Heading, KV, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  channelLabel,
  extractManifestDate,
  extractManifestId,
  formatBuildDate,
  healthUrlFromApiBase,
  hostLabel,
  shortId,
} from "../../updates/aboutInfo";

const LOGO_LIGHT = require("../../../assets/splash-icon.png");
const LOGO_DARK = require("../../../assets/splash-icon-dark.png");

type RemoteCheck =
  | { kind: "idle" }
  | { kind: "disabled" }
  | { kind: "checking" }
  | { kind: "up_to_date"; checkedAt: Date }
  | { kind: "available"; updateId: string | null; createdAt: string | null; checkedAt: Date }
  | { kind: "error"; message: string; checkedAt: Date };

type ServerHealth =
  | { kind: "checking" }
  | { kind: "online"; latencyMs: number; commit: string | null; branch: string | null }
  | { kind: "offline" };

const PLATFORM_LABEL: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};

export function AboutScreen() {
  const { colors, isDark } = useAppTheme();
  const {
    currentlyRunning,
    isUpdatePending,
    downloadedUpdate,
    isDownloading,
    downloadProgress,
  } = Updates.useUpdates();

  const [remote, setRemote] = useState<RemoteCheck>(Updates.isEnabled ? { kind: "idle" } : { kind: "disabled" });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [apiHost, setApiHost] = useState("—");
  const [server, setServer] = useState<ServerHealth>({ kind: "checking" });

  const appName = Constants.expoConfig?.name ?? "EVA";
  const appVersion = Constants.expoConfig?.version ?? "—";
  const runtimeVersion = currentlyRunning.runtimeVersion ?? Updates.runtimeVersion ?? appVersion;
  const channel = channelLabel(currentlyRunning.channel ?? Updates.channel, Updates.isEnabled);
  const currentUpdateId = currentlyRunning.updateId ?? Updates.updateId;
  const currentCreatedAt = currentlyRunning.createdAt ?? Updates.createdAt;
  const isEmbedded = currentlyRunning.isEmbeddedLaunch;
  const bundledCommit = process.env.EXPO_PUBLIC_GIT_COMMIT?.trim() || null;
  const bundledMessage = process.env.EXPO_PUBLIC_UPDATE_MESSAGE?.trim() || null;
  const bundledDate = process.env.EXPO_PUBLIC_UPDATE_DATE?.trim() || null;

  const checkServer = useCallback(async () => {
    setServer({ kind: "checking" });
    try {
      const base = await session.getBaseUrl();
      setApiHost(hostLabel(base));
      const started = Date.now();
      const res = await fetch(healthUrlFromApiBase(base), { headers: { Accept: "application/json" } });
      if (!res.ok) {
        setServer({ kind: "offline" });
        return;
      }
      const latencyMs = Math.max(1, Date.now() - started);
      let commit: string | null = null;
      let branch: string | null = null;
      try {
        const json = (await res.json()) as { commit?: unknown; branch?: unknown };
        if (typeof json.commit === "string" && json.commit.trim()) commit = json.commit.trim();
        if (typeof json.branch === "string" && json.branch.trim()) branch = json.branch.trim();
      } catch {
        // /healthz sin JSON extendido: sigue siendo válido
      }
      setServer({ kind: "online", latencyMs, commit, branch });
    } catch {
      setServer({ kind: "offline" });
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    setApplyError(null);
    if (!Updates.isEnabled) {
      setRemote({ kind: "disabled" });
      return;
    }
    setRemote({ kind: "checking" });
    try {
      const result = await Updates.checkForUpdateAsync();
      const checkedAt = new Date();
      if (result.isAvailable) {
        setRemote({
          kind: "available",
          updateId: extractManifestId(result.manifest),
          createdAt: extractManifestDate(result.manifest),
          checkedAt,
        });
      } else {
        setRemote({ kind: "up_to_date", checkedAt });
      }
    } catch (e) {
      setRemote({
        kind: "error",
        message: (e as Error)?.message || "No se pudo consultar el servidor de actualizaciones.",
        checkedAt: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    void checkServer();
    if (Updates.isEnabled) void checkUpdates();
  }, [checkServer, checkUpdates]);

  const applyNow = async () => {
    setApplyError(null);
    setApplying(true);
    try {
      if (!isUpdatePending) {
        await Updates.fetchUpdateAsync();
      }
      await Updates.reloadAsync();
    } catch (e) {
      setApplyError((e as Error)?.message || "No se pudo aplicar la actualización. Revisa tu conexión e intenta otra vez.");
      setApplying(false);
    }
  };

  const pendingId = downloadedUpdate?.updateId ?? null;
  const pendingDate = downloadedUpdate?.createdAt ?? null;
  const deviceLabel = isEmbedded
    ? `v${appVersion} · Base`
    : `v${appVersion} · ${shortId(currentUpdateId)}`;

  const deployedStatus = (() => {
    if (!Updates.isEnabled) return { text: "Solo en app instalada", color: colors.textSecondary };
    if (isUpdatePending) return { text: `Lista (${shortId(pendingId)})`, color: colors.primary };
    if (remote.kind === "checking" || remote.kind === "idle") return { text: "Consultando…", color: colors.textSecondary };
    if (remote.kind === "available") return { text: `Nueva (${shortId(remote.updateId)})`, color: colors.warningStrong };
    if (remote.kind === "up_to_date") return { text: `Al día (${shortId(currentUpdateId)})`, color: colors.incomeStrong };
    return { text: "No se pudo comprobar", color: colors.expenseStrong };
  })();

  const channelTone = !Updates.isEnabled
    ? "info"
    : (currentlyRunning.channel ?? Updates.channel) === "production"
      ? "ok"
      : "warn";

  const platformLabel = PLATFORM_LABEL[Platform.OS] ?? Platform.OS;
  const osDetail = Platform.OS === "web" ? "Navegador web" : `${platformLabel} ${Platform.Version}`;
  const downloadPct = isDownloading && typeof downloadProgress === "number" ? Math.round(downloadProgress * 100) : null;

  return (
    <Screen title="Acerca de EVA" subtitle="Versión instalada, actualizaciones y servidor">
      <Card style={{ alignItems: "center", gap: 10, paddingVertical: 18 }}>
        <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
          <Image source={isDark ? LOGO_DARK : LOGO_LIGHT} style={{ width: 60, height: 60 }} resizeMode="contain" />
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Txt bold size={22}>{appName}</Txt>
          <Txt size={13} muted>Tus finanzas y servicios compartidos</Txt>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 2 }}>
          <Badge text={`v${appVersion}`} icon="apps-outline" tone="info" />
          <Badge text={channel} icon="git-branch-outline" tone={channelTone} />
          <Badge text={platformLabel} icon="phone-portrait-outline" />
        </View>
      </Card>

      <Heading>Actualizaciones</Heading>
      <Card>
        <KV label="En tu celular" value={deviceLabel} strong />
        <KV label={`Desplegado (${channel})`} value={deployedStatus.text} strong color={deployedStatus.color} />
        {(remote.kind === "up_to_date" || remote.kind === "available" || remote.kind === "error") && (
          <KV label="Última consulta" value={formatBuildDate(remote.checkedAt)} />
        )}

        {isUpdatePending ? (
          <>
            <Notice tone="info">
              Ya hay una versión nueva descargada{pendingDate ? ` (${formatBuildDate(pendingDate)})` : ""}. Toca el botón para reiniciar EVA y estrenarla ahora mismo.
            </Notice>
            <Button
              title={applying ? "Reiniciando…" : "Reiniciar y actualizar ahora"}
              icon="refresh-outline"
              busy={applying}
              onPress={applyNow}
            />
          </>
        ) : remote.kind === "available" ? (
          <>
            <Notice tone="warn">
              Hay una versión más nueva desplegada en {channel}
              {remote.createdAt ? ` (${formatBuildDate(remote.createdAt)})` : ""}. Puedes descargarla y aplicarla ahora.
            </Notice>
            <Button
              title={
                applying || isDownloading
                  ? (downloadPct !== null ? `Descargando (${downloadPct}%)…` : "Descargando…")
                  : "Descargar y actualizar ahora"
              }
              icon="cloud-download-outline"
              busy={applying || isDownloading}
              onPress={applyNow}
            />
          </>
        ) : remote.kind === "up_to_date" ? (
          <>
            <Notice tone="ok">Tienes instalada la última actualización desplegada en el canal {channel}.</Notice>
            <Button
              title="Buscar actualizaciones"
              icon="refresh-outline"
              variant="secondary"
              onPress={checkUpdates}
            />
          </>
        ) : remote.kind === "disabled" ? (
          <Notice tone="info">
            Estás en modo desarrollo o web. Las actualizaciones por internet solo se comprueban en la app instalada.
          </Notice>
        ) : remote.kind === "error" ? (
          <>
            <Notice tone="err">{remote.message}</Notice>
            <Button title="Reintentar búsqueda" icon="refresh-outline" variant="secondary" onPress={checkUpdates} />
          </>
        ) : (
          <Button
            title="Comprobando actualizaciones…"
            variant="secondary"
            busy
            onPress={() => {}}
          />
        )}

        {applyError && <Notice tone="err">{applyError}</Notice>}
      </Card>

      <Heading>En este celular</Heading>
      <Card>
        <KV label="Versión de la app" value={appVersion} strong />
        <KV label="Runtime nativo" value={runtimeVersion} />
        <KV label="Canal" value={channel} />
        <KV label="Origen" value={Updates.isEnabled ? (isEmbedded ? "Compilación base (APK/IPA)" : "Actualización OTA") : "Desarrollo local"} />
        <KV label="ID de actualización" value={shortId(currentUpdateId)} />
        {bundledCommit && <KV label="Commit" value={bundledCommit} />}
        <KV label="Publicada" value={formatBuildDate(currentCreatedAt ?? bundledDate)} />
        <KV label="Dispositivo" value={osDetail} />
        {bundledMessage && (
          <View style={{ backgroundColor: colors.elevated, borderRadius: 14, padding: 12, gap: 4, marginTop: 2 }}>
            <Txt size={11} bold muted style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>Notas de esta versión</Txt>
            <Txt size={13}>{bundledMessage}</Txt>
          </View>
        )}
        {currentUpdateId && (
          <View style={{ gap: 2, paddingTop: 2 }}>
            <Txt size={11} muted>Identificador completo</Txt>
            <Text selectable style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{currentUpdateId}</Text>
          </View>
        )}
      </Card>

      <Heading>Servidor desplegado</Heading>
      <Card>
        <KV
          label="Estado"
          value={
            server.kind === "online"
              ? `En línea (${server.latencyMs} ms)`
              : server.kind === "offline"
                ? "Sin conexión"
                : "Comprobando…"
          }
          strong
          color={server.kind === "online" ? colors.incomeStrong : server.kind === "offline" ? colors.expenseStrong : colors.textSecondary}
        />
        <KV label="API" value={apiHost} />
        {server.kind === "online" && server.commit && (
          <KV label="Commit del servidor" value={server.branch ? `${server.commit} (${server.branch})` : server.commit} />
        )}
        <Button
          title="Comprobar conexión"
          icon="pulse-outline"
          variant="secondary"
          size="compact"
          busy={server.kind === "checking"}
          onPress={checkServer}
        />
      </Card>
    </Screen>
  );
}
