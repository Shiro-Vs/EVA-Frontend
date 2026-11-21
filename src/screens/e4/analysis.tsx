import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import { ApiError } from "../../api/http";
import type { AnalysisContext, AnalysisResult, AnalysisScope, ChatDetail } from "../../api/types";
import AIFrame from "../../components/common/AIFrame";
import GeminiMark from "../../components/common/GeminiMark";
import RichText from "../../components/common/RichText";
import { Button, Card, Empty, ErrorBox, Heading, KV, Loading, Notice, RowLink, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, isIsoDate, todayLocalIso } from "../../utils/dates";
import { formatSoles } from "../../utils/money";
import { initialScope, presetRange, ScopeForm } from "./shared";

const scopeOk = (s: AnalysisScope) => isIsoDate(s.from) && isIsoDate(s.to) && s.from <= s.to;
const scopeText = (s: AnalysisScope) => `${humanDate(s.from)} – ${humanDate(s.to)}`;

function prevIsoDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! - 1));
  return dt.toISOString().slice(0, 10);
}

/** Si el reloj/zona horaria del teléfono va adelantado respecto al servidor (America/Lima), recorta `to` un día. */
function clampForTimezone(s: AnalysisScope): AnalysisScope | null {
  if (s.to !== todayLocalIso()) return null;
  const prev = prevIsoDay(s.to);
  return { ...s, from: s.from > prev ? prev : s.from, to: prev };
}

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
  "¿En qué cuenta gasto más?",
  "¿Qué gastos no tienen categoría?",
  "¿Cuánto ahorré este periodo?",
];

