import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import { Button, Card, Chip, Empty, ErrorBox, Field, Heading, Loading, Money, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { cmpMoney } from "../../utils/money";

export default function ContactsScreen() {
  const router = useRouter();
  const contacts = useAsync(() => api.contacts(), []);
  useFocusReload(contacts.reload);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setError(null);
    try { await api.createContact({ name: name.trim() }); setName(""); await contacts.reload(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen title="Contactos">
      <Card>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><Field label="Nuevo contacto" value={name} onChangeText={setName} placeholder="Nombre" autoCapitalize="words" onSubmitEditing={add} /></View>
          <View style={{ marginBottom: 16 }}><Button title="Agregar" onPress={add} busy={busy} disabled={!name.trim()} /></View>
        </View>
        <Txt size={12} muted>Los contactos no necesitan cuenta de EVA: tú registras sus cuotas y pagos.</Txt>
      </Card>
      {error && <Notice tone="err">{error}</Notice>}

      <Heading>Personas</Heading>
      {contacts.loading && !contacts.data ? <Loading /> : contacts.error ? <ErrorBox message={contacts.error} onRetry={contacts.reload} /> : (contacts.data ?? []).length === 0 ? (
        <Empty icon="people-outline" title="Sin contactos todavía" text="Agrega a quien comparte tus servicios." />
      ) : (contacts.data ?? []).filter((c) => c.status === "active").map((c) => (
        <RowLink key={c.id} onPress={() => router.push(`/contact/${c.id}`)}>
          <View style={{ flex: 1 }}>
            <Txt bold>{c.name}</Txt>
            <Txt size={12} muted>{c.services} servicio{c.services === 1 ? "" : "s"} · {c.activeSeats} plaza{c.activeSeats === 1 ? "" : "s"}</Txt>
          </View>
          {cmpMoney(c.totals.overdue, "0.00") > 0 && <Chip status="overdue" />}
          {cmpMoney(c.totals.pending, "0.00") > 0 ? <Money value={c.totals.pending} tone="expense" /> : <Chip status="paid" label="Al día" />}
        </RowLink>
      ))}
    </Screen>
  );
}
