import React, { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Preview, Proposal } from "../../api/types";
import { CategoryPicker, Choice, DateField, MoneyField, OptionalAccountPicker, ReasonField, usePreviewFlow } from "../../components/v1/forms";
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, RowLink, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles, normalizeMoneyInput } from "../../utils/money";
import { hhmm, isHHMM, uriToBase64 } from "./shared";

const MISSING: Record<string, string> = { accountId: "la cuenta", amount: "el importe", occurredOn: "la fecha", currency: "la moneda (solo soles)", toAccountId: "la cuenta de destino" };
const DOC_STATUS: Record<string, string> = { received: "Recibido", proposed: "Con propuestas", failed: "No se pudo leer", discarded: "Descartado", no_transaction: "Sin movimiento", loan_document: "Documento de préstamo" };
const ORIGIN: Record<string, string> = { email: "Correo", photo: "Foto", pdf: "PDF", text: "Texto" };
const KIND: Record<string, string> = { income: "Ingreso", expense: "Gasto", transfer: "Transferencia" };
const DUP_WHY: Record<string, string> = { operation_ref: "mismo número de operación", amount_account_window: "mismo importe y cuenta en menos de 24 h" };

const whenOf = (p: { occurredOn: string | null; occurredTime: string | null }) => (p.occurredOn ? `${humanDate(p.occurredOn)}${p.occurredTime ? ` · ${hhmm(p.occurredTime)}` : ""}` : "sin fecha");

function ProposalRow({ p, onPress }: { p: Proposal; onPress: () => void }) {
  return (
    <RowLink onPress={onPress}>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt bold>{p.counterparty ?? p.description ?? "Movimiento sin nombre"}</Txt>
        <Txt size={12} muted>{KIND[p.direction]} · {whenOf(p)}{p.channel ? ` · ${p.channel}` : ""}</Txt>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {p.missing.length > 0 && <Badge text={`Falta: ${p.missing.map((m) => MISSING[m] ?? m).join(", ")}`} tone="warn" />}
          {p.duplicates.length > 0 && <Badge text="Posible duplicado" tone="danger" />}
        </View>
      </View>
      <Txt bold>{p.amount ? formatSoles(p.amount) : "—"}</Txt>
    </RowLink>
  );
}

// ───────────────────────── Bandeja ─────────────────────────

