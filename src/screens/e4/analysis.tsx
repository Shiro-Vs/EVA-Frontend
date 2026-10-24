import React, { useRef, useState } from "react";
import { Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { AnalysisContext, AnalysisResult, AnalysisScope, ChatDetail } from "../../api/types";
import { Button, Card, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";
import { initialScope, ScopeForm } from "./shared";

const scopeOk = (s: AnalysisScope) => isIsoDate(s.from) && isIsoDate(s.to) && s.from <= s.to;
const scopeText = (s: AnalysisScope) => `${humanDate(s.from)} – ${humanDate(s.to)}`;

function Coverage({ r }: { r: { coverage: AnalysisResult["coverage"] } }) {
  const f = r.coverage.filters;
  return (
    <Card outlined>
      <KV label="Periodo" value={`${humanDate(r.coverage.period.from)} – ${humanDate(r.coverage.period.to)} (${r.coverage.period.days} días)`} />
      {f.accounts.length > 0 && <KV label="Cuentas" value={f.accounts.join(", ")} />}
      {f.categories.length > 0 && <KV label="Categorías" value={f.categories.join(", ")} />}
      {f.services.length > 0 && <KV label="Servicios" value={f.services.join(", ")} />}
      <KV label="Movimientos analizados" value={String(r.coverage.movements)} />
      {r.coverage.notes.map((n, i) => <Txt key={i} size={12} muted>• {n}</Txt>)}
    </Card>
  );
}

function ResultView({ r }: { r: AnalysisResult }) {
  return (
    <>
      <Card>
        <Txt>{r.answer}</Txt>
        <Txt size={11} muted>Generado el {humanDate(r.generatedAt.slice(0, 10))} · {r.provider} {r.model}</Txt>
      </Card>
      <Coverage r={r} />
      <Notice tone="info">{r.disclaimer}</Notice>
    </>
  );
}

function ContextView({ c }: { c: AnalysisContext }) {
  const x = c.context;
  return (
    <>
      <Card outlined>
        <Txt bold>Esto es lo que vería la IA (agregados; nunca tus documentos)</Txt>
        <KV label="Ingresos" value={formatSoles(x.totals.income)} />
        <KV label="Gastos" value={formatSoles(x.totals.expense)} />
        <KV label="Neto" value={formatSoles(x.totals.net)} strong />
        {(x.byCategory as Array<{ name: string; total: string; percentOfExpense: number }>).slice(0, 8).map((k) => <KV key={k.name} label={k.name} value={`${formatSoles(k.total)} · ${k.percentOfExpense} %`} />)}
      </Card>
      <Coverage r={c} />
    </>
  );
}

// ───────────────────────── Preguntar ─────────────────────────

export function AnalysisScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<AnalysisScope>(initialScope());
  const [question, setQuestion] = useState("");
  const [save, setSave] = useState(false);
  const [ctx, setCtx] = useState<AnalysisContext | null>(null);
  const [res, setRes] = useState<AnalysisResult | null>(null);
  const saved = useAsync(() => api.analyses(), []);
  useFocusReload(saved.reload);

  const peek = useSubmit(async () => { setCtx(await api.analysisContext(scope)); });
  const ask = useSubmit(async () => { const r = await api.analyze({ scope, question: question.trim(), save }); setRes(r); if (r.saved) void saved.reload(); return r; });
  const change = (s: AnalysisScope) => { setScope(s); setCtx(null); setRes(null); };
  const ok = scopeOk(scope);

  return (
    <Screen title="Análisis con IA" subtitle="Elige qué se analiza; la IA solo explica tus datos">
      <Card>
        <ScopeForm value={scope} onChange={change} />
        <Field label="¿Qué quieres saber?" value={question} onChangeText={(v) => { setQuestion(v); setRes(null); }} multiline numberOfLines={3} autoCapitalize="sentences" placeholder="¿En qué gasto más y cómo cambió respecto al mes pasado?" maxLength={500} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch value={save} onValueChange={setSave} />
          <Txt size={13} style={{ flex: 1 }}>Guardar este análisis</Txt>
        </View>
        <Button title="Preguntar" icon="sparkles-outline" busy={ask.busy} disabled={!ok || question.trim().length < 3} onPress={ask.submit} />
        <Button title="Ver qué datos se enviarían" variant="secondary" busy={peek.busy} disabled={!ok} onPress={peek.submit} />
        {[ask.error, peek.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}
      </Card>

      {ctx && <ContextView c={ctx} />}
      {res && <ResultView r={res} />}

      <Button title="Chat con IA" variant="secondary" icon="chatbubbles-outline" onPress={() => router.push("/analysis/chats" as never)} />

      <Heading>Análisis guardados</Heading>
      {saved.loading && !saved.data ? <Loading /> : saved.error ? <ErrorBox message={saved.error} onRetry={saved.reload} /> : (saved.data ?? []).length === 0 ? (
        <Empty icon="document-text-outline" title="Sin análisis guardados" text="Activa «Guardar este análisis» para conservar uno." />
      ) : (saved.data ?? []).map((a) => (
        <RowLink key={a.id} onPress={() => router.push(`/analysis/saved/${a.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>{a.question}</Txt><Txt size={12} muted>{scopeText(a.scope)}</Txt></View>
        </RowLink>
      ))}
    </Screen>
  );
}

export function SavedAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const a = useAsync(() => api.analysis(id), [id]);
  const del = useSubmit(async () => api.deleteAnalysis(id));
  const [confirm, setConfirm] = useState(false);
  if (a.loading && !a.data) return <Screen title="Análisis"><Loading /></Screen>;
  if (a.error || !a.data) return <Screen title="Análisis"><ErrorBox message={a.error ?? "No se encontró."} onRetry={a.reload} /></Screen>;
  return (
    <Screen title="Análisis guardado" subtitle={a.data.question}>
      <ResultView r={a.data} />
      {confirm ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Sí, eliminar" variant="danger" busy={del.busy} onPress={async () => { if (await del.submit()) router.replace("/analysis" as never); }} /></View>
          <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setConfirm(false)} /></View>
        </View>
      ) : <Button title="Eliminar" variant="secondary" onPress={() => setConfirm(true)} />}
      {del.error && <Notice tone="err">{del.error}</Notice>}
    </Screen>
  );
}

// ───────────────────────── Chat ─────────────────────────

export function ChatsScreen() {
  const router = useRouter();
  const chats = useAsync(() => api.chats(), []);
  useFocusReload(chats.reload);
  const [scope, setScope] = useState<AnalysisScope>(initialScope());
  const [saveHistory, setSaveHistory] = useState(false);
  const create = useSubmit(async () => api.createChat({ scope, saveHistory }));
  return (
    <Screen title="Chat con IA" subtitle="Conversa sobre el alcance que elijas">
      <Card>
        <ScopeForm value={scope} onChange={setScope} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch value={saveHistory} onValueChange={setSaveHistory} />
          <Txt size={13} style={{ flex: 1 }}>Guardar el historial de la conversación</Txt>
        </View>
        <Txt size={12} muted>{saveHistory ? "Los mensajes se guardan en tu cuenta hasta que borres el chat." : "No se guarda nada de la conversación: al cerrar el chat se pierde."}</Txt>
        <Button title="Empezar chat" disabled={!scopeOk(scope)} busy={create.busy} onPress={async () => { const c = await create.submit(); if (c) router.push(`/analysis/chat/${c.id}` as never); }} />
        {create.error && <Notice tone="err">{create.error}</Notice>}
      </Card>
      <Heading>Tus chats</Heading>
      {chats.loading && !chats.data ? <Loading /> : (chats.data ?? []).length === 0 ? <Empty icon="chatbubbles-outline" title="Sin chats" text="Los chats sin historial guardado se pierden al cerrarlos." /> : (chats.data ?? []).map((c) => (
        <RowLink key={c.id} onPress={() => router.push(`/analysis/chat/${c.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold>{c.title || "Chat nuevo"}</Txt><Txt size={12} muted>{scopeText(c.scope)} · {c.saveHistory ? "con historial" : "sin historial"}</Txt></View>
        </RowLink>
      ))}
    </Screen>
  );
}

interface Bubble { role: "user" | "assistant"; content: string }

export function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useAsync(() => api.chat(id), [id]);
  const [local, setLocal] = useState<Bubble[] | null>(null);
  const [text, setText] = useState("");
  const [last, setLast] = useState<AnalysisResult | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useSubmit(async () => api.deleteChat(id));
  const inited = useRef(false);
  if (chat.data && !inited.current) { inited.current = true; setLocal((chat.data as ChatDetail).messages.map((m) => ({ role: m.role, content: m.content }))); }

  const send = useSubmit(async () => {
    const c = chat.data!;
    const q = text.trim();
    const history = c.saveHistory ? undefined : (local ?? []).slice(-10);
    setLocal((l) => [...(l ?? []), { role: "user", content: q }]);
    setText("");
    try {
      const r = await api.sendChat(id, { text: q, ...(history ? { history } : {}) });
      setLocal((l) => [...(l ?? []), { role: "assistant", content: r.answer }]);
      setLast(r);
    } catch (e) {
      setLocal((l) => (l ?? []).slice(0, -1)); setText(q);
      throw e;
    }
  });

  if (chat.loading && !chat.data) return <Screen title="Chat"><Loading /></Screen>;
  if (chat.error || !chat.data) return <Screen title="Chat"><ErrorBox message={chat.error ?? "No se encontró el chat."} onRetry={chat.reload} /></Screen>;
  const c = chat.data;
  return (
    <Screen title={c.title || "Chat con IA"} subtitle={`${scopeText(c.scope)} · ${c.saveHistory ? "historial guardado" : "sin historial"}`}
      footer={(
        <View style={{ gap: 8 }}>
          {send.error && <Notice tone="err">{send.error}</Notice>}
          <Field label="Tu mensaje" value={text} onChangeText={setText} autoCapitalize="sentences" placeholder="Pregunta sobre tus gastos…" maxLength={500} />
          <Button title="Enviar" icon="send-outline" busy={send.busy} disabled={text.trim().length < 3} onPress={send.submit} />
        </View>
      )}>
      {(local ?? []).length === 0 && <Empty icon="chatbubble-ellipses-outline" title="Pregunta lo que quieras" text="La IA responde solo con los datos del alcance elegido y no puede modificar nada." />}
      {(local ?? []).map((m, i) => (
        <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
          <Card outlined={m.role === "assistant"}><Txt size={14}>{m.content}</Txt></Card>
        </View>
      ))}
      {send.busy && <Txt size={12} muted>La IA está respondiendo…</Txt>}
      {last && <Coverage r={last} />}
      {last && <Txt size={11} muted>{last.disclaimer}</Txt>}
      {confirmDel ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Sí, borrar el chat" variant="danger" busy={del.busy} onPress={async () => { if (await del.submit()) router.replace("/analysis/chats" as never); }} /></View>
          <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setConfirmDel(false)} /></View>
        </View>
      ) : <Button title="Borrar este chat" variant="secondary" onPress={() => setConfirmDel(true)} />}
      {del.error && <Notice tone="err">{del.error}</Notice>}
    </Screen>
  );
}
