import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import { Button, Card, ErrorBox, Field, Loading, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useDialog } from "../../context/DialogContext";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";
import { cmpMoney, formatSoles } from "../../utils/money";

/** Editar una cuenta (nombre, predeterminada, excluir del total), archivarla, restaurarla o eliminarla. */
export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const done = useDone();
  const acc = useAsync(() => api.account(id), [id]);
  const [name, setName] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [exclude, setExclude] = useState<boolean | null>(null);
  const save = useSubmit(async () => {
    const a = acc.data!;
    return api.patchAccount(id, {
      ...(name !== null && name.trim() && name.trim() !== a.name ? { name: name.trim() } : {}),
      ...(isDefault !== null && isDefault !== a.isDefault ? { isDefault } : {}),
      ...(exclude !== null && exclude !== a.excludeFromTotal ? { excludeFromTotal: exclude } : {}),
    }, a.version);
  });
  const archive = useSubmit(async () => api.archiveAccount(id));
  const restore = useSubmit(async () => api.restoreAccount(id));
  const remove = useSubmit(async () => api.removeAccount(id));

  if (acc.loading && !acc.data) return <Screen title="Editar cuenta"><Loading /></Screen>;
  if (acc.error || !acc.data) return <Screen title="Editar cuenta"><ErrorBox message={acc.error ?? "No se encontró la cuenta."} onRetry={acc.reload} /></Screen>;
  const a = acc.data;
  const trimmedName = (name ?? a.name).trim();
  const nameErr = name !== null && trimmedName.length === 0 ? "Escribe un nombre para la cuenta" : undefined;
  const dirty = !nameErr && ((name !== null && trimmedName !== a.name) || (isDefault !== null && isDefault !== a.isDefault) || (exclude !== null && exclude !== a.excludeFromTotal));
  const hasBalance = cmpMoney(a.balance, "0.00") !== 0;

  return (
    <Screen title="Editar cuenta" subtitle={a.name}
      footer={a.status === "active" ? <Button title="Guardar cambios" busy={save.busy} disabled={!dirty} onPress={async () => { if (await save.submit()) done(`/account/${id}`); }} /> : undefined}>
      {a.status === "active" ? (
        <>
          <Card>
            <Field label="Nombre" value={name ?? a.name} onChangeText={(v) => { setName(v); save.resetKey(); }} autoCapitalize="words" error={nameErr} />
            <SwitchRow label="Usarla como cuenta predeterminada" value={isDefault ?? a.isDefault} onValueChange={(v) => { setIsDefault(v); save.resetKey(); }} />
            <SwitchRow label="Excluir del saldo total" value={exclude ?? a.excludeFromTotal} onValueChange={(v) => { setExclude(v); save.resetKey(); }} />
          </Card>
          {save.error && <Notice tone="err">{save.error}</Notice>}

          <Card>
            <Txt bold>Archivar cuenta</Txt>
            <Txt size={12} muted style={{ marginBottom: 8 }}>Deja de aparecer para nuevos movimientos, pero su historial se conserva y podrás restaurarla desde Dinero.</Txt>
            <Button title="Archivar cuenta" variant="secondary" icon="archive-outline" busy={archive.busy} onPress={async () => {
              const ok = await dialog.confirm({
                title: `¿Archivar ${a.name}?`,
                message: hasBalance
                  ? `Esta cuenta tiene un saldo actual de ${formatSoles(a.balance)} y saldrá de tu saldo total. Podrás restaurarla cuando quieras.`
                  : "Dejará de aparecer para nuevos movimientos. Podrás restaurarla desde Dinero → Cuentas archivadas.",
                confirmLabel: "Archivar",
                cancelLabel: "Cancelar",
              });
              if (ok && await archive.submit()) router.replace("/money" as never);
            }} />
            {archive.error && <Notice tone="err">{archive.error}</Notice>}
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
        <Button title="Eliminar cuenta" variant="outlineDanger" icon="trash-outline" busy={remove.busy} onPress={async () => {
          const ok = await dialog.confirm({
            title: `¿Eliminar ${a.name}?`,
            message: "Esta acción es definitiva. Solo se permite si la cuenta nunca tuvo movimientos ni registros vinculados.",
            confirmLabel: "Eliminar",
            cancelLabel: "Cancelar",
            danger: true,
          });
          if (ok && await remove.submit()) router.replace("/money" as never);
        }} />
        {remove.error && <Notice tone="err">{remove.error}</Notice>}
      </Card>
    </Screen>
  );
}
