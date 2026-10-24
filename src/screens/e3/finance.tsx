import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Category, OperationItem } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, FlowResult, MoneyField, PreviewFooter, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { normalizeMoneyInput } from "../../utils/money";

/** Categorías (dos niveles): crear, renombrar, archivar y restaurar. */
export function CategoriesScreen() {
  const cats = useAsync(() => api.categories(), []);
  useFocusReload(cats.reload);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; version: number } | null>(null);
  const create = useSubmit(async () => api.createCategory({ name: name.trim(), parentId }));
  const rename = useSubmit(async () => api.patchCategory(editing!.id, { name: editing!.name.trim() }, editing!.version));
  const toggle = useSubmit(async (_k: string, c: Category) => (c.status === "active" ? api.archiveCategory(c.id) : api.restoreCategory(c.id)));

  const row = (c: Category, depth: number) => (
    <Card key={c.id} outlined style={{ marginLeft: depth * 16, opacity: c.status === "archived" ? 0.6 : 1 }}>
      {editing?.id === c.id ? (
        <View>
          <Field label="Nombre" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} autoCapitalize="words" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Guardar" busy={rename.busy} disabled={!editing.name.trim()} onPress={async () => { if (await rename.submit()) { setEditing(null); void cats.reload(); } }} /></View>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setEditing(null)} /></View>
          </View>
          {rename.error && <Notice tone="err">{rename.error}</Notice>}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt bold style={{ flex: 1 }}>{c.name}</Txt>
          {c.status === "archived" && <Chip status="converted" label="Archivada" />}
          <Button title="Renombrar" variant="secondary" onPress={() => setEditing({ id: c.id, name: c.name, version: c.version })} />
          <Button title={c.status === "active" ? "Archivar" : "Restaurar"} variant="secondary" onPress={async () => { if (await toggle.submit(c)) void cats.reload(); }} />
        </View>
      )}
    </Card>
  );
  const roots = cats.data ?? [];
  return (
    <Screen title="Categorías" subtitle="Categoría y subcategoría">
      <Card>
        <Field label="Nueva categoría" value={name} onChangeText={(v) => { setName(v); create.resetKey(); }} placeholder="Restaurantes" autoCapitalize="words" />
        <Choice label="Dentro de" value={parentId ?? "__root__"} onChange={(v) => setParentId(v === "__root__" ? null : v)}
          options={[{ id: "__root__", label: "Ninguna (categoría principal)" }, ...roots.filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name }))]} />
        <Button title="Crear" disabled={!name.trim()} busy={create.busy} onPress={async () => { if (await create.submit()) { setName(""); void cats.reload(); } }} />
        {create.error && <Notice tone="err">{create.error}</Notice>}
      </Card>
      {toggle.error && <Notice tone="err">{toggle.error}</Notice>}
      {cats.loading && !cats.data ? <Loading /> : cats.error ? <ErrorBox message={cats.error} onRetry={cats.reload} /> : roots.flatMap((c) => [row(c, 0), ...(c.children ?? []).map((k) => row(k, 1))])}
    </Screen>
  );
}

