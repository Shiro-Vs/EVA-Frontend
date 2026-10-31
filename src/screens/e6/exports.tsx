import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { ExportBody, ExportJob, ExportPreview, SectionId } from "../../api/types";
import { Choice } from "../../components/v1/forms";
import { Badge, Button, Card, Chip, Empty, ErrorBox, Heading, KV, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { saveAndShare } from "../../utils/files";
import { formatSoles } from "../../utils/money";
import { initialScope, MultiChoice, ScopeForm } from "../e4/shared";

const SECTIONS: Array<[SectionId, string, string]> = [
  ["transactions", "Movimientos", "Un renglón por asiento"],
  ["flow", "Flujo de dinero", "Lo que entró y salió de tus cuentas"],
  ["income_by_category", "Ingresos por categoría", ""],
  ["expense_by_category", "Gastos por categoría", "Con gráfico en el PDF"],
  ["accounts", "Cuentas", "Saldo inicial y final"],
  ["services", "Costo de servicios", "Por servicio o por ciclo"],
  ["contacts", "Contactos", "Pendiente y saldo a favor"],
  ["loans", "Préstamos", "Otorgados, recibidos y bancarios"],
  ["budgets", "Presupuestos", ""],
  ["goals", "Metas", ""],
];
const TITLE = Object.fromEntries(SECTIONS.map(([id, t]) => [id, t])) as Record<SectionId, string>;
const FORMAT_TEXT = { csv: "CSV (varias secciones: ZIP)", xlsx: "Excel (una hoja por sección)", pdf: "PDF (con gráfico)" } as const;
const STATUS_TEXT: Record<ExportJob["status"], string> = { queued: "En cola", running: "Generando", done: "Lista", failed: "Falló", expired: "Vencida" };
const cell = (v: string | number | null, type: string) => (v === null ? "" : type === "money" ? formatSoles(String(v)) : type === "percent" ? `${v} %` : String(v));

// ───────────────────────── Exportar ─────────────────────────

export function ExportScreen() {
  const router = useRouter();
  const [scope, setScope] = useState(() => { const s = initialScope(); return { from: s.from, to: s.to, accountIds: [] as string[] }; });
  const [order, setOrder] = useState<SectionId[]>(["flow", "expense_by_category", "accounts"]);
  const [level, setLevel] = useState<"summary" | "detail">("summary");
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx");
  const [pv, setPv] = useState<ExportPreview | null>(null);
  const [job, setJob] = useState<ExportJob | null>(null);
  const recent = useAsync(() => api.exports(), []);
  useFocusReload(recent.reload);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const body = (): ExportBody => ({ from: scope.from, to: scope.to, ...(scope.accountIds.length ? { accountIds: scope.accountIds } : {}), sections: order, level, format });
  const touch = () => { setPv(null); setJob(null); };
  const move = (i: number, d: number) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; setOrder(n); touch(); };
  const toggle = (id: SectionId) => { setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])); touch(); };

  const preview = useSubmit(async () => { setJob(null); setPv(await api.previewExport(body())); });
  const create = useSubmit(async (key: string) => {
    const j = await api.createExport(body(), key);
    setJob(j);
    if (j.status === "queued" || j.status === "running") {
      timer.current = setInterval(async () => {
        try { const n = await api.exportJob(j.id); setJob(n); if (n.status !== "queued" && n.status !== "running") { if (timer.current) clearInterval(timer.current); void recent.reload(); } } catch { if (timer.current) clearInterval(timer.current); }
      }, 1500);
    } else void recent.reload();
  });
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const download = useSubmit(async (_k: string, id: string, name?: string | null) => { const f = await api.downloadExport(id); await saveAndShare(f.bytes, f.filename ?? name ?? "exportacion", "application/octet-stream"); });
  const ready = order.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(scope.from) && /^\d{4}-\d{2}-\d{2}$/.test(scope.to) && scope.from <= scope.to;
  const inactive = SECTIONS.filter(([id]) => !order.includes(id));

  return (
    <Screen title="Exportar" subtitle="Elige qué, en qué orden y en qué formato"
      footer={job ? undefined : <Button title={pv ? `Generar ${format.toUpperCase()}` : "Ver vista previa"} busy={pv ? create.busy : preview.busy} disabled={!ready} onPress={pv ? create.submit : preview.submit} />}>
      <Card>
        <ScopeForm value={{ ...scope }} onChange={(s) => { setScope({ from: s.from, to: s.to, accountIds: s.accountIds ?? [] }); touch(); }} accountsOnly />
      </Card>

      <Heading>Secciones, en este orden</Heading>
      {order.length === 0 && <Notice tone="warn">Elige al menos una sección.</Notice>}
      {order.map((id, i) => (
        <Card key={id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt style={{ flex: 1 }} bold>{i + 1}. {TITLE[id]}</Txt>
            <Button title="↑" variant="secondary" disabled={i === 0} onPress={() => move(i, -1)} />
            <Button title="↓" variant="secondary" disabled={i === order.length - 1} onPress={() => move(i, 1)} />
            <Button title="Quitar" variant="secondary" size="small" onPress={() => toggle(id)} />
          </View>
        </Card>
      ))}
      <MultiChoice label="Agregar sección" options={inactive.map(([id, t]) => ({ id, label: t }))} value={[]} onChange={(v) => { if (v[0]) toggle(v[0] as SectionId); }} />

      <Card>
        <Choice label="Nivel" value={level} onChange={(v) => { setLevel(v); touch(); }} options={[{ id: "summary", label: "Resumen" }, { id: "detail", label: "Con detalle", hint: "servicios por ciclo" }]} />
        <Choice label="Formato" value={format} onChange={(v) => { setFormat(v); touch(); }} options={(Object.keys(FORMAT_TEXT) as Array<keyof typeof FORMAT_TEXT>).map((f) => ({ id: f, label: FORMAT_TEXT[f] }))} />
      </Card>
      {(preview.error || create.error) && <Notice tone="err">{preview.error ?? create.error}</Notice>}

      {pv && !job && (
        <>
          <Heading>Vista previa</Heading>
          {pv.async && <Notice tone="info">Es grande: se generará en segundo plano y podrás descargarla cuando esté lista.</Notice>}
          {pv.sections.map((s) => (
            <Card key={s.id} outlined>
              <Txt bold>{s.title} · {s.rows} fila(s)</Txt>
              {s.note && <Txt size={11} muted>{s.note}</Txt>}
              {s.sample.slice(0, 4).map((r, i) => (
                <Txt key={i} size={12}>{s.columns.slice(0, 4).map((c) => cell(r[c.key] ?? null, c.type)).filter(Boolean).join(" · ")}</Txt>
              ))}
              {s.rows > 4 && <Txt size={11} muted>… y {s.rows - 4} más</Txt>}
              {s.totals && Object.entries(s.totals).slice(0, 3).map(([k, v]) => { const col = s.columns.find((c) => c.key === k); return v === null ? null : <KV key={k} label={`Total ${col?.label ?? k}`} value={cell(v, col?.type ?? "text")} />; })}
            </Card>
          ))}
          {pv.warnings.map((w, i) => <Notice key={i} tone="info">{w}</Notice>)}
        </>
      )}

      {job && (
        <Card>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Chip status={job.status === "done" ? "paid" : job.status === "failed" ? "overdue" : "partial"} label={STATUS_TEXT[job.status]} />{job.rows > 0 && <Txt size={12} muted>{job.rows} filas</Txt>}</View>
          {job.status === "failed" && <Notice tone="err">No se pudo generar ({job.errorCode ?? "error"}). Acota el periodo o las cuentas e inténtalo otra vez.</Notice>}
          {job.status === "done" && <Button title="Descargar" icon="download-outline" busy={download.busy} onPress={() => download.submit(job.id, job.filename)} />}
          {job.status === "done" && job.expiresAt && <Txt size={11} muted>El archivo se borra el {humanDate(job.expiresAt.slice(0, 10))}.</Txt>}
          <Button title="Nueva exportación" variant="secondary" onPress={() => { setJob(null); setPv(null); }} />
          {download.error && <Notice tone="err">{download.error}</Notice>}
        </Card>
      )}

      <Button title="Estado de cuenta de un contacto" variant="secondary" icon="person-outline" onPress={() => router.push("/export/contact" as never)} />

      <Heading>Recientes</Heading>
      {recent.loading && !recent.data ? <Loading /> : recent.error ? <ErrorBox message={recent.error} onRetry={recent.reload} /> : (recent.data ?? []).length === 0 ? (
        <Empty icon="download-outline" title="Sin exportaciones" text="Las que generes quedan 24 horas para descargarlas." />
      ) : (recent.data ?? []).map((j) => (
        <Card key={j.id} outlined>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><Txt bold size={13}>{j.filename ?? j.format.toUpperCase()}</Txt><Txt size={11} muted>{humanDate(j.createdAt.slice(0, 10))} · {STATUS_TEXT[j.status]}</Txt></View>
            {j.status === "done" ? <Button title="Descargar" variant="secondary" busy={download.busy} onPress={() => download.submit(j.id, j.filename)} /> : <Badge text={STATUS_TEXT[j.status]} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

// ───────────────────────── Estado de cuenta de un contacto ─────────────────────────

export function ContactStatementExportScreen() {
  const contacts = useAsync(() => api.contacts(), []);
  const [id, setId] = useState<string | null>(null);
  const [format, setFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");
  const go = useSubmit(async () => { const f = await api.contactStatementFile(id!, format); await saveAndShare(f.bytes, f.filename ?? `estado-de-cuenta.${format}`, "application/octet-stream"); });
  return (
    <Screen title="Estado de cuenta" subtitle="Un documento por contacto" footer={<Button title="Descargar" icon="download-outline" busy={go.busy} disabled={!id} onPress={go.submit} />}>
      {contacts.loading && !contacts.data ? <Loading /> : contacts.error ? <ErrorBox message={contacts.error} onRetry={contacts.reload} /> : (
        <Card>
          <Choice label="Contacto" value={id} onChange={setId} options={(contacts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name }))} />
          <Choice label="Formato" value={format} onChange={setFormat} options={[{ id: "pdf", label: "PDF" }, { id: "xlsx", label: "Excel" }, { id: "csv", label: "CSV" }]} />
          <Txt size={12} muted>Incluye resumen, cargos por servicio y plaza, y préstamos. Lo convertido a préstamo se marca como traslado y no se suma dos veces. Es un documento: no se envía nada a nadie.</Txt>
        </Card>
      )}
      {go.error && <Notice tone="err">{go.error}</Notice>}
    </Screen>
  );
}
