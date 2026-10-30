import React, { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { session } from "../../api/http";
import { Button, Card, ErrorBox, Field, Heading, KV, Loading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync, useSubmit } from "../../hooks/useAsync";

const NAMES: Record<string, string> = {
  account: "Cuentas", account_entry: "Asientos de cuentas", financial_operation: "Movimientos", contact: "Contactos", subscription: "Servicios", receipt: "Cobros", loan: "Préstamos",
  bank_loan: "Préstamos bancarios", budget: "Presupuestos", goal: "Metas", category: "Categorías", source_document: "Documentos de captura", movement_proposal: "Propuestas de captura",
  backup: "Respaldos", export_job: "Exportaciones", report_snapshot: "Informes guardados", audit_event: "Bitácora de cambios", analysis_request: "Análisis guardados", chat_session: "Chats",
};

/** Privacidad: qué se guarda y cómo eliminarlo todo (09 §8). */
export function AccountPrivacyScreen() {
  const router = useRouter();
  const { logout, profile } = useAuth();
  const prev = useAsync(() => api.deletionPreview(), []);
  const [phrase, setPhrase] = useState("");
  const [open, setOpen] = useState(false);
  const del = useSubmit(async () => {
    const r = await api.deleteAccount({ previewToken: prev.data!.previewToken, confirm: phrase });
    await session.setToken(null);
    await logout();
    return r;
  });
  const p = prev.data;
  return (
    <Screen title="Cuenta y privacidad" subtitle={profile?.email ?? undefined}>
      <Card>
        <Txt bold>Tus datos</Txt>
        <Txt size={13}>Puedes llevarte una copia (en Ajustes → Respaldos y Exportar) y eliminar todo cuando quieras. Los datos de tus contactos son tuyos y se eliminan contigo.</Txt>
        <Button title="Crear un respaldo antes" variant="secondary" icon="cloud-done-outline" onPress={() => router.push("/settings/backups" as never)} />
      </Card>

      <Heading>Eliminar mi cuenta</Heading>
      {prev.loading && !p ? <Loading /> : prev.error || !p ? <ErrorBox message={prev.error ?? "No se pudo cargar."} onRetry={prev.reload} /> : (
        <>
          <Card outlined>
            <Txt bold>Se eliminaría</Txt>
            {Object.entries(p.tables).filter(([t]) => NAMES[t]).map(([t, n]) => <KV key={t} label={NAMES[t]!} value={String(n)} />)}
            <KV label="Archivos guardados" value={String(p.files)} />
            <KV label="Registros en total" value={String(p.totalRows)} strong />
          </Card>
          {p.warnings.map((w, i) => <Notice key={i} tone="warn">{w}</Notice>)}
          {!open ? <Button title="Quiero eliminar mi cuenta" variant="danger" onPress={() => setOpen(true)} /> : (
            <Card>
              <Txt bold>Confirma escribiendo: {p.confirmPhrase}</Txt>
              <Field label="Frase de confirmación" value={phrase} onChangeText={setPhrase} autoCapitalize="characters" placeholder={p.confirmPhrase} />
              <Button title="Eliminar todo definitivamente" variant="danger" busy={del.busy} disabled={phrase.trim().toUpperCase() !== p.confirmPhrase} onPress={del.submit} />
              <Button title="Cancelar" variant="secondary" onPress={() => { setOpen(false); setPhrase(""); }} />
              {del.error && <Notice tone="err">{del.error}</Notice>}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
