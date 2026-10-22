import React from "react";
import { Platform, Share, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { Button, Card, Chip, ErrorBox, Heading, KV, Loading, Money, Screen, Txt } from "../../components/v1/ui";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, humanRange } from "../../utils/dates";
import { cmpMoney } from "../../utils/money";

async function shareText(text: string) {
  if (Platform.OS === "web") {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
    await nav?.clipboard?.writeText(text);
    return;
  }
  await Share.share({ message: text }); // el usuario elige a dónde enviarlo; EVA no envía nada por su cuenta
}

export default function ContactDetailScreen({ contactId }: { contactId: string }) {
  const router = useRouter();
  const st = useAsync(() => api.contactStatement(contactId), [contactId]);
  const credit = useAsync(() => api.contactCredit(contactId), [contactId]);
  const reload = React.useCallback(() => { void st.reload(); void credit.reload(); }, [st.reload, credit.reload]);
  useFocusReload(reload);
  const [copied, setCopied] = React.useState(false);

  if (st.loading && !st.data) return <Screen title="Contacto"><Loading /></Screen>;
  if (st.error || !st.data) return <Screen title="Contacto"><ErrorBox message={st.error ?? "No se encontró el contacto."} onRetry={st.reload} /></Screen>;
  const s = st.data;
  const owes = cmpMoney(s.totals.pending, "0.00") > 0;

  return (
    <Screen title={s.contact.name} footer={<Button title="Registrar cobro" icon="cash-outline" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId } })} />}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }}><Txt muted size={13}>Pendiente</Txt><Money value={s.totals.pending} size={24} tone={owes ? "expense" : undefined} />{cmpMoney(s.totals.overdue, "0.00") > 0 && <Txt size={12} muted>S/ {s.totals.overdue} vencido</Txt>}</Card>
        <Card style={{ flex: 1 }}><Txt muted size={13}>Crédito</Txt><Money value={credit.data?.total ?? "0.00"} size={24} tone="income" />{cmpMoney(s.totals.creditReserved, "0.00") > 0 && <Txt size={12} muted>S/ {s.totals.creditReserved} reservado</Txt>}</Card>
      </View>

      {s.services.length === 0 && <Card><Txt muted>Sin servicios ni cargos todavía.</Txt></Card>}
      {s.services.map((svc) => (
        <View key={svc.subscriptionId} style={{ gap: 8 }}>
          <Heading>{svc.name}</Heading>
          <Card outlined>
            {svc.seats.map((seat) => <KV key={seat.seatId} label={`${seat.label} · cuota S/ ${seat.quota}`} value={cmpMoney(seat.pending, "0.00") > 0 ? `debe S/ ${seat.pending}` : "al día"} />)}
          </Card>
          {svc.charges.map((c) => (
            <Card key={c.obligationId} outlined>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt bold size={14}>{c.seatLabel} · {humanRange(c.cycle.start, c.cycle.end)}</Txt>
                  <Txt size={12} muted>Vence el {humanDate(c.dueDate)} · cargo S/ {c.net}{c.applied !== "0.00" ? ` · pagado S/ ${c.applied}` : ""}</Txt>
                </View>
                {c.overdue ? <Chip status="overdue" /> : <Chip status={c.paymentStatus} />}
                <Money value={c.pending} size={14} />
              </View>
            </Card>
          ))}
        </View>
      ))}

      {(credit.data?.reservations ?? []).length > 0 && (
        <>
          <Heading>Crédito reservado</Heading>
          <Card outlined>
            {credit.data!.reservations.map((r) => <KV key={r.id} label={`Para ${r.subscriptionName}`} value={`S/ ${r.amount}`} />)}
          </Card>
        </>
      )}

      <Button title={copied ? "Texto listo para pegar" : "Compartir estado de cuenta"} variant="secondary" icon="share-outline" onPress={async () => { await shareText(s.shareText); setCopied(true); setTimeout(() => setCopied(false), 2500); }} />
      <Txt size={12} muted>Prepara un texto discreto para ti: EVA no envía mensajes por su cuenta.</Txt>
    </Screen>
  );
}