/** «Qué datos usó»: plegado por defecto, para que la respuesta sea lo primero que se lee. */
function Coverage({ r }: { r: { coverage: AnalysisResult["coverage"] } }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const f = r.coverage.filters;
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
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
  const [editingScope, setEditingScope] = useState(false);
  const [local, setLocal] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [last, setLast] = useState<AnalysisResult | null>(null);
  const [ctx, setCtx] = useState<AnalysisContext | null>(null);
  const loadedChatId = useRef<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!chatId) {
      loadedChatId.current = undefined;
      setId(undefined);
      return;
    }
    if (existing.data && loadedChatId.current !== chatId) {
      loadedChatId.current = chatId;
      const c = existing.data as ChatDetail;
      setId(c.id);
      setScope(c.scope);
      setSaveHistory(c.saveHistory);
      setLocal(c.messages.map((m) => ({ role: m.role, content: m.content })));
      setEditingScope(false);
    }
  }, [chatId, existing.data]);

  const locked = !!id; // el alcance se fija al empezar la conversación
  const ok = scopeOk(scope);

  const peek = useSubmit(async () => {
    let activeScope = scope;
    try {
      const res = await api.analysisContext(activeScope);
      setCtx(res);
      setEditingScope(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "FUTURE_DATE_NOT_ALLOWED") {
        const clamped = clampForTimezone(activeScope);
        if (clamped) {
          activeScope = clamped;
          setScope(clamped);
          const res = await api.analysisContext(clamped);
          setCtx(res);
          setEditingScope(false);
          return;
        }
      }
      throw e;
    }
  });

  const send = useSubmit(async (_k: string, override?: string) => {
    const q = (override ?? text).trim();
    if (q.length < 3 || !ok) return;
    const before = local;
    setLocal((l) => [...l, { role: "user", content: q }]);
    setText(""); setCtx(null); setEditingScope(false);
    let createdNow: string | null = null;
    try {
      let cid = id;
      let activeScope = scope;
      if (!cid) {
        try {
          cid = (await api.createChat({ scope: activeScope, saveHistory })).id;
        } catch (e) {
          if (e instanceof ApiError && e.code === "FUTURE_DATE_NOT_ALLOWED") {
            const clamped = clampForTimezone(activeScope);
            if (clamped) {
              activeScope = clamped;
              setScope(clamped);
              cid = (await api.createChat({ scope: clamped, saveHistory })).id;
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
        createdNow = cid;
        setId(cid);
      }
      const history = before.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 3800) }));
      const r = await api.sendChat(cid, { text: q, ...(saveHistory ? {} : { history }) });
      setLocal((l) => [...l, { role: "assistant", content: r.answer }]);
      setLast(r);
    } catch (e) {
      setLocal(before); setText(q);
      if (createdNow) { setId(undefined); void api.deleteChat(createdNow).catch(() => {}); }
      await dialog.fail(e, "No se pudo preguntar");
    }
  });

  useEffect(() => {
    if (local.length === 0 && !send.busy) return;
    const handle = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(handle);
  }, [local.length, send.busy]);

  const saveCurrent = useSubmit(async () => {
    if (!id || saveHistory) return;
    const msgs = local.slice(-100).map((m) => ({ role: m.role, content: m.content.slice(0, 3900) }));
    try {
      await api.saveChat(id, { messages: msgs });
      setSaveHistory(true);
    } catch (e) {
      await dialog.fail(e, "No se pudo guardar la conversación");
    }
  });

  const remove = async () => {
    if (!id) return;
    if (!(await dialog.confirm({ title: "¿Borrar esta conversación?", message: "Se elimina con todos sus mensajes y no se puede deshacer.", confirmLabel: "Borrar", danger: true }))) return;
    try { await api.deleteChat(id); router.replace("/analysis" as never); } catch (e) { await dialog.fail(e, "No se pudo borrar"); }
  };
  const fresh = () => { if (chatId) router.replace("/analysis" as never); else { setId(undefined); setLocal([]); setLast(null); setCtx(null); setText(""); setEditingScope(false); } };

  if (chatId && existing.loading && !existing.data) return <Screen title="Análisis con IA"><Loading /></Screen>;
  if (chatId && (existing.error || !existing.data)) return <Screen title="Análisis con IA"><ErrorBox message={existing.error ?? "No se encontró la conversación."} onRetry={existing.reload} /></Screen>;

  const canSend = text.trim().length >= 3 && ok && !send.busy;
  const IconBtn = ({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: danger ? `${colors.expense}1A` : colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={18} color={danger ? colors.expenseStrong : colors.text} />
    </TouchableOpacity>
  );

  return (
    <Screen title="Análisis con IA" subtitle="Responde con tus datos" scrollRef={scrollRef}
      right={<View style={{ flexDirection: "row", gap: 6 }}>
        {(local.length > 0 || locked) && <IconBtn icon="add" label="Nueva conversación" onPress={fresh} />}
        <IconBtn icon="time-outline" label="Conversaciones anteriores" onPress={() => router.push("/analysis/chats" as never)} />
        {id && saveHistory && <IconBtn icon="trash-outline" label="Borrar conversación" onPress={remove} danger />}
      </View>}
      footer={(
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, paddingHorizontal: 12, justifyContent: "center" }}>
            <TextInput value={text} onChangeText={setText} multiline placeholder={local.length ? "Pregunta algo más…" : "Escribe tu pregunta…"} placeholderTextColor={colors.muted} maxLength={500} style={{ color: colors.text, fontFamily: "AsapMedium", fontSize: 15, maxHeight: 96, paddingVertical: 10 }} />
          </View>
          <TouchableOpacity onPress={() => void send.submit()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Preguntar" style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: canSend ? colors.primarySurface : `${colors.text}12` }}>
            {send.busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Ionicons name="arrow-up" size={22} color={canSend ? colors.onPrimary : colors.muted} />}
          </TouchableOpacity>
        </View>
      )}>
      {/* Qué se analiza (se expande en línea para evitar modales anidados con fechas y selectores múltiples) */}
      <TouchableOpacity onPress={() => (locked ? undefined : setEditingScope((v) => !v))} disabled={locked} accessibilityRole="button" accessibilityLabel="Qué se analiza" accessibilityState={{ expanded: editingScope }} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: editingScope ? colors.primary : colors.border }}>
        <Ionicons name={locked ? "lock-closed-outline" : "options-outline"} size={16} color={colors.primary} />
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapMedium" }}>{scopeSummary(scope)}</Text>
        {!locked && <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>{editingScope ? "Ocultar" : "Cambiar"}</Text>}
      </TouchableOpacity>

      {/* Estado de guardado: visible siempre antes y durante la conversación */}
      {!locked ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: saveHistory ? colors.primary : colors.border }}>
          <SwitchRow
            label="Guardar esta conversación"
            hint={saveHistory ? "Permanece en tu cuenta sin vencimiento hasta que la borres" : "Temporal: se borra al salir (también puedes guardarla después)"}
            value={saveHistory}
            onValueChange={setSaveHistory}
          />
        </View>
      ) : saveHistory ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}30` }}>
          <Ionicons name="bookmark" size={15} color={colors.primary} />
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>
            Guardada · permanece en tu cuenta sin vencimiento hasta que la borres.
          </Text>
        </View>
      ) : local.length > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="bookmark-outline" size={16} color={colors.textSecondary} />
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
            Temporal (se pierde al salir). Guárdala para conservarla sin vencimiento.
          </Text>
          <Button title="Guardar" icon="bookmark-outline" size="small" variant="secondary" busy={saveCurrent.busy} disabled={send.busy} onPress={saveCurrent.submit} />
        </View>
      ) : null}

      {editingScope && !locked && (
        <Card>
          <Txt bold size={15}>¿Qué analizar?</Txt>
          <Txt size={13} muted>La IA solo verá lo que elijas aquí. Si no filtras nada, analiza todo el periodo.</Txt>
          <ScopeForm value={scope} onChange={(s2) => { setScope(s2); setCtx(null); peek.setError(null); }} />
          {!ok && <Notice tone="warn">Revisa las fechas: «Hasta» debe ser igual o posterior a «Desde».</Notice>}
          {peek.error && <Notice tone="err">{peek.error}</Notice>}
          <Button title="Ver qué datos usaría la IA" variant="secondary" busy={peek.busy} disabled={!ok} onPress={peek.submit} />
          <Button title="Listo" onPress={() => setEditingScope(false)} disabled={!ok} />
        </Card>
      )}

      {local.length === 0 && (
        <View style={{ gap: 12, paddingTop: 6 }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            <GeminiMark size={38} id="hello" />
            <Text style={{ color: colors.text, fontSize: 17, fontFamily: "AsapBold" }}>¿Qué quieres saber?</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center" }}>Responde solo con tus datos y no puede cambiar nada. Puedes seguir preguntando sobre la respuesta.</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {SUGGESTIONS.map((q) => (
              <TouchableOpacity key={q} disabled={send.busy || !ok} onPress={() => void send.submit(q)} accessibilityRole="button" hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }} style={{ minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, justifyContent: "center", backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33`, opacity: send.busy || !ok ? 0.5 : 1 }}>
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
      <Button title="Eliminar" variant="outlineDanger" icon="trash-outline" onPress={remove} />
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
    <Screen title="Conversaciones" subtitle="Se guardan sin fecha de vencimiento" footer={<Button title="Nueva conversación" icon="add" onPress={() => router.replace("/analysis" as never)} />}>
      <Notice tone="info">Las conversaciones guardadas permanecen en tu cuenta hasta que las borres. Las temporales no se almacenan.</Notice>
      {(chats.loading && !chats.data) || (saved.loading && !saved.data) ? <Loading /> : chats.error || saved.error ? <ErrorBox message={(chats.error ?? saved.error)!} onRetry={() => { void chats.reload(); void saved.reload(); }} /> : empty ? (
        <Empty icon="chatbubbles-outline" title="Aún no hay conversaciones guardadas" text="Activa «Guardar esta conversación» antes de preguntar, o toca «Guardar» mientras conversas con la IA." />
      ) : (
        <>
          {(chats.data ?? []).map((c) => (
            <RowLink key={c.id} onPress={() => router.push(`/analysis/chat/${c.id}` as never)}>
              <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}14` }}><GeminiMark size={16} id={c.id.slice(0, 6)} /></View>
              <View style={{ flex: 1 }}>
                <Txt bold numberOfLines={1}>{c.title || "Conversación"}</Txt>
                <Txt size={12} muted numberOfLines={1}>{scopeSummary(c.scope)} · {humanDate(c.updatedAt.slice(0, 10))}</Txt>
              </View>
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