/** Reglas de clasificación: lista y alta con las condiciones que acepta el backend. */
export function RulesScreen() {
  const router = useRouter();
  const rules = useAsync(() => api.rules(), []);
  useFocusReload(rules.reload);
  const act = useSubmit(async (_k: string, id: string, a: "archive" | "restore") => (a === "archive" ? api.archiveRule(id) : api.restoreRule(id)));
  return (
    <Screen title="Reglas" subtitle="Tus reglas mandan; gana la de menor prioridad" footer={<Button title="Nueva regla" icon="add" onPress={() => router.push("/rules/new" as never)} />}>
      {rules.loading && !rules.data ? <Loading /> : rules.error ? <ErrorBox message={rules.error} onRetry={rules.reload} /> : (rules.data ?? []).length === 0 ? (
        <Empty icon="funnel-outline" title="Sin reglas" text="Una regla asigna o sugiere una categoría según cuenta, dirección, importe o texto." />
      ) : (rules.data ?? []).map((r) => (
        <Card key={r.id} outlined style={{ opacity: r.status === "archived" ? 0.6 : 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt bold>{r.name}</Txt>
              <Txt size={12} muted>Prioridad {r.priority} · {r.action === "assign" ? "asigna" : "sugiere"} «{r.category.name}»</Txt>
              <Txt size={12} muted>{[r.direction === "income" ? "ingreso" : r.direction === "expense" ? "gasto" : null, r.textContains ? `contiene «${r.textContains}»` : null, r.amountMin ? `desde S/ ${r.amountMin}` : null, r.amountMax ? `hasta S/ ${r.amountMax}` : null].filter(Boolean).join(" · ")}</Txt>
            </View>
            <Button title={r.status === "active" ? "Archivar" : "Restaurar"} variant="secondary" onPress={async () => { if (await act.submit(r.id, r.status === "active" ? "archive" : "restore")) void rules.reload(); }} />
          </View>
        </Card>
      ))}
      {act.error && <Notice tone="err">{act.error}</Notice>}
    </Screen>
  );
}

export function RuleNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("100");
  const [direction, setDirection] = useState<"any" | "income" | "expense">("any");
  const [account, setAccount] = useState<string | null>(null);
  const [useAccount, setUseAccount] = useState(false);
  const [text, setText] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [action, setAction] = useState<"assign" | "suggest">("assign");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const save = useSubmit(async () => api.createRule({
    name: name.trim(), priority: Number.parseInt(priority, 10) || 0, action, categoryId: categoryId!,
    ...(direction !== "any" ? { direction } : {}), ...(useAccount && account ? { accountId: account } : {}), ...(text.trim() ? { textContains: text.trim() } : {}),
    ...(normalizeMoneyInput(min) ? { amountMin: normalizeMoneyInput(min)! } : {}), ...(normalizeMoneyInput(max) ? { amountMax: normalizeMoneyInput(max)! } : {}),
  }));
  const hasCondition = direction !== "any" || (useAccount && !!account) || !!text.trim() || !!normalizeMoneyInput(min) || !!normalizeMoneyInput(max);
  return (
    <Screen title="Nueva regla" footer={<Button title="Crear regla" busy={save.busy} disabled={!name.trim() || !categoryId || !hasCondition} onPress={async () => { if (await save.submit()) router.back(); }} />}>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); save.resetKey(); }} placeholder="Netflix" autoCapitalize="sentences" />
        <Field label="Prioridad (menor número gana)" value={priority} onChangeText={setPriority} keyboardType="number-pad" />
        <Txt size={12} muted style={{ marginBottom: 8 }}>CONDICIONES (al menos una)</Txt>
        <Choice label="Dirección" value={direction} onChange={setDirection} options={[{ id: "any", label: "Cualquiera" }, { id: "expense", label: "Gasto" }, { id: "income", label: "Ingreso" }]} />
        <Field label="El texto contiene" value={text} onChangeText={setText} placeholder="netflix" />
        <MoneyField label="Importe mínimo" value={min} optional onChange={setMin} />
        <MoneyField label="Importe máximo" value={max} optional onChange={setMax} />
        <Choice label="Cuenta" value={useAccount ? "one" : "any"} onChange={(v) => setUseAccount(v === "one")} options={[{ id: "any", label: "Cualquiera" }, { id: "one", label: "Una en particular" }]} />
        {useAccount && <AccountPicker label="Cuenta" value={account} onChange={setAccount} />}
      </Card>
      <Card>
        <Choice label="Acción" value={action} onChange={setAction} options={[{ id: "assign", label: "Asignar la categoría" }, { id: "suggest", label: "Solo sugerirla" }]} />
        <CategoryPicker label="Categoría" value={categoryId} onChange={setCategoryId} allowNone={false} />
      </Card>
      {!hasCondition && <Notice tone="warn">Agrega al menos una condición.</Notice>}
      {save.error && <Notice tone="err">{save.error}</Notice>}
    </Screen>
  );
}

