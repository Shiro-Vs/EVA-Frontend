import React, { useEffect, useState } from "react";
import { View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { BackupMeta, Preferences, Preview, RestorePreview } from "../../api/types";
import { Choice, usePreviewFlow } from "../../components/v1/forms";
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { saveAndShare } from "../../utils/files";
import { formatSoles } from "../../utils/money";
import { uriToBase64 } from "../e4/shared";

const KIND: Record<BackupMeta["kind"], string> = { manual: "Manual", auto: "Automático", recovery: "Recuperación", imported: "Importado" };
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

// ───────────────────────── Lista ─────────────────────────

export function BackupsScreen() {
  const router = useRouter();
  const list = useAsync(() => api.backups(), []);
  const prefs = useAsync(() => api.preferences(), []);
  useFocusReload(list.reload);
  const [note, setNote] = useState("");
  const [bk, setBk] = useState<Preferences["backup"] | null>(null);
  const [saved, setSaved] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  useEffect(() => { if (prefs.data) setBk(prefs.data.backup); }, [prefs.data]);

  const create = useSubmit(async () => { await api.createBackup(note.trim() || undefined); setNote(""); await list.reload(); });
  const savePrefs = useSubmit(async () => { await api.savePreferences({ backup: bk! }); setSaved(true); });
  const download = useSubmit(async (_k: string, id: string) => { const f = await api.downloadBackup(id); await saveAndShare(f.bytes, f.filename ?? "respaldo.eva-backup", "application/octet-stream"); });
  const remove = useSubmit(async (_k: string, id: string) => { await api.deleteBackup(id); setDelId(null); await list.reload(); });
  const pick = useSubmit(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled) return;
    await api.importBackup(await uriToBase64(res.assets[0]!.uri));
    await list.reload();
  });

  return (
    <Screen title="Respaldos" subtitle="Copias recuperables de tus datos">
      <Card>
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} autoCapitalize="sentences" placeholder="Antes de probar algo" maxLength={200} />
        <Button title="Crear respaldo ahora" icon="cloud-done-outline" busy={create.busy} onPress={create.submit} />
        <Button title="Importar un archivo de respaldo" variant="secondary" icon="folder-open-outline" busy={pick.busy} onPress={pick.submit} />
        {[create.error, pick.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}
      </Card>

      {bk && (
        <Card>
          <Txt bold>Copias automáticas</Txt>
          <Choice label="Frecuencia" value={bk.frequency} onChange={(v) => { setBk({ ...bk, frequency: v }); setSaved(false); }} options={[{ id: "off", label: "Apagadas" }, { id: "weekly", label: "Semanal" }, { id: "monthly", label: "Mensual" }]} />
          <Choice label="Cuántas conservar" value={String(bk.keep)} onChange={(v) => { setBk({ ...bk, keep: Number(v) as 1 | 2 }); setSaved(false); }} options={[{ id: "1", label: "La última" }, { id: "2", label: "Las dos últimas" }]} />
          <Button title="Guardar" variant="secondary" busy={savePrefs.busy} onPress={savePrefs.submit} />
          {saved && <Notice tone="ok">Guardado.</Notice>}
          {savePrefs.error && <Notice tone="err">{savePrefs.error}</Notice>}
          <Txt size={12} muted>Se crean con el trabajo diario del servidor. Una copia vigente no se borra hasta verificar la nueva.</Txt>
        </Card>
      )}

      <Heading>Tus respaldos</Heading>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data ?? []).length === 0 ? (
        <Empty icon="cloud-offline-outline" title="Sin respaldos" text="Crea el primero. Incluye tus datos, no los archivos originales de captura." />
      ) : (list.data ?? []).map((b) => (
        <Card key={b.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Chip status={b.kind === "recovery" ? "partial" : "converted"} label={KIND[b.kind]} />
            {b.encrypted && <Badge text="Cifrado" tone="info" />}
            <Txt bold style={{ flex: 1 }}>{humanDate(b.createdAt.slice(0, 10))}</Txt>
          </View>
          <Txt size={12} muted>{b.totalRows} registros · {mb(b.sizeBytes)}{b.note ? ` · ${b.note}` : ""}</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Restaurar" onPress={() => router.push(`/settings/backups/${b.id}` as never)} /></View>
            <View style={{ flex: 1 }}><Button title="Descargar" variant="secondary" busy={download.busy} onPress={() => download.submit(b.id)} /></View>
          </View>
          {delId === b.id ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Sí, eliminar" variant="danger" busy={remove.busy} onPress={() => remove.submit(b.id)} /></View>
              <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setDelId(null)} /></View>
            </View>
          ) : <Button title="Eliminar archivo" variant="secondary" onPress={() => setDelId(b.id)} />}
        </Card>
      ))}
      {[download.error, remove.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}
      <Notice tone="info">Al eliminar un respaldo, copias antiguas del archivo pueden persistir en el almacenamiento hasta que se roten.</Notice>
    </Screen>
  );
}

