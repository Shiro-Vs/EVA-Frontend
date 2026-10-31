import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import type { AnalysisContext, AnalysisResult, AnalysisScope, ChatDetail } from "../../api/types";
import AIFrame from "../../components/common/AIFrame";
import BottomSheet from "../../components/common/BottomSheet";
import GeminiMark from "../../components/common/GeminiMark";
import RichText from "../../components/common/RichText";
import { Button, Card, Empty, ErrorBox, Field, Heading, KV, Loading, Notice, RowLink, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";
import { initialScope, presetRange, ScopeForm } from "./shared";

const scopeOk = (s: AnalysisScope) => isIsoDate(s.from) && isIsoDate(s.to) && s.from <= s.to;
const scopeText = (s: AnalysisScope) => `${humanDate(s.from)} – ${humanDate(s.to)}`;

/** «Este mes · todas las cuentas»: el alcance dicho en una línea. */
export function scopeSummary(s: AnalysisScope): string {
  const same = (p: ReturnType<typeof presetRange>) => p.from === s.from && p.to === s.to;
  const period = same(presetRange("month")) ? "Este mes" : same(presetRange("prev")) ? "Mes pasado" : same(presetRange("30")) ? "Últimos 30 días" : scopeText(s);
  const bits = [period, s.accountIds?.length ? `${s.accountIds.length} ${s.accountIds.length === 1 ? "cuenta" : "cuentas"}` : "todas las cuentas"];
  if (s.categoryIds?.length) bits.push(`${s.categoryIds.length} ${s.categoryIds.length === 1 ? "categoría" : "categorías"}`);
  if (s.subscriptionIds?.length) bits.push(`${s.subscriptionIds.length} ${s.subscriptionIds.length === 1 ? "servicio" : "servicios"}`);
  return bits.join(" · ");
}

/** Preguntas que ya suelen servir: se tocan y listo, sin escribir. */
export const SUGGESTIONS = [
  "¿En qué gasto más?",
  "¿Cómo voy frente al mes pasado?",
  "¿Qué gastos pequeños puedo reducir?",
  "¿Cuánto me deben y quién?",
  "¿Qué suscripciones me cuestan más?",
  "¿Cuánto ahorré este periodo?",
];

/** «Qué datos usó»: plegado por defecto, para que la respuesta sea lo primero que se lee. */
function Coverage({ r }: { r: { coverage: AnalysisResult["coverage"] } }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const f = r.coverage.filters;
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
        <Ionicons name="reader-outline" size={16} color={colors.textSecondary} />
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>Qué datos usó · {r.coverage.movements} movimientos</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={{ gap: 2, paddingBottom: 6 }}>
          <KV label="Periodo" value={`${humanDate(r.coverage.period.from)} – ${humanDate(r.coverage.period.to)} (${r.coverage.period.days} días)`} />
          {f.accounts.length > 0 && <KV label="Cuentas" value={f.accounts.join(", ")} />}
          {f.categories.length > 0 && <KV label="Categorías" value={f.categories.join(", ")} />}
          {f.services.length > 0 && <KV label="Servicios" value={f.services.join(", ")} />}
          {r.coverage.notes.map((n, i) => <Txt key={i} size={12} muted>• {n}</Txt>)}
        </View>
      )}
    </View>
  );
}