export function CaptureInboxScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const addr = useAsync(() => api.inboxAddress(), []);
  const usage = useAsync(() => api.captureUsage(), []);
  const props = useAsync(() => api.proposals("pending"), []);
  const docs = useAsync(() => api.documents(), []);
  const reload = () => { void addr.reload(); void usage.reload(); void props.reload(); void docs.reload(); };
  useFocusReload(reload);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const rotate = useSubmit(async () => api.rotateInboxAddress());
  const retry = useSubmit(async (_k: string, id: string) => api.retryDocument(id));

  const pending = props.data ?? [];
  const failed = (docs.data ?? []).filter((d) => d.status === "failed");
  const loanDocs = (docs.data ?? []).filter((d) => d.status === "loan_document");
  const ready = pending.filter((p) => p.canAccept);

  return (
    <Screen title="Bandeja de captura" subtitle="La captura propone; tú confirmas">
      <Card>
        <Txt size={12} muted>Uso de IA hoy</Txt>
        {usage.data ? <Txt bold>{usage.data.today.used} de {usage.data.today.limit} tareas · {usage.data.provider.name === "none" ? "IA no disponible" : "IA activa"}</Txt> : <Txt muted>—</Txt>}
      </Card>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Subir foto, PDF o texto" icon="cloud-upload-outline" onPress={() => router.push("/capture/new" as never)} /></View>
      </View>

      <Heading>Por revisar</Heading>
      {props.loading && !props.data ? <Loading /> : props.error ? <ErrorBox message={props.error} onRetry={props.reload} /> : pending.length === 0 ? (
        <Empty icon="mail-open-outline" title="Nada por revisar" text="Sube un comprobante o reenvía un correo a tu dirección de recepción." />
      ) : (
        <>
          {pending.map((p) => <ProposalRow key={p.id} p={p} onPress={() => router.push(`/capture/proposal/${p.id}` as never)} />)}
          {ready.length > 1 && <Button title={`Revisar y aceptar varias (${ready.length})`} variant="secondary" icon="checkmark-done-outline" onPress={() => router.push("/capture/batch" as never)} />}
        </>
      )}

      {failed.length > 0 && (
        <>
          <Heading>No se pudieron leer</Heading>
          {failed.map((d) => (
            <Card key={d.id} outlined>
              <Txt bold>{ORIGIN[d.origin]}{d.filename ? ` · ${d.filename}` : d.subject ? ` · ${d.subject}` : ""}</Txt>
              <Txt size={12} muted>{d.error?.detail ?? "Error"}</Txt>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}><Button title="Reintentar" variant="secondary" busy={retry.busy} onPress={async () => { if (await retry.submit(d.id)) reload(); }} /></View>
                <View style={{ flex: 1 }}><Button title="Ver" variant="secondary" onPress={() => router.push(`/capture/document/${d.id}` as never)} /></View>
              </View>
            </Card>
          ))}
          {retry.error && <Notice tone="err">{retry.error}</Notice>}
        </>
      )}

      {loanDocs.length > 0 && (
        <>
          <Heading>Documentos de préstamo</Heading>
          {loanDocs.map((d) => (
            <RowLink key={d.id} onPress={() => router.push(`/capture/document/${d.id}` as never)}>
              <View style={{ flex: 1 }}><Txt bold>{ORIGIN[d.origin]}{d.filename ? ` · ${d.filename}` : ""}</Txt><Txt size={12} muted>Pendiente de asociar a un préstamo bancario</Txt></View>
            </RowLink>
          ))}
        </>
      )}

      <Heading>Tu dirección de recepción</Heading>
      <Card>
        {addr.data ? <Text selectable style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{addr.data.address}</Text> : addr.error ? <Notice tone="err">{addr.error}</Notice> : <Loading />}
        <Txt size={12} muted>Reenvía a esta dirección los comprobantes y estados de cuenta. Si se filtra, rótala: la anterior deja de recibir.</Txt>
        {confirmRotate ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Sí, rotar" variant="danger" busy={rotate.busy} onPress={async () => { if (await rotate.submit()) { setConfirmRotate(false); void addr.reload(); } }} /></View>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setConfirmRotate(false)} /></View>
          </View>
        ) : <Button title="Rotar dirección" variant="secondary" onPress={() => setConfirmRotate(true)} />}
        {rotate.error && <Notice tone="err">{rotate.error}</Notice>}
      </Card>
      <Button title="Reglas por remitente" variant="secondary" icon="funnel-outline" onPress={() => router.push("/capture/rules" as never)} />
    </Screen>
  );
}

// ───────────────────────── Subir ─────────────────────────

interface Picked { origin: "photo" | "pdf"; base64: string; mime: string; filename?: string; kb: number }

