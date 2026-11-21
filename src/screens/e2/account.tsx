import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../api/client";
import { Button, Card, ErrorBox, Field, Loading, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useDone } from "../../hooks/useDone";

/** Editar una cuenta (nombre, predeterminada, excluir del total) o archivarla. El tipo y el saldo no se editan aquí. */
export function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  if (acc.loading && !acc.data) return <Screen title="Editar cuenta"><Loading /></Screen>;
  if (acc.error || !acc.data) return <Screen title="Editar cuenta"><ErrorBox message={acc.error ?? "No se encontró la cuenta."} onRetry={acc.reload} /></Screen>;
  const a = acc.data;
  const dirty = (name !== null && name.trim() !== a.name) || (isDefault !== null && isDefault !== a.isDefault) || (exclude !== null && exclude !== a.excludeFromTotal);
  return (
    <Screen title="Editar cuenta" subtitle={a.name} footer={<Button title="Guardar cambios" busy={save.busy} disabled={!dirty} onPress={async () => { if (await save.submit()) done(`/account/${id}`); }} />}>
      <Card>
        <Field label="Nombre" value={name ?? a.name} onChangeText={(v) => { setName(v); save.resetKey(); }} autoCapitalize="words" />
        <SwitchRow label="Usarla como cuenta predeterminada" value={isDefault ?? a.isDefault} onValueChange={(v) => { setIsDefault(v); save.resetKey(); }} />
        <SwitchRow label="Excluir del saldo total" value={exclude ?? a.excludeFromTotal} onValueChange={(v) => { setExclude(v); save.resetKey(); }} />
      </Card>
      {save.error && <Notice tone="err">{save.error}</Notice>}

      {a.status === "active" && (
        <Card>
          <Txt bold>Archivar cuenta</Txt>
          <Txt size={12} muted style={{ marginBottom: 8 }}>Una cuenta archivada deja de aparecer para nuevos movimientos; su historial se conserva. Si tiene saldo distinto de cero, se archiva con aviso.</Txt>
          <Button title="Archivar" variant="danger" busy={archive.busy} onPress={async () => { if (await archive.submit()) done("/"); }} />
          {archive.error && <Notice tone="err">{archive.error}</Notice>}
        </Card>
      )}
    </Screen>
  );
}
