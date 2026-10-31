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

// ───────────────────────── Conversación (análisis + chat en una sola pantalla) ─────────────────────────

interface Bubble { role: "user" | "assistant"; content: string }

/**
 * Una conversación con la IA. Sin `chatId` es una conversación nueva: se crea en el servidor al enviar el primer mensaje.
 * Con `chatId` carga una existente. La primera pregunta equivale a un análisis suelto; las siguientes recuerdan lo anterior.
 */
function ConversationView({ chatId }: { chatId?: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const existing = useAsync(async () => (chatId ? api.chat(chatId) : null), [chatId]);
  const [id, setId] = useState<string | undefined>(chatId);
  const [scope, setScope] = useState<AnalysisScope>(initialScope());
  const [saveHistory, setSaveHistory] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [local, setLocal] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [last, setLast] = useState<AnalysisResult | null>(null);
  const [ctx, setCtx] = useState<AnalysisContext | null>(null);
  const loaded = useRef(false);

  if (existing.data && !loaded.current) {
    loaded.current = true;
    const c = existing.data as ChatDetail;
    setScope(c.scope); setSaveHistory(c.saveHistory);
    setLocal(c.messages.map((m) => ({ role: m.role, content: m.content })));
  }
  const locked = !!id; // el alcance se fija al empezar la conversación
  const ok = scopeOk(scope);

  const peek = useSubmit(async () => { setCtx(await api.analysisContext(scope)); setSheet(false); });
  const send = useSubmit(async (_k: string, override?: string) => {
    const q = (override ?? text).trim();
    if (q.length < 3 || !ok) return;
    const before = local;
    setLocal((l) => [...l, { role: "user", content: q }]);
    setText(""); setCtx(null);
    try {
      let cid = id;
      if (!cid) { cid = (await api.createChat({ scope, saveHistory })).id; setId(cid); }
      const r = await api.sendChat(cid, { text: q, ...(saveHistory ? {} : { history: before.slice(-10) }) });
      setLocal((l) => [...l, { role: "assistant", content: r.answer }]);
      setLast(r);
    } catch (e) {
      setLocal(before); setText(q);
      await dialog.fail(e, "No se pudo preguntar");
    }
  });
  const remove = async () => {
    if (!id) return;
    if (!(await dialog.confirm({ title: "¿Borrar esta conversación?", message: "Se elimina con todos sus mensajes y no se puede deshacer.", confirmLabel: "Borrar", danger: true }))) return;
    try { await api.deleteChat(id); router.replace("/analysis" as never); } catch (e) { await dialog.fail(e, "No se pudo borrar"); }
  };
  const fresh = () => { if (chatId) router.replace("/analysis" as never); else { setId(undefined); setLocal([]); setLast(null); setCtx(null); setText(""); } };

  if (chatId && existing.loading && !existing.data) return <Screen title="Análisis con IA"><Loading /></Screen>;
  if (chatId && (existing.error || !existing.data)) return <Screen title="Análisis con IA"><ErrorBox message={existing.error ?? "No se encontró la conversación."} onRetry={existing.reload} /></Screen>;

  const canSend = text.trim().length >= 3 && ok && !send.busy;
  const IconBtn = ({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: danger ? `${colors.expense}1A` : colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={18} color={danger ? colors.expenseStrong : colors.text} />
    </TouchableOpacity>
  );

  return (
    <Screen title="Análisis con IA" subtitle="Pregunta sobre tu dinero; responde con tus datos"
      right={<View style={{ flexDirection: "row", gap: 6 }}>
        {local.length > 0 && <IconBtn icon="add" label="Nueva conversación" onPress={fresh} />}
        <IconBtn icon="time-outline" label="Conversaciones anteriores" onPress={() => router.push("/analysis/chats" as never)} />
        {chatId && <IconBtn icon="trash-outline" label="Borrar conversación" onPress={remove} danger />}
      </View>}
      footer={(
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, paddingHorizontal: 12, justifyContent: "center" }}>
            <TextInput value={text} onChangeText={setText} multiline placeholder={local.length ? "Pregunta algo más…" : "Escribe tu pregunta…"} placeholderTextColor={colors.muted} maxLength={500} style={{ color: colors.text, fontFamily: "AsapMedium", fontSize: 15, maxHeight: 96, paddingVertical: 10 }} />
          </View>
          <TouchableOpacity onPress={() => void send.submit()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Preguntar" style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: canSend ? colors.primarySurface : `${colors.text}12` }}>
            <Ionicons name={send.busy ? "hourglass-outline" : "arrow-up"} size={22} color={canSend ? colors.onPrimary : colors.muted} />
          </TouchableOpacity>
        </View>
      )}>
      {/* Qué se analiza */}
      <TouchableOpacity onPress={() => (locked ? undefined : setSheet(true))} disabled={locked} accessibilityRole="button" accessibilityLabel="Qué se analiza" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name={locked ? "lock-closed-outline" : "options-outline"} size={16} color={colors.primary} />
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{scopeSummary(scope)}</Text>
        {!locked && <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>Cambiar</Text>}
      </TouchableOpacity>

      {local.length === 0 && (
        <View style={{ gap: 12, paddingTop: 6 }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            <GeminiMark size={38} id="hello" />
            <Text style={{ color: colors.text, fontSize: 17, fontFamily: "AsapBold" }}>¿Qué quieres saber?</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>Responde solo con tus datos y no puede cambiar nada. Puedes seguir preguntando sobre la respuesta.</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {SUGGESTIONS.map((q) => (
              <TouchableOpacity key={q} onPress={() => void send.submit(q)} accessibilityRole="button" style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 99, justifyContent: "center", backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "AsapMedium" }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {ctx && <ContextView c={ctx} />}

      {local.map((m, i) => m.role === "user" ? (
        <View key={i} style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: colors.primarySurface, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14 }}>
          <Text style={{ color: colors.onPrimary, fontSize: 14, fontFamily: "AsapMedium" }}>{m.content}</Text>
        </View>
      ) : (
        <AIFrame key={i} radius={20}>
          <View style={{ padding: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <GeminiMark size={16} id={`a${i}`} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapBold" }}>Respuesta</Text>
            </View>
            <RichText text={m.content} size={15} />
          </View>
        </AIFrame>
      ))}
      {send.busy && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 }}>
          <GeminiMark size={16} id="typing" /><Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap" }}>Analizando tus movimientos…</Text>
        </View>
      )}
      {last && local.length > 0 && !send.busy && (
        <View style={{ gap: 4 }}>
          <Coverage r={last} />
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap", textAlign: "center" }}>Orientativo, generado con IA a partir de tus registros. No es asesoría financiera.</Text>
        </View>
      )}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="¿Qué analizar?" maxHeight={0.85}>
        <View style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", marginBottom: 12, marginLeft: 4 }}>La IA solo verá lo que elijas aquí. Si no filtras nada, analiza todo el periodo.</Text>
          <ScopeForm value={scope} onChange={(s2) => { setScope(s2); setCtx(null); }} />
          <SwitchRow label="Guardar esta conversación" hint={saveHistory ? "Queda en tu cuenta hasta que la borres" : "Si no la guardas, se pierde al cerrarla"} value={saveHistory} onValueChange={setSaveHistory} />
          <Button title="Ver qué datos usaría la IA" variant="secondary" busy={peek.busy} disabled={!ok} onPress={peek.submit} />
          <View style={{ height: 8 }} />
          <Button title="Listo" onPress={() => setSheet(false)} disabled={!ok} />
          <View style={{ height: 6 }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

export function AnalysisScreen() { return <ConversationView />; }
export function ChatScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <ConversationView chatId={id} />; }

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

// ───────────────────────── Conversaciones anteriores ─────────────────────────

export function ChatsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const chats = useAsync(() => api.chats(), []);
  const saved = useAsync(() => api.analyses(), []);
  useFocusReload(() => { void chats.reload(); void saved.reload(); });
  const empty = !chats.loading && (chats.data ?? []).length === 0 && !saved.loading && (saved.data ?? []).length === 0;
  return (
    <Screen title="Conversaciones" subtitle="Las que guardaste con la IA" footer={<Button title="Nueva conversación" icon="add" onPress={() => router.replace("/analysis" as never)} />}>
      {(chats.loading && !chats.data) || (saved.loading && !saved.data) ? <Loading /> : chats.error || saved.error ? <ErrorBox message={(chats.error ?? saved.error)!} onRetry={() => { void chats.reload(); void saved.reload(); }} /> : empty ? (
        <Empty icon="chatbubbles-outline" title="Aún no hay conversaciones guardadas" text="Al empezar una puedes elegir «Guardar esta conversación» para volver a leerla." />
      ) : (
        <>
          {(chats.data ?? []).map((c) => (
            <RowLink key={c.id} onPress={() => router.push(`/analysis/chat/${c.id}` as never)}>
              <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}><GeminiMark size={16} id={c.id.slice(0, 6)} /></View>
              <View style={{ flex: 1 }}><Txt bold numberOfLines={1}>{c.title || "Conversación"}</Txt><Txt size={12} muted numberOfLines={1}>{scopeSummary(c.scope)}</Txt></View>
            </RowLink>
          ))}
          {(saved.data ?? []).length > 0 && <Heading>Respuestas guardadas</Heading>}
          {(saved.data ?? []).map((a) => (
            <RowLink key={a.id} onPress={() => router.push(`/analysis/saved/${a.id}` as never)}>
              <View style={{ flex: 1 }}><Txt bold numberOfLines={2}>{a.question}</Txt><Txt size={12} muted>{scopeSummary(a.scope)}</Txt></View>
            </RowLink>
          ))}
        </>
      )}
    </Screen>
  );
}