// ───────────────────────── Restaurar ─────────────────────────

export function RestoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const meta = useAsync(() => api.backups(), []);
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const flow = usePreviewFlow({
    preview: () => api.previewRestore(id, mode) as unknown as Promise<Preview>,
    apply: (token, key) => api.restoreBackup(id, { mode, previewToken: token }, key),
  });
  const [done, setDone] = useState<Awaited<ReturnType<typeof api.restoreBackup>> | null>(null);
  const b = meta.data?.find((x) => x.id === id);
  const pv = flow.data as unknown as RestorePreview | null;

  if (meta.loading && !meta.data) return <Screen title="Restaurar"><Loading /></Screen>;
  if (done) {
    return (
      <Screen title="Restauración lista" footer={<Button title="Volver a respaldos" onPress={() => router.replace("/settings/backups" as never)} />}>
        <Notice tone="ok">{done.mode === "replace" ? "Tus datos se reemplazaron por los del respaldo." : "Se incorporó lo que faltaba."}</Notice>
        {done.balancesMatch === true && <Notice tone="ok">Los saldos coinciden con los del respaldo.</Notice>}
        <Card outlined>
          <Txt bold>Copia de recuperación</Txt>
          <Txt size={12} muted>Se guardó antes de restaurar. Si algo no es lo esperado, restáurala desde la lista de respaldos.</Txt>
          <Button title="Ver mis respaldos" variant="secondary" onPress={() => router.replace("/settings/backups" as never)} />
        </Card>
        <Card outlined>
          {Object.entries(done.inserted).filter(([, n]) => n > 0).map(([t, n]) => <KV key={t} label={t} value={String(n)} />)}
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title="Restaurar" subtitle={b ? `${KIND[b.kind]} · ${humanDate(b.createdAt.slice(0, 10))}` : undefined}
      footer={flow.canConfirm
        ? <View style={{ gap: 8 }}><Button title={mode === "replace" ? "Reemplazar mis datos" : "Incorporar lo que falta"} variant={mode === "replace" ? "danger" : "primary"} busy={flow.applying} onPress={async () => { const r = await flow.confirm(); if (r) setDone(r as never); }} /><Button title="Cambiar" variant="secondary" onPress={flow.invalidate} /></View>
        : <Button title="Ver qué pasaría" busy={flow.loading} onPress={flow.run} />}>
      <Card>
        <Choice label="Cómo restaurar" value={mode} onChange={(v) => { setMode(v); flow.invalidate(); }} options={[{ id: "merge", label: "Incorporar lo que falta", hint: "no toca lo que ya tienes" }, { id: "replace", label: "Reemplazar todo", hint: "vuelve al estado del respaldo" }]} />
        <Txt size={12} muted>Antes de cambiar nada se guarda una copia de recuperación. Restaurar no crea ingresos ni gastos nuevos ni ejecuta pagos.</Txt>
      </Card>
      {flow.error && <Notice tone="err">{flow.error}</Notice>}
      {pv && (
        <>
          {pv.warnings.map((w, i) => <Notice key={i} tone={i === 0 && mode === "replace" ? "warn" : "info"}>{w}</Notice>)}
          <Card outlined>
            <Txt bold>Qué cambia</Txt>
            {pv.report.filter((r) => r.inBackup > 0 || r.current > 0).map((r) => (
              <KV key={r.table} label={r.table} value={mode === "replace" ? `${r.current} → ${r.inBackup}` : `+${r.willAdd}${r.alreadyThere ? ` (ya había ${r.alreadyThere})` : ""}`} />
            ))}
          </Card>
          {mode === "replace" && (
            <Card outlined>
              <Txt bold>Saldos por cuenta</Txt>
              {Object.entries(pv.expectedBalances).map(([acc, v]) => <KV key={acc} label={`Cuenta ${acc.slice(0, 6)}…`} value={`${formatSoles(pv.currentBalances[acc] ?? "0.00")} → ${formatSoles(v)}`} />)}
            </Card>
          )}
        </>
      )}
      {flow.applyError && <Notice tone="err">{flow.applyError}</Notice>}
    </Screen>
  );
}
