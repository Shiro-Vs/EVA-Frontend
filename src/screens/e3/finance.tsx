import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Category, OperationItem } from "../../api/types";
import { AccountPicker, CategoryPicker, Choice, FlowResult, MoneyField, PreviewFooter, usePreviewFlow } from "../../components/v1/forms";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, Loading, MenuRow, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import BottomSheet from "../../components/common/BottomSheet";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { clearDismissedUncategorized, dismissUncategorized, getDismissedUncategorized, undismissUncategorized } from "../../utils/dismissedUncategorized";
import { normalizeMoneyInput } from "../../utils/money";

/** Categorías (dos niveles): árbol con líneas, renombrar, archivar, restaurar y eliminar (solo si no tiene uso). */
export function CategoriesScreen() {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const cats = useAsync(() => api.categories(), []);
  useFocusReload(cats.reload);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; version: number } | null>(null);
  const [menu, setMenu] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try { await api.createCategory({ name: name.trim(), parentId }); setName(""); await cats.reload(); }
    catch (e) { await dialog.fail(e, "No se pudo crear la categoría"); }
    finally { setBusy(false); }
  };
  const rename = async () => {
    if (!editing) return;
    setBusy(true);
    try { await api.patchCategory(editing.id, { name: editing.name.trim() }, editing.version); setEditing(null); await cats.reload(); }
    catch (e) { await dialog.fail(e, "No se pudo renombrar"); }
    finally { setBusy(false); }
  };
  const archive = async (c: Category) => {
    setMenu(null);
    const kids = (c.children ?? []).filter((k) => k.status === "active").length;
    const ok = await dialog.confirm({ title: `¿Archivar «${c.name}»?`, message: `Dejará de ofrecerse al clasificar${kids ? `, junto con sus ${kids} subcategorías` : ""}. Tu historial no cambia y puedes restaurarla cuando quieras.`, confirmLabel: "Archivar" });
    if (!ok) return;
    try { await api.archiveCategory(c.id); await cats.reload(); await dialog.success("Categoría archivada"); }
    catch (e) { await dialog.fail(e, "No se pudo archivar"); }
  };
  const restore = async (c: Category) => {
    setMenu(null);
    try { await api.restoreCategory(c.id); await cats.reload(); await dialog.success("Categoría restaurada"); }
    catch (e) { await dialog.fail(e, "No se pudo restaurar"); }
  };
  const remove = async (c: Category) => {
    setMenu(null);
    const ok = await dialog.confirm({ title: `¿Eliminar «${c.name}»?`, message: "Se borra para siempre y no se puede deshacer. Solo se puede si no tiene subcategorías ni se usó en ningún movimiento, regla o presupuesto.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    try { await api.deleteCategory(c.id); await cats.reload(); await dialog.success("Categoría eliminada"); }
    catch (e) { await dialog.fail(e, "No se pudo eliminar"); }
  };

  const LINE = colors.borderStrong;
  const header = (c: Category, child: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: c.status === "archived" ? 0.6 : 1 }}>
      {editing?.id === c.id ? (
        <View style={{ flex: 1 }}>
          <Field label="Nombre" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} autoCapitalize="words" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Guardar" size="compact" busy={busy} disabled={!editing.name.trim()} onPress={rename} /></View>
            <View style={{ flex: 1 }}><Button title="Cancelar" size="compact" variant="secondary" onPress={() => setEditing(null)} /></View>
          </View>
        </View>
      ) : (
        <>
          <Ionicons name={child ? "return-down-forward-outline" : "folder-outline"} size={18} color={colors.primary} />
          <Txt bold style={{ flex: 1 }} numberOfLines={1}>{c.name}</Txt>
          {c.status === "archived" && <Chip status="converted" label="Archivada" />}
          <TouchableOpacity onPress={() => setMenu(c)} accessibilityRole="button" accessibilityLabel={`Acciones de ${c.name}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12` }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const roots = cats.data ?? [];
  const tree = roots.map((c) => {
    const kids = c.children ?? [];
    return (
      <View key={c.id}>
        <Card outlined style={{ paddingVertical: 10 }}>{header(c, false)}</Card>
        {kids.map((k, i) => {
          const last = i === kids.length - 1;
          return (
            <View key={k.id} style={{ flexDirection: "row", marginTop: 6 }}>
              {/* Líneas del árbol: una vertical continua del padre a sus hijas y un ramal horizontal a cada una */}
              <View style={{ width: 28 }}>
                <View style={{ position: "absolute", left: 13, top: -6, bottom: last ? "50%" : 0, width: 2, backgroundColor: LINE, borderRadius: 1 }} />
                <View style={{ position: "absolute", left: 13, top: "50%", width: 15, height: 2, marginTop: -1, backgroundColor: LINE, borderRadius: 1 }} />
              </View>
              <View style={{ flex: 1 }}><Card outlined style={{ paddingVertical: 8 }}>{header(k, true)}</Card></View>
            </View>
          );
        })}
      </View>
    );
  });

  return (
    <Screen title="Categorías" subtitle="Categoría y subcategoría">
      <Card>
        <Field label="Nueva categoría" value={name} onChangeText={setName} placeholder="Restaurantes" autoCapitalize="words" />
        <Choice select label="Dentro de" value={parentId ?? "__root__"} onChange={(v) => setParentId(v === "__root__" ? null : v)}
          options={[{ id: "__root__", label: "Ninguna (categoría principal)" }, ...roots.filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.name }))]} />
        <Button title="Crear" disabled={!name.trim()} busy={busy} onPress={create} />
      </Card>
      {cats.loading && !cats.data ? <Loading /> : cats.error ? <ErrorBox message={cats.error} onRetry={cats.reload} /> : <View style={{ gap: 8 }}>{tree}</View>}

      <BottomSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ""} maxHeight={0.6}>
        {menu && (
          <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
            <MenuRow icon="create-outline" title="Renombrar" onPress={() => { setEditing({ id: menu.id, name: menu.name, version: menu.version }); setMenu(null); }} />
            {!menu.parentId && menu.status === "active" && <View style={{ height: 6 }} />}
            {!menu.parentId && menu.status === "active" && <MenuRow icon="add-circle-outline" title="Agregar subcategoría" text="Se crea dentro de esta categoría" onPress={() => { setParentId(menu.id); setMenu(null); dialog.notify({ kind: "info", title: "Elige el nombre arriba", message: `La nueva categoría se creará dentro de «${menu.name}».` }); }} />}
            <View style={{ height: 6 }} />
            {menu.status === "active"
              ? <MenuRow icon="archive-outline" title="Archivar" text="Deja de ofrecerse al clasificar; el historial se conserva" onPress={() => archive(menu)} />
              : <MenuRow icon="arrow-undo-outline" title="Restaurar" onPress={() => restore(menu)} />}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12, marginHorizontal: 8 }} />
            <MenuRow danger icon="trash-outline" title="Eliminar" text="Solo si no tiene subcategorías ni uso" onPress={() => remove(menu)} />
          </View>
        )}
      </BottomSheet>
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
            <Button title={r.status === "active" ? "Archivar" : "Restaurar"} variant="secondary" size="small" onPress={async () => { if (await act.submit(r.id, r.status === "active" ? "archive" : "restore")) void rules.reload(); }} />
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