export function CaptureNewScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [pickErr, setPickErr] = useState<string | null>(null);
  const MAX_KB = 12 * 1024;

  const take = (p: Picked) => { if (p.kb > MAX_KB) setPickErr("El archivo supera los 12 MB."); else { setPickErr(null); setPicked(p); } };
  const pickImage = async (camera: boolean) => {
    try {
      if (camera) { const perm = await ImagePicker.requestCameraPermissionsAsync(); if (!perm.granted) return setPickErr("Sin permiso para usar la cámara."); }
      const res = camera ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
      if (res.canceled) return;
      const a = res.assets[0]!;
      const b64 = a.base64 ?? (await uriToBase64(a.uri));
      take({ origin: "photo", base64: b64, mime: a.mimeType ?? "image/jpeg", filename: a.fileName ?? undefined, kb: Math.round((b64.length * 0.75) / 1024) });
    } catch (e) { setPickErr(errorMessage(e)); }
  };
  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0]!;
      const b64 = await uriToBase64(a.uri);
      take({ origin: "pdf", base64: b64, mime: "application/pdf", filename: a.name, kb: Math.round((b64.length * 0.75) / 1024) });
    } catch (e) { setPickErr(errorMessage(e)); }
  };

  const send = useSubmit(async () => api.uploadDocument(mode === "text"
    ? { origin: "text", text: text.trim(), ...(sender.trim() ? { sender: sender.trim() } : {}), ...(subject.trim() ? { subject: subject.trim() } : {}) }
    : { origin: picked!.origin, mime: picked!.mime, ...(picked!.filename ? { filename: picked!.filename } : {}), contentBase64: picked!.base64 }));
  const ready = mode === "text" ? text.trim().length > 0 : !!picked;
  const go = async () => {
    const d = await send.submit();
    if (!d) return;
    if (d.proposals.length === 1) router.replace(`/capture/proposal/${d.proposals[0]!.id}` as never);
    else router.replace(`/capture/document/${d.id}` as never);
  };

  return (
    <Screen title="Subir documento" footer={<Button title="Analizar" busy={send.busy} disabled={!ready} onPress={go} />}>
      <Card>
        <Choice label="Qué subes" value={mode} onChange={(v) => { setMode(v); send.resetKey(); }} options={[{ id: "file", label: "Foto o PDF" }, { id: "text", label: "Texto pegado" }]} />
        {mode === "file" ? (
          <>
            <View style={{ gap: 8 }}>
              <Button title="Elegir foto de la galería" variant="secondary" icon="image-outline" onPress={() => pickImage(false)} />
              {Platform.OS !== "web" && <Button title="Tomar foto" variant="secondary" icon="camera-outline" onPress={() => pickImage(true)} />}
              <Button title="Elegir PDF" variant="secondary" icon="document-outline" onPress={pickPdf} />
            </View>
            {picked && <Notice tone="ok">{ORIGIN[picked.origin === "photo" ? "photo" : "pdf"]} listo: {picked.filename ?? "archivo"} ({picked.kb} KB)</Notice>}
            {pickErr && <Notice tone="err">{pickErr}</Notice>}
          </>
        ) : (
          <>
            <Field label="Texto del comprobante" value={text} onChangeText={(v) => { setText(v); send.resetKey(); }} multiline numberOfLines={6} autoCapitalize="sentences" placeholder="Pega aquí el texto del correo o del comprobante" />
            <Field label="Remitente (opcional)" value={sender} onChangeText={setSender} placeholder="notificaciones@banco.com" keyboardType="email-address" />
            <Field label="Asunto (opcional)" value={subject} onChangeText={setSubject} autoCapitalize="sentences" />
          </>
        )}
      </Card>
      <Notice tone="info">El contenido se envía al modelo de IA solo como dato a analizar. El resultado es una propuesta: nada afecta tus saldos hasta que la aceptes.</Notice>
      {send.error && <Notice tone="err">{send.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Propuesta ─────────────────────────

export function CaptureProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useAsync(() => api.proposal(id), [id]);
  const contacts = useAsync(() => api.contacts(), []);
  const accounts = useAsync(() => api.accounts(), []);
  useFocusReload(p.reload);

  const [form, setForm] = useState<{ direction: Proposal["direction"]; amount: string; date: string; time: string; accountId: string | null; toAccountId: string | null; categoryId: string | null; contactId: string | null; description: string } | null>(null);
  const [ack, setAck] = useState(false);
  const [shortfall, setShortfall] = useState(false);
  const [undoReason, setUndoReason] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!p.data) return;
    const x = p.data;
    setForm({ direction: x.direction, amount: x.amount ?? "", date: x.occurredOn ?? "", time: hhmm(x.occurredTime), accountId: x.accountId, toAccountId: x.toAccountId, categoryId: x.categoryId, contactId: x.contactId, description: x.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.data?.id, p.data?.version]);

  const flow = usePreviewFlow({
    preview: () => api.previewProposal(id) as unknown as Promise<Preview>,
    apply: (token, key) => api.acceptProposal(id, { previewToken: token, ...(ack ? { acknowledgeDuplicates: true } : {}), ...(shortfall ? { acceptReserveShortfall: true } : {}) }, key),
  });
  const save = useSubmit(async () => {
    const f = form!;
    return api.patchProposal(id, {
      direction: f.direction, amount: normalizeMoneyInput(f.amount) ?? null, occurredOn: f.date || null, occurredTime: f.time || null,
      accountId: f.accountId, toAccountId: f.direction === "transfer" ? f.toAccountId : null, categoryId: f.direction === "transfer" ? null : f.categoryId, contactId: f.direction === "transfer" ? null : f.contactId, description: f.description.trim() || null,
    }, p.data!.version);
  });
  const discard = useSubmit(async () => api.discardProposal(id));
  const undo = useSubmit(async () => api.undoProposal(id, undoReason.trim()));
  const link = useSubmit(async (_k: string, opId: string) => api.linkProposal(id, opId));

  if (p.loading && !p.data) return <Screen title="Propuesta"><Loading /></Screen>;
  if (p.error || !p.data || !form) return <Screen title="Propuesta"><ErrorBox message={p.error ?? "No se encontró la propuesta."} onRetry={p.reload} /></Screen>;
  const x = p.data;
  const pending = x.status === "pending";
  const dirty = pending && (form.direction !== x.direction || (normalizeMoneyInput(form.amount) ?? "") !== (x.amount ?? "") || form.date !== (x.occurredOn ?? "") || form.time !== hhmm(x.occurredTime)
    || form.accountId !== x.accountId || form.toAccountId !== x.toAccountId || form.categoryId !== x.categoryId || form.contactId !== x.contactId || form.description.trim() !== (x.description ?? ""));
  const valid = (form.amount === "" || !!normalizeMoneyInput(form.amount)) && (form.date === "" || isIsoDate(form.date)) && (form.time === "" || isHHMM(form.time));
  const touch = <K extends keyof NonNullable<typeof form>>(k: K) => (v: NonNullable<typeof form>[K]) => { setForm((f) => (f ? { ...f, [k]: v } : f)); flow.invalidate(); };
  const accName = (aid: string) => accounts.data?.find((a) => a.id === aid)?.name ?? "Cuenta";
  const after = async () => { flow.invalidate(); await p.reload(); };
  const prev = flow.data as unknown as { effects?: Array<{ accountId: string; before: string; after: string }> } | null;

  return (
    <Screen title={x.counterparty ?? "Propuesta"} subtitle={`${KIND[x.direction]} · ${whenOf(x)}`}>
      <Card outlined>
        <KV label="Origen" value={`${ORIGIN[x.source.origin] ?? x.source.origin}${x.source.sender ? ` · ${x.source.sender}` : ""}`} />
        {x.channel && <KV label="Canal" value={x.channel} />}
        {x.operationRef && <KV label="N.º de operación" value={x.operationRef} />}
        {x.concept && <KV label="Concepto" value={x.concept} />}
        {x.confidence !== null && <KV label="Confianza de la lectura" value={`${Math.round(x.confidence * 100)} %`} />}
        <Chip status={x.status} label={x.status === "pending" ? "Pendiente" : x.status === "accepted" ? "Aceptada" : x.status === "linked" ? "Vinculada" : "Descartada"} />
        <Button title="Ver documento de origen" variant="secondary" onPress={() => router.push(`/capture/document/${x.documentId}` as never)} />
      </Card>
      {x.warnings.map((w, i) => <Notice key={i} tone="warn">{w}</Notice>)}

      {pending ? (
        <>
          <Card>
            <Choice label="Tipo" value={form.direction} onChange={touch("direction")} options={[{ id: "expense", label: "Gasto" }, { id: "income", label: "Ingreso" }, { id: "transfer", label: "Transferencia" }]} />
            <MoneyField label="Importe" value={form.amount} onChange={touch("amount")} />
            <DateField label="Fecha" value={form.date} onChange={touch("date")} />
            <Field label="Hora (opcional) · HH:MM" value={form.time} onChangeText={touch("time")} placeholder="17:32" keyboardType="numbers-and-punctuation" error={form.time !== "" && !isHHMM(form.time) ? "Hora inválida" : undefined} />
            <OptionalAccountPicker label={form.direction === "transfer" ? "Sale de" : form.direction === "income" ? "Entra a" : "Se paga con"} value={form.accountId} onChange={touch("accountId")} />
            {form.direction === "transfer" && <OptionalAccountPicker label="Llega a" value={form.toAccountId} onChange={touch("toAccountId")} />}
            {form.direction !== "transfer" && <CategoryPicker value={form.categoryId} onChange={touch("categoryId")} />}
            {form.direction !== "transfer" && (contacts.data ?? []).length > 0 && (
              <Choice label="Persona (opcional)" value={form.contactId} onChange={(v) => touch("contactId")(v === form.contactId ? null : v)} options={(contacts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name }))} />
            )}
            <Field label="Descripción" value={form.description} onChangeText={touch("description")} autoCapitalize="sentences" maxLength={200} />
            {x.suggestedCategory && <Txt size={12} muted>La IA sugiere la categoría «{x.suggestedCategory}» (solo una sugerencia).</Txt>}
            {dirty && <Button title="Guardar cambios" busy={save.busy} disabled={!valid} onPress={async () => { if (await save.submit()) { flow.invalidate(); await p.reload(); } }} />}
            {save.error && <Notice tone="err">{save.error}</Notice>}
          </Card>

          {x.missing.length > 0 && <Notice tone="warn">Para poder aceptar falta: {x.missing.map((m) => MISSING[m] ?? m).join(", ")}.</Notice>}

          {x.duplicates.length > 0 && (
            <Card>
              <Txt bold>Posible duplicado</Txt>
              {x.duplicates.map((d) => (
                <View key={`${d.type}${d.id}`} style={{ gap: 6 }}>
                  <Txt size={13}>{d.type === "operation" ? "Ya hay un movimiento registrado" : "Hay otra propuesta"} ({DUP_WHY[d.reason] ?? d.reason}).</Txt>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><Button title="Verlo" variant="secondary" onPress={() => router.push((d.type === "operation" ? `/operation/${d.id}` : `/capture/proposal/${d.id}`) as never)} /></View>
                    {d.type === "operation" && <View style={{ flex: 1 }}><Button title="Es el mismo: vincular" busy={link.busy} onPress={async () => { if (await link.submit(d.id)) await after(); }} /></View>}
                  </View>
                </View>
              ))}
              <SwitchRow label="Es otra operación: aceptar de todos modos" value={ack} onValueChange={(v) => { setAck(v); flow.invalidate(); }} />
              {link.error && <Notice tone="err">{link.error}</Notice>}
            </Card>
          )}

          {flow.data && (
            <Card outlined>
              <Txt bold>Efecto al aceptar</Txt>
              {(prev?.effects ?? []).map((e) => <KV key={e.accountId} label={accName(e.accountId)} value={`${formatSoles(e.before)} → ${formatSoles(e.after)}`} />)}
            </Card>
          )}
          {flow.error && <Notice tone="err">{flow.error}</Notice>}
          {flow.applyError && <Notice tone="err">{flow.applyError}</Notice>}
          {flow.applyError?.toLowerCase().includes("meta") && (
            <SwitchRow label="Aceptar aunque deje metas con faltante" value={shortfall} onValueChange={(v) => { setShortfall(v); }} />
          )}
          {flow.canConfirm
            ? <Button title="Aceptar y registrar" busy={flow.applying} onPress={async () => { if (await flow.confirm()) await after(); }} />
            : <Button title="Ver efecto antes de aceptar" busy={flow.loading} disabled={!x.canAccept || dirty || !valid} onPress={flow.run} />}
          {dirty && <Txt size={12} muted>Guarda los cambios antes de aceptar.</Txt>}

          {confirmDiscard ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Sí, descartar" variant="danger" busy={discard.busy} onPress={async () => { if (await discard.submit()) router.replace("/capture" as never); }} /></View>
              <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setConfirmDiscard(false)} /></View>
            </View>
          ) : <Button title="Descartar propuesta" variant="secondary" onPress={() => setConfirmDiscard(true)} />}
          {discard.error && <Notice tone="err">{discard.error}</Notice>}
        </>
      ) : (
        <>
          <Card>
            <KV label="Importe" value={x.amount ? formatSoles(x.amount) : "—"} strong />
            <KV label="Cuenta" value={x.accountId ? accName(x.accountId) : "—"} />
            {x.description && <KV label="Descripción" value={x.description} />}
          </Card>
          {x.operationId && <Button title={x.status === "linked" ? "Ver el movimiento vinculado" : "Ver el movimiento registrado"} variant="secondary" onPress={() => router.push(`/operation/${x.operationId}` as never)} />}
          {(x.status === "accepted" || x.status === "linked") && (
            <Card>
              <Txt bold>Deshacer</Txt>
              <Txt size={12} muted>{x.status === "accepted" ? "Revierte el movimiento y devuelve la propuesta a revisión." : "Quita el vínculo y devuelve la propuesta a revisión."}</Txt>
              <ReasonField value={undoReason} onChange={setUndoReason} label="Motivo" />
              <Button title="Deshacer" variant="danger" busy={undo.busy} disabled={!undoReason.trim()} onPress={async () => { if (await undo.submit()) { setUndoReason(""); await p.reload(); } }} />
              {undo.error && <Notice tone="err">{undo.error}</Notice>}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

// ───────────────────────── Documento ─────────────────────────

export function CaptureDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const d = useAsync(() => api.document(id), [id]);
  useFocusReload(d.reload);
  const retry = useSubmit(async () => api.retryDocument(id));
  const discard = useSubmit(async () => api.discardDocument(id));
  const delFile = useSubmit(async () => api.deleteDocumentFile(id));
  if (d.loading && !d.data) return <Screen title="Documento"><Loading /></Screen>;
  if (d.error || !d.data) return <Screen title="Documento"><ErrorBox message={d.error ?? "No se encontró el documento."} onRetry={d.reload} /></Screen>;
  const x = d.data;
  const open = x.proposals.filter((p) => p.status === "pending").length;
  return (
    <Screen title={x.filename ?? x.subject ?? `${ORIGIN[x.origin]} recibido`} subtitle={DOC_STATUS[x.status]}>
      <Card outlined>
        <KV label="Origen" value={ORIGIN[x.origin] ?? x.origin} />
        {x.sender && <KV label="Remitente" value={x.sender} />}
        {x.subject && <KV label="Asunto" value={x.subject} />}
        <KV label="Tamaño" value={`${Math.max(1, Math.round(x.sizeBytes / 1024))} KB`} />
        <KV label="Original guardado" value={x.hasFile ? "Sí" : "No"} />
        <KV label="Intentos de lectura" value={String(x.attempts)} />
      </Card>
      {x.error && <Notice tone="err">{x.error.detail ?? x.error.code}</Notice>}
      {x.status === "no_transaction" && <Notice tone="info">La IA no encontró un movimiento en este documento (por ejemplo, publicidad).</Notice>}

      {x.status === "loan_document" && (
        <Card>
          <Txt bold>Este documento es de un préstamo</Txt>
          <Txt size={12} muted>Asócialo a un préstamo bancario para revisar qué datos o cuotas cambian antes de guardarlos.</Txt>
          <Button title="Usar en un préstamo bancario" icon="business-outline" onPress={() => router.push(`/capture/document/${id}/loan` as never)} />
        </Card>
      )}

      {x.proposals.length > 0 && (<><Heading>Propuestas</Heading>{x.proposals.map((p) => <ProposalRow key={p.id} p={p} onPress={() => router.push(`/capture/proposal/${p.id}` as never)} />)}</>)}

      {x.status === "failed" && <Button title="Reintentar lectura" busy={retry.busy} onPress={async () => { if (await retry.submit()) await d.reload(); }} />}
      {["failed", "no_transaction"].includes(x.status) && <Button title="Descartar documento" variant="secondary" busy={discard.busy} onPress={async () => { if (await discard.submit()) router.replace("/capture" as never); }} />}
      {x.hasFile && <Button title="Eliminar el archivo original" variant="secondary" busy={delFile.busy} disabled={open > 0} onPress={async () => { if (await delFile.submit()) await d.reload(); }} />}
      {x.hasFile && open > 0 && <Txt size={12} muted>Resuelve las propuestas pendientes antes de eliminar el original. Eliminar el archivo no borra movimientos.</Txt>}
      {[retry.error, discard.error, delFile.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}

      {x.runs.length > 0 && (
        <>
          <Heading>Intentos de lectura</Heading>
          {x.runs.map((r, i) => <Card key={i} outlined><Txt size={13} bold>{r.status === "ok" ? "Lectura correcta" : "No se pudo leer"}</Txt><Txt size={12} muted>{r.status === "ok" ? "El comprobante se procesó correctamente." : "Puedes reintentar o registrar el movimiento a mano."}</Txt></Card>)}
        </>
      )}
    </Screen>
  );
}

// ───────────────────────── Aceptar varias ─────────────────────────

export function CaptureBatchScreen() {
  const props = useAsync(() => api.proposals("pending"), []);
  const accounts = useAsync(() => api.accounts(), []);
  const [sel, setSel] = useState<Record<string, boolean> | null>(null);
  const [stage, setStage] = useState<"select" | "confirm" | "done">("select");
  const [rows, setRows] = useState<Array<{ p: Proposal; token: string; effects: Array<{ accountId: string; before: string; after: string }> }>>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.acceptBatch>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const eligible = (props.data ?? []).filter((p) => p.canAccept);
  useEffect(() => { if (props.data && !sel) setSel(Object.fromEntries(eligible.map((p) => [p.id, p.duplicates.length === 0]))); }, [props.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = eligible.filter((p) => sel?.[p.id]);
  const accName = (aid: string) => accounts.data?.find((a) => a.id === aid)?.name ?? "Cuenta";

  const review = useSubmit(async () => {
    const out = await Promise.all(chosen.map(async (p) => { const v = await api.previewProposal(p.id); return { p, token: v.previewToken, effects: v.effects }; }));
    setRows(out); setStage("confirm");
  });
  const accept = useSubmit(async () => {
    const r = await api.acceptBatch(rows.map((x) => ({ id: x.p.id, previewToken: x.token, ...(x.p.duplicates.length ? { acknowledgeDuplicates: true } : {}) })));
    setResult(r); setStage("done");
  });

  if (props.loading && !props.data) return <Screen title="Aceptar varias"><Loading /></Screen>;
  if (props.error) return <Screen title="Aceptar varias"><ErrorBox message={props.error} onRetry={props.reload} /></Screen>;

  if (stage === "done" && result) {
    return (
      <Screen title="Resultado" footer={<Button title="Volver a la bandeja" onPress={() => router.replace("/capture" as never)} />}>
        <Notice tone={result.summary.failed ? "warn" : "ok"}>Aceptadas: {result.summary.accepted} · Fallidas: {result.summary.failed}</Notice>
        {result.failed.map((f) => <Card key={f.id} outlined><Txt bold>No se pudo aceptar</Txt><Txt size={12} muted>{f.message}</Txt></Card>)}
        <Txt size={12} muted>Cada propuesta se confirma por separado: una que falla no afecta a las demás.</Txt>
      </Screen>
    );
  }
  if (stage === "confirm") {
    return (
      <Screen title="Confirmar" subtitle="Revisa lo que se va a registrar"
        footer={<View style={{ gap: 8 }}><Button title={`Aceptar ${rows.length}`} busy={accept.busy} onPress={accept.submit} /><Button title="Volver" variant="secondary" onPress={() => setStage("select")} /></View>}>
        {rows.map((r) => (
          <Card key={r.p.id} outlined>
            <Txt bold>{r.p.counterparty ?? r.p.description ?? "Movimiento"} · {formatSoles(r.p.amount ?? "0")}</Txt>
            <Txt size={12} muted>{KIND[r.p.direction]} · {whenOf(r.p)}</Txt>
            {r.effects.map((e) => <KV key={e.accountId} label={accName(e.accountId)} value={`${formatSoles(e.before)} → ${formatSoles(e.after)}`} />)}
            {r.p.duplicates.length > 0 && <Notice tone="warn">Posible duplicado: se aceptará como otra operación.</Notice>}
          </Card>
        ))}
        {accept.error && <Notice tone="err">{accept.error}</Notice>}
      </Screen>
    );
  }
  return (
    <Screen title="Aceptar varias" subtitle="Solo las propuestas completas"
      footer={<Button title={`Revisar ${chosen.length}`} busy={review.busy} disabled={chosen.length === 0} onPress={review.submit} />}>
      {eligible.length === 0 ? <Empty icon="checkmark-done-outline" title="Nada que aceptar en lote" text="Las propuestas incompletas se completan una por una." /> : eligible.map((p) => (
        <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch value={!!sel?.[p.id]} onValueChange={(v) => setSel((s) => ({ ...(s ?? {}), [p.id]: v }))} />
          <View style={{ flex: 1 }}><ProposalRow p={p} onPress={() => router.push(`/capture/proposal/${p.id}` as never)} /></View>
        </View>
      ))}
      {review.error && <Notice tone="err">{review.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Reglas por remitente ─────────────────────────

export function SenderRulesScreen() {
  const rules = useAsync(() => api.senderRules(), []);
  const accounts = useAsync(() => api.accounts(), []);
  const cats = useAsync(() => api.categories("active"), []);
  const [sender, setSender] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const create = useSubmit(async () => api.createSenderRule({ sender: sender.trim(), accountId, categoryId }));
  const archive = useSubmit(async (_k: string, rid: string) => api.archiveSenderRule(rid));
  const catName = (cid: string | null) => (cid ? (cats.data ?? []).flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.id === cid)?.name ?? "" : "");
  return (
    <Screen title="Reglas por remitente" subtitle="Completan cuenta y categoría de lo que llega de un remitente">
      <Card>
        <Field label="Remitente (correo o parte del correo)" value={sender} onChangeText={setSender} placeholder="notificaciones@bcp.com.pe" keyboardType="email-address" />
        <OptionalAccountPicker label="Cuenta" value={accountId} onChange={setAccountId} />
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
        <Button title="Crear regla" busy={create.busy} disabled={!sender.trim() || (!accountId && !categoryId)} onPress={async () => { if (await create.submit()) { setSender(""); setAccountId(null); setCategoryId(null); void rules.reload(); } }} />
        {create.error && <Notice tone="err">{create.error}</Notice>}
      </Card>
      <Heading>Reglas</Heading>
      {rules.loading && !rules.data ? <Loading /> : (rules.data ?? []).length === 0 ? <Empty icon="funnel-outline" title="Sin reglas" text="Crea una para que lo que llegue de un banco ya venga con su cuenta." /> : (rules.data ?? []).map((r) => (
        <Card key={r.id} outlined>
          <Txt bold>{r.sender}</Txt>
          <Txt size={12} muted>{[r.accountId ? `Cuenta: ${accounts.data?.find((a) => a.id === r.accountId)?.name ?? ""}` : "", r.categoryId ? `Categoría: ${catName(r.categoryId)}` : ""].filter(Boolean).join(" · ")}</Txt>
          <Button title="Archivar" variant="secondary" busy={archive.busy} onPress={async () => { if (await archive.submit(r.id)) void rules.reload(); }} />
        </Card>
      ))}
      {archive.error && <Notice tone="err">{archive.error}</Notice>}
    </Screen>
  );
}
