import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import { BankCardCustomizer } from "../../components/v1/BankCard";
import { Button, Card, ErrorBox, Field, Loading, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { normalizeCardPattern, type CardPattern } from "../../constants/banks";
import { useDialog } from "../../context/DialogContext";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { cmpMoney, formatSoles } from "../../utils/money";

/** Editar una cuenta (diseño de tarjeta, nombre, predeterminada, excluir del total), archivarla, restaurarla o eliminarla. */
export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const done = useDone();
  const acc = useAsync(() => api.account(id), [id]);
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null | undefined>(undefined);
  const [pattern, setPattern] = useState<CardPattern | undefined>(undefined);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [exclude, setExclude] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const save = useSubmit(async () => {
    const a = acc.data!;
    const currentPattern = normalizeCardPattern(a.icon);
    return api.patchAccount(id, {
      ...(name !== null && name.trim() && name.trim() !== a.name ? { name: name.trim() } : {}),
      ...(color !== undefined && color !== (a.color ?? null) ? { color } : {}),
      ...(pattern !== undefined && pattern !== currentPattern ? { icon: pattern === "circles" ? null : pattern } : {}),
      ...(isDefault !== null && isDefault !== a.isDefault ? { isDefault } : {}),
      ...(exclude !== null && exclude !== a.excludeFromTotal ? { excludeFromTotal: exclude } : {}),
    }, a.version);
  });
  const restore = useSubmit(async () => api.restoreAccount(id));

  if (acc.loading && !acc.data) return <Screen title="Editar cuenta"><Loading /></Screen>;
  if (acc.error || !acc.data) return <Screen title="Editar cuenta"><ErrorBox message={acc.error ?? "No se encontró la cuenta."} onRetry={acc.reload} /></Screen>;
  const a = acc.data;
  const trimmedName = (name ?? a.name).trim();
  const curColor = color === undefined ? (a.color ?? null) : color;
  const curPattern = pattern ?? normalizeCardPattern(a.icon);
  const nameErr = name !== null && trimmedName.length === 0 ? "Escribe un nombre para la cuenta" : undefined;
  const dirty = !nameErr && (
    (name !== null && trimmedName !== a.name)
    || (color !== undefined && color !== (a.color ?? null))
    || (pattern !== undefined && pattern !== normalizeCardPattern(a.icon))
    || (isDefault !== null && isDefault !== a.isDefault)
    || (exclude !== null && exclude !== a.excludeFromTotal)
  );
  const hasBalance = cmpMoney(a.balance, "0.00") !== 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await acc.reload(); } finally { setRefreshing(false); }
  };

  const doArchive = async () => {
    if (archiving) return;
    const ok = await dialog.confirm({
      title: `¿Archivar ${a.name}?`,
      message: hasBalance
        ? `Esta cuenta tiene un saldo actual de ${formatSoles(a.balance)} y saldrá de tu saldo total. Podrás restaurarla cuando quieras.`
        : "Dejará de aparecer para nuevos movimientos. Podrás restaurarla desde Dinero → Cuentas archivadas.",
      confirmLabel: "Archivar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    setArchiving(true);
    try {
      await api.archiveAccount(id);
      router.replace("/money" as never);
    } catch (e) {
      await dialog.fail(e, "No se pudo archivar");
    } finally {
      setArchiving(false);
    }
  };

  const doRemove = async () => {
    if (removing) return;
    const ok = await dialog.confirm({
      title: `¿Eliminar ${a.name}?`,
      message: "Esta acción es definitiva. Solo se permite si la cuenta nunca tuvo movimientos ni registros vinculados.",
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await api.removeAccount(id);
      router.replace("/money" as never);
    } catch (e) {
      await dialog.fail(e, "No se pudo eliminar");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Screen title="Editar cuenta" subtitle={a.name} refreshing={refreshing} onRefresh={onRefresh}
      footer={a.status === "active" ? <Button title="Guardar cambios" busy={save.busy} disabled={!dirty} onPress={async () => { if (await save.submit()) done(`/account/${id}`); }} /> : undefined}>
      {a.status === "active" ? (
        <>
          <Card>
            <BankCardCustomizer
              account={{ name: trimmedName || a.name, type: a.type, institution: a.institution, balance: a.balance, color: curColor, icon: curPattern }}
              color={curColor}
              pattern={curPattern}
              onChangeColor={(c) => { setColor(c); save.resetKey(); }}
              onChangePattern={(p) => { setPattern(p); save.resetKey(); }}
            />
          </Card>
          <Card>
            <Field label="Nombre" value={name ?? a.name} onChangeText={(v) => { setName(v); save.resetKey(); }} autoCapitalize="words" error={nameErr} />
            <SwitchRow label="Usarla como cuenta predeterminada" value={isDefault ?? a.isDefault} onValueChange={(v) => { setIsDefault(v); save.resetKey(); }} />
            <SwitchRow label="Excluir del saldo total" value={exclude ?? a.excludeFromTotal} onValueChange={(v) => { setExclude(v); save.resetKey(); }} />
          </Card>
          {save.error && <Notice tone="err">{save.error}</Notice>}

          <Card>
            <Txt bold>Archivar cuenta</Txt>
            <Txt size={12} muted style={{ marginBottom: 8 }}>Deja de aparecer para nuevos movimientos, pero su historial se conserva y podrás restaurarla desde Dinero.</Txt>
            <Button title="Archivar cuenta" variant="secondary" icon="archive-outline" busy={archiving} onPress={doArchive} />
          </Card>
        </>
      ) : (
        <Card>
          <Txt bold>Cuenta archivada</Txt>
          <Txt size={12} muted style={{ marginBottom: 8 }}>Restáurala para volver a registrar movimientos o editar sus ajustes.</Txt>
          <Button title="Restaurar cuenta" icon="refresh-outline" busy={restore.busy} onPress={async () => { if (await restore.submit()) void acc.reload(); }} />
          {restore.error && <Notice tone="err">{restore.error}</Notice>}
        </Card>
      )}

      <Card>
        <Txt bold>Eliminar cuenta</Txt>
        <Txt size={12} muted style={{ marginBottom: 8 }}>Solo se puede eliminar definitivamente si no tiene movimientos ni configuración vinculada.</Txt>
        <Button title="Eliminar cuenta" variant="outlineDanger" icon="trash-outline" busy={removing} onPress={doRemove} />
      </Card>
    </Screen>
  );
}