/** Movimientos sin categoría: elegir una a mano o clasificarlos con las reglas (solo a petición y solo lo que no tiene categoría). */
export function ClassifyScreen() {
  const list = useAsync(() => api.operations({ uncategorized: "true", limit: 100 }), []);
  useFocusReload(list.reload);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const flow = usePreviewFlow({ preview: () => api.previewClassify({}), apply: (token, key) => api.applyClassify({ previewToken: token }, key) });
  const set = useSubmit(async (_k: string, o: OperationItem) => {
    const d = await api.operation(o.id);
    return api.patchOperation(o.id, { categoryId: picked[o.id] ?? null }, d.version);
  });
  return (
    <Screen title="Sin categoría" subtitle="Clasifica a mano o con tus reglas"
      footer={<PreviewFooter flow={flow} previewLabel="Clasificar con mis reglas" confirmLabel="Aplicar reglas" onConfirm={async () => { if (await flow.confirm()) { flow.invalidate(); void list.reload(); } }} />}>
      <FlowResult flow={flow} />
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : (list.data?.items ?? []).length === 0 ? (
        <Empty icon="checkmark-done-outline" title="Todo clasificado" text="No hay movimientos sin categoría." />
      ) : (list.data?.items ?? []).map((o) => (
        <Card key={o.id} outlined>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}><Txt bold size={14}>{o.description || (o.kind === "income" ? "Ingreso" : "Gasto")}</Txt><Txt size={12} muted>{humanDate(o.occurredOn)}</Txt></View>
            <Money value={o.amount} size={15} tone={o.amount.startsWith("-") ? "expense" : "income"} />
          </View>
          <CategoryPicker label="Categoría" value={picked[o.id] ?? null} onChange={(v) => setPicked((p) => ({ ...p, [o.id]: v }))} allowNone={false} />
          <Button title="Guardar categoría" variant="secondary" busy={set.busy} disabled={!picked[o.id]} onPress={async () => { if (await set.submit(o)) void list.reload(); }} />
        </Card>
      ))}
      {set.error && <Notice tone="err">{set.error}</Notice>}
    </Screen>
  );
}

export function FinanceMenuScreen() {
  const router = useRouter();
  const items: Array<[string, string, string]> = [
    ["Categorías", "Categorías y subcategorías", "/categories"], ["Reglas de clasificación", "Asignan o sugieren categorías", "/rules"], ["Movimientos sin categoría", "Clasifica lo pendiente", "/classify"],
    ["Presupuestos", "Límites por categoría o generales", "/budgets"], ["Metas de ahorro", "Reserva dinero para un objetivo", "/goals"], ["Recurrentes", "Sueldo, alquiler y otros", "/recurring"],
    ["Bandeja de captura", "Comprobantes por revisar", "/capture"], ["Análisis con IA", "Preguntas y chat sobre tus datos", "/analysis"], ["Préstamos bancarios", "Con cronograma y documentos", "/bank-loans"],
    ["Préstamos", "Recibidos y otorgados", "/loans"], ["Nuevo préstamo", "Con interés, cuotas o sin fecha", "/loans/new"], ["Devoluciones", "Dinero por devolver", "/refunds"],
  ];
  return (
    <Screen title="Finanzas" back={false}>
      {items.map(([t, s, to]) => (
        <RowLink key={to} onPress={() => router.push(to as never)}><View style={{ flex: 1 }}><Txt bold>{t}</Txt><Txt size={12} muted>{s}</Txt></View></RowLink>
      ))}
      <Heading>Tarjetas y cuentas</Heading>
      <Txt size={12} muted>La configuración de una tarjeta y la conciliación están dentro de cada cuenta.</Txt>
    </Screen>
  );
}