/** Movimientos sin categoría: elegir una a mano, omitir los que no quieras categorizar o clasificarlos con tus reglas. */
export function ClassifyScreen() {
  const list = useAsync(() => api.operations({ uncategorized: "true", limit: 100 }), []);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const reloadAll = () => {
    void list.reload();
    getDismissedUncategorized().then(setDismissed).catch(() => {});
  };
  useFocusReload(reloadAll);
  React.useEffect(() => {
    getDismissedUncategorized().then(setDismissed).catch(() => {});
  }, []);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const flow = usePreviewFlow({ preview: () => api.previewClassify({}), apply: (token, key) => api.applyClassify({ previewToken: token }, key) });
  const set = useSubmit(async (_k: string, o: OperationItem) => {
    const d = await api.operation(o.id);
    return api.patchOperation(o.id, { categoryId: picked[o.id] ?? null }, d.version);
  });

  const allItems = list.data?.items ?? [];
  const pendingItems = allItems.filter((o) => !dismissed.has(o.id));
  const omittedItems = allItems.filter((o) => dismissed.has(o.id));
  const shown = showDismissed ? allItems : pendingItems;

  return (
    <Screen title="Sin categoría" subtitle="Clasifica a mano, omite o usa tus reglas"
      footer={pendingItems.length > 0 ? <PreviewFooter flow={flow} previewLabel="Clasificar con mis reglas" confirmLabel="Aplicar reglas" onConfirm={async () => { if (await flow.confirm()) { flow.invalidate(); void list.reload(); } }} /> : undefined}>
      <FlowResult flow={flow} />
      {pendingItems.length > 1 && !showDismissed && (
        <Button
          title={`No categorizar ninguno (${pendingItems.length})`}
          variant="secondary"
          size="compact"
          icon="eye-off-outline"
          onPress={async () => { setDismissed(await dismissUncategorized(pendingItems.map((x) => x.id))); }}
        />
      )}
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : shown.length === 0 ? (
        <Empty icon="checkmark-done-outline" title="Todo al día" text={omittedItems.length > 0 ? `Omitiste ${omittedItems.length} ${omittedItems.length === 1 ? "movimiento" : "movimientos"} sin categoría.` : "No hay movimientos sin categoría."} />
      ) : shown.map((o) => {
        const isOmitted = dismissed.has(o.id);
        return (
          <Card key={o.id} outlined style={{ opacity: isOmitted ? 0.72 : 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt bold size={14}>{o.description || (o.kind === "income" ? "Ingreso" : "Gasto")}</Txt>
                <Txt size={12} muted>{humanDate(o.occurredOn)}{isOmitted ? " · Omitido" : ""}</Txt>
              </View>
              <Money value={o.amount} size={15} tone={o.amount.startsWith("-") ? "expense" : "income"} />
            </View>
            <CategoryPicker label="Categoría" value={picked[o.id] ?? null} onChange={(v) => setPicked((p) => ({ ...p, [o.id]: v }))} allowNone={false} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Guardar" variant="secondary" busy={set.busy} disabled={!picked[o.id]} onPress={async () => { if (await set.submit(o)) void list.reload(); }} />
              </View>
              <View style={{ flex: 1 }}>
                {isOmitted ? (
                  <Button title="Volver a mostrar" variant="secondary" onPress={async () => { setDismissed(await undismissUncategorized(o.id)); }} />
                ) : (
                  <Button title="No categorizar" variant="secondary" onPress={async () => { setDismissed(await dismissUncategorized([o.id])); }} />
                )}
              </View>
            </View>
          </Card>
        );
      })}
      {omittedItems.length > 0 && (
        <View style={{ gap: 8 }}>
          <Button
            title={showDismissed ? "Ocultar omitidos" : `Ver ${omittedItems.length} omitido${omittedItems.length === 1 ? "" : "s"}`}
            variant="secondary"
            size="compact"
            onPress={() => setShowDismissed((v) => !v)}
          />
          {showDismissed && (
            <Button
              title="Restaurar todos los omitidos"
              variant="secondary"
              size="compact"
              onPress={async () => { await clearDismissedUncategorized(); setDismissed(new Set()); setShowDismissed(false); }}
            />
          )}
        </View>
      )}
      {set.error && <Notice tone="err">{set.error}</Notice>}
    </Screen>
  );
}

export function FinanceMenuScreen() {
  const router = useRouter();
  const items: Array<[string, string, string]> = [
    ["Categorías", "Categorías y subcategorías", "/categories"], ["Reglas de clasificación", "Asignan o sugieren categorías", "/rules"], ["Movimientos sin categoría", "Clasifica lo pendiente", "/classify"],
    ["Presupuestos", "Límites por categoría o generales", "/budgets"], ["Metas de ahorro", "Reserva dinero para un objetivo", "/goals"], ["Recurrentes", "Sueldo, alquiler y otros", "/recurring"],
    ["Resumen mensual", "Flujo, resultado, versiones y PDF", "/reports"], ["Panel", "Tus tarjetas elegidas", "/panel"], ["Bandeja de captura", "Comprobantes por revisar", "/capture"], ["Análisis con IA", "Preguntas y chat sobre tus datos", "/analysis"], ["Préstamos bancarios", "Con cronograma y documentos", "/bank-loans"],
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