/** Respuesta de la IA: en un marco propio, con el texto grande y claro; lo técnico queda abajo y plegado. */
function ResultView({ r, question }: { r: AnalysisResult; question?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      {question ? (
        <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: colors.primarySurface, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14 }}>
          <Text style={{ color: colors.onPrimary, fontSize: 14, fontFamily: "AsapMedium" }}>{question}</Text>
        </View>
      ) : null}
      <AIFrame>
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GeminiMark size={20} id="ans" />
            <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>Respuesta</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{humanDate(r.generatedAt.slice(0, 10))}</Text>
          </View>
          <RichText text={r.answer} size={15} />
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 }}>
            <Coverage r={r} />
          </View>
        </View>
      </AIFrame>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", textAlign: "center" }}>Orientativo, generado con IA a partir de tus registros. No es asesoría financiera.</Text>
    </View>
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
  const { colors } = useAppTheme();
  const [scope, setScope] = useState<AnalysisScope>(initialScope());
  const [sheet, setSheet] = useState(false);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [save, setSave] = useState(false);
  const [ctx, setCtx] = useState<AnalysisContext | null>(null);
  const [res, setRes] = useState<AnalysisResult | null>(null);
  const saved = useAsync(() => api.analyses(), []);
  useFocusReload(saved.reload);
  const dialog = useDialog();

  const peek = useSubmit(async () => { setCtx(await api.analysisContext(scope)); setSheet(false); });
  const ask = useSubmit(async (_k: string, q: string) => {
    setAsked(q); setRes(null);
    try { const r = await api.analyze({ scope, question: q, save }); setRes(r); if (r.saved) void saved.reload(); return r; }
    catch (e) { await dialog.fail(e, "No se pudo analizar"); return undefined; }
  });
  const ok = scopeOk(scope);
  const change = (s: AnalysisScope) => { setScope(s); setCtx(null); setRes(null); };
  const run = (q: string) => { if (!ok || q.trim().length < 3 || ask.busy) return; setQuestion(q); void ask.submit(q.trim()); };

  return (
    <Screen title="Análisis con IA" subtitle="Pregunta sobre tu dinero; responde con tus datos">
      <AIFrame>
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GeminiMark size={22} id="hero" />
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>¿Qué quieres saber?</Text>
          </View>
          <TouchableOpacity onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Cambiar qué se analiza" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: `${colors.text}0D` }}>
            <Ionicons name="options-outline" size={16} color={colors.primary} />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{scopeSummary(scope)}</Text>
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Cambiar</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, paddingHorizontal: 12, justifyContent: "center" }}>
              <TextInput value={question} onChangeText={(v) => { setQuestion(v); setRes(null); }} multiline placeholder="Escribe tu pregunta…" placeholderTextColor={colors.muted} maxLength={500}
                style={{ color: colors.text, fontFamily: "AsapMedium", fontSize: 15, maxHeight: 96, paddingVertical: 10 }} />
            </View>
            <TouchableOpacity onPress={() => run(question)} disabled={!ok || question.trim().length < 3 || ask.busy} accessibilityRole="button" accessibilityLabel="Preguntar"
              style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: !ok || question.trim().length < 3 ? `${colors.text}12` : colors.primarySurface }}>
              <Ionicons name={ask.busy ? "hourglass-outline" : "arrow-up"} size={22} color={!ok || question.trim().length < 3 ? colors.muted : colors.onPrimary} />
            </TouchableOpacity>
          </View>
          {!res && !ask.busy && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {SUGGESTIONS.map((q) => (
                <TouchableOpacity key={q} onPress={() => run(q)} accessibilityRole="button" style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 99, justifyContent: "center", backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapMedium" }}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <SwitchRow label="Guardar esta respuesta" hint="Podrás volver a leerla en «Guardados»" value={save} onValueChange={setSave} />
        </View>
      </AIFrame>

      {ask.busy && (
        <AIFrame>
          <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <GeminiMark size={20} id="wait" />
            <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Analizando tus movimientos…</Text>
          </View>
        </AIFrame>
      )}
      {res && <ResultView r={res} question={asked} />}
      {ctx && <ContextView c={ctx} />}

      <TouchableOpacity onPress={() => router.push("/analysis/chats" as never)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.sections.plan.tint }}><Ionicons name="chatbubbles-outline" size={19} color={colors.sections.plan.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>Conversar con la IA</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>Haz varias preguntas seguidas sobre el mismo periodo</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>

      <Heading>Guardados</Heading>
      {saved.loading && !saved.data ? <Loading /> : saved.error ? <ErrorBox message={saved.error} onRetry={saved.reload} /> : (saved.data ?? []).length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Aquí aparecerán las respuestas que guardes.</Text>
      ) : (saved.data ?? []).map((a) => (
        <RowLink key={a.id} onPress={() => router.push(`/analysis/saved/${a.id}` as never)}>
          <View style={{ flex: 1 }}><Txt bold numberOfLines={2}>{a.question}</Txt><Txt size={12} muted>{scopeSummary(a.scope)}</Txt></View>
        </RowLink>
      ))}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="¿Qué analizar?" maxHeight={0.85}>
        <View style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", marginBottom: 12, marginLeft: 4 }}>La IA solo verá lo que elijas aquí. Si no filtras nada, analiza todo el periodo.</Text>
          <ScopeForm value={scope} onChange={change} />
          <Button title="Ver qué datos usaría la IA" variant="secondary" busy={peek.busy} disabled={!ok} onPress={peek.submit} />
          <View style={{ height: 8 }} />
          <Button title="Listo" onPress={() => setSheet(false)} disabled={!ok} />
          <View style={{ height: 6 }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

export function SavedAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const a = useAsync(() => api.analysis(id), [id]);
  const remove = async () => {
    if (!(await dialog.confirm({ title: "¿Eliminar este análisis?", message: "Se borra la respuesta guardada y no se puede deshacer.", confirmLabel: "Eliminar", danger: true }))) return;
    try { await api.deleteAnalysis(id); router.replace("/analysis" as never); } catch (e) { await dialog.fail(e, "No se pudo eliminar"); }
  };
  if (a.loading && !a.data) return <Screen title="Análisis"><Loading /></Screen>;
  if (a.error || !a.data) return <Screen title="Análisis"><ErrorBox message={a.error ?? "No se encontró."} onRetry={a.reload} /></Screen>;
  return (
    <Screen title="Análisis guardado" subtitle={scopeSummary(a.data.scope)}>
      <ResultView r={a.data} question={a.data.question} />
      <Button title="Eliminar" variant="secondary" icon="trash-outline" onPress={remove} />
    </Screen>
  );
}

// ───────────────────────── Chat ─────────────────────────

export function ChatsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const chats = useAsync(() => api.chats(), []);
  useFocusReload(chats.reload);
  const [scope, setScope] = useState<AnalysisScope>(initialScope());
  const [sheet, setSheet] = useState(false);
  const [saveHistory, setSaveHistory] = useState(false);
  const dialog = useDialog();
  const start = async () => {
    try { const c = await api.createChat({ scope, saveHistory }); router.push(`/analysis/chat/${c.id}` as never); }
    catch (e) { await dialog.fail(e, "No se pudo empezar el chat"); }
  };
  return (
    <Screen title="Conversar con la IA" subtitle="Varias preguntas seguidas sobre el mismo periodo">
      <AIFrame>
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GeminiMark size={22} id="chats" />
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>Nueva conversación</Text>
          </View>
          <TouchableOpacity onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Cambiar qué se analiza" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: `${colors.text}0D` }}>
            <Ionicons name="options-outline" size={16} color={colors.primary} />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{scopeSummary(scope)}</Text>
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Cambiar</Text>
          </TouchableOpacity>
          <SwitchRow label="Guardar la conversación" hint={saveHistory ? "Los mensajes quedan en tu cuenta hasta que borres el chat" : "Si no la guardas, se pierde al cerrar el chat"} value={saveHistory} onValueChange={setSaveHistory} />
          <Button title="Empezar" icon="chatbubble-ellipses-outline" disabled={!scopeOk(scope)} onPress={start} />
        </View>
      </AIFrame>

      <Heading>Tus conversaciones</Heading>
      {chats.loading && !chats.data ? <Loading /> : (chats.data ?? []).length === 0 ? <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Aún no hay conversaciones guardadas.</Text> : (chats.data ?? []).map((c) => (
        <RowLink key={c.id} onPress={() => router.push(`/analysis/chat/${c.id}` as never)}>
          <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}><GeminiMark size={16} id={c.id.slice(0, 6)} /></View>
          <View style={{ flex: 1 }}><Txt bold numberOfLines={1}>{c.title || "Conversación"}</Txt><Txt size={12} muted numberOfLines={1}>{scopeSummary(c.scope)} · {c.saveHistory ? "guardada" : "sin guardar"}</Txt></View>
        </RowLink>
      ))}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="¿Qué analizar?" maxHeight={0.85}>
        <View style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", marginBottom: 12, marginLeft: 4 }}>La IA solo verá lo que elijas aquí. Si no filtras nada, analiza todo el periodo.</Text>
          <ScopeForm value={scope} onChange={setScope} />
          <Button title="Listo" onPress={() => setSheet(false)} disabled={!scopeOk(scope)} />
          <View style={{ height: 6 }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

interface Bubble { role: "user" | "assistant"; content: string }

export function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const chat = useAsync(() => api.chat(id), [id]);
  const [local, setLocal] = useState<Bubble[] | null>(null);
  const [text, setText] = useState("");
  const [last, setLast] = useState<AnalysisResult | null>(null);
  const inited = useRef(false);
  if (chat.data && !inited.current) { inited.current = true; setLocal((chat.data as ChatDetail).messages.map((m) => ({ role: m.role, content: m.content }))); }

  const send = useSubmit(async (_k: string, override?: string) => {
    const c = chat.data!;
    const q = (override ?? text).trim();
    if (q.length < 3) return;
    const history = c.saveHistory ? undefined : (local ?? []).slice(-10);
    setLocal((l) => [...(l ?? []), { role: "user", content: q }]);
    setText("");
    try {
      const r = await api.sendChat(id, { text: q, ...(history ? { history } : {}) });
      setLocal((l) => [...(l ?? []), { role: "assistant", content: r.answer }]);
      setLast(r);
    } catch (e) {
      setLocal((l) => (l ?? []).slice(0, -1)); setText(q);
      await dialog.fail(e, "No se pudo enviar el mensaje");
    }
  });
  const remove = async () => {
    if (!(await dialog.confirm({ title: "¿Borrar esta conversación?", message: "Se elimina con todos sus mensajes y no se puede deshacer.", confirmLabel: "Borrar", danger: true }))) return;
    try { await api.deleteChat(id); router.replace("/analysis/chats" as never); } catch (e) { await dialog.fail(e, "No se pudo borrar"); }
  };

  if (chat.loading && !chat.data) return <Screen title="Chat"><Loading /></Screen>;
  if (chat.error || !chat.data) return <Screen title="Chat"><ErrorBox message={chat.error ?? "No se encontró el chat."} onRetry={chat.reload} /></Screen>;
  const c = chat.data;
  const messages = local ?? [];
  const canSend = text.trim().length >= 3 && !send.busy;
  return (
    <Screen title={c.title || "Conversación"} subtitle={`${scopeSummary(c.scope)} · ${c.saveHistory ? "guardada" : "sin guardar"}`}
      right={<TouchableOpacity onPress={remove} accessibilityRole="button" accessibilityLabel="Borrar conversación" style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.expense}1A` }}><Ionicons name="trash-outline" size={18} color={colors.expenseStrong} /></TouchableOpacity>}
      footer={(
        <View style={{ gap: 8 }}>
          {messages.length === 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {SUGGESTIONS.map((q) => (
                <TouchableOpacity key={q} onPress={() => void send.submit(q)} accessibilityRole="button" style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 99, justifyContent: "center", backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapMedium" }}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, paddingHorizontal: 12, justifyContent: "center" }}>
              <TextInput value={text} onChangeText={setText} multiline placeholder="Pregunta sobre tus gastos…" placeholderTextColor={colors.muted} maxLength={500} style={{ color: colors.text, fontFamily: "AsapMedium", fontSize: 15, maxHeight: 96, paddingVertical: 10 }} />
            </View>
            <TouchableOpacity onPress={() => void send.submit()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Enviar" style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: canSend ? colors.primarySurface : `${colors.text}12` }}>
              <Ionicons name="arrow-up" size={22} color={canSend ? colors.onPrimary : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      )}>
      {messages.length === 0 && (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
          <GeminiMark size={40} id="empty" />
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Pregunta lo que quieras</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>Responde solo con los datos del periodo elegido y no puede modificar nada.</Text>
        </View>
      )}
      {messages.map((m, i) => m.role === "user" ? (
        <View key={i} style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: colors.primarySurface, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14 }}>
          <Text style={{ color: colors.onPrimary, fontSize: 14, fontFamily: "AsapMedium" }}>{m.content}</Text>
        </View>
      ) : (
        <View key={i} style={{ alignSelf: "flex-start", maxWidth: "94%", flexDirection: "row", gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 2 }}><GeminiMark size={14} id={`m${i}`} /></View>
          <View style={{ flexShrink: 1, backgroundColor: colors.card, borderRadius: 18, borderTopLeftRadius: 6, borderWidth: 1, borderColor: colors.border, padding: 12 }}><RichText text={m.content} size={14} /></View>
        </View>
      ))}
      {send.busy && (
        <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 34 }}>
          <GeminiMark size={14} id="typing" /><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>Analizando…</Text>
        </View>
      )}
      {last && <Coverage r={last} />}
      {last && <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", textAlign: "center" }}>{last.disclaimer}</Text>}
    </Screen>
  );
}
