import React, { useState } from "react";
import { Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { MonthlyData } from "../../api/types";
import { Button, Card, Chip, Empty, ErrorBox, Heading, KV, Loading, Notice, RowLink, Screen, Txt, SwitchRow } from "../../components/v1/ui";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { saveAndShare } from "../../utils/files";
import { formatSoles } from "../../utils/money";
import { MultiChoice } from "../e4/shared";

const MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const KIND_LABEL: Record<string, string> = { income: "Ingreso", expense: "Gasto", transfer: "Transferencia", opening: "Saldo inicial", adjustment: "Ajuste", reversal: "Reversión" };
const monthTitle = (m: string) => `${MES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const shift = (m: string, d: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

/** Cifras del resumen: las mismas para la vista viva y para una versión guardada. */
export function ReportBody({ d }: { d: MonthlyData }) {
  const r = d.results;
  return (
    <>
      <Heading>Cuentas</Heading>
      <Card outlined>
        {d.accounts.length === 0 && <Txt size={13} muted>Sin cuentas.</Txt>}
        {d.accounts.map((a) => <KV key={a.id} label={a.name} value={`${formatSoles(a.opening)} → ${formatSoles(a.closing)}`} />)}
      </Card>

      <Heading>{d.flow.label}</Heading>
      <Txt size={12} muted>{d.flow.note}</Txt>
      <Card>
        <KV label="Saldo inicial" value={formatSoles(d.flow.opening)} strong />
        {d.flow.lines.map((l) => <KV key={l.type} label={l.label} value={`+ ${formatSoles(l.in)}   − ${formatSoles(l.out)}`} />)}
        <KV label="Entró en total" value={formatSoles(d.flow.totalIn)} />
        <KV label="Salió en total" value={formatSoles(d.flow.totalOut)} />
        <KV label="Saldo final" value={formatSoles(d.flow.closing)} strong />
        {!d.flow.reconciles && <Notice tone="warn">El flujo no cuadra con los saldos: revisa los movimientos de este mes.</Notice>}
      </Card>

      <Heading>{r.label}</Heading>
      <Txt size={12} muted>{r.note}</Txt>
      <Card>
        <KV label="Ingresos ganados" value={formatSoles(r.income.total)} strong />
        {r.income.byCategory.map((c) => <KV key={c.name} label={`${c.name} (${c.percent} %)`} value={formatSoles(c.total)} />)}
        <KV label="Gastos de consumo" value={formatSoles(r.consumption.total)} strong />
        {r.consumption.byCategory.map((c) => <KV key={c.name} label={`${c.name} (${c.percent} %)`} value={formatSoles(c.total)} />)}
        <KV label="Costos financieros" value={formatSoles(r.financialCosts.total)} strong />
        {([["Interés de préstamos", r.financialCosts.loanInterest], ["Mora de préstamos", r.financialCosts.loanLateFees], ["Interés bancario", r.financialCosts.bankInterest], ["Seguros bancarios", r.financialCosts.bankInsurance], ["Comisiones bancarias", r.financialCosts.bankFees]] as const)
          .filter(([, v]) => v !== "0.00").map(([k, v]) => <KV key={k} label={k} value={formatSoles(v)} />)}
        {r.financialIncome !== "0.00" && <KV label="Ingresos financieros" value={formatSoles(r.financialIncome)} strong />}
        <KV label="Servicios compartidos: costo neto" value={formatSoles(r.sharedServices.netCost)} strong />
        <KV label="Pagado a proveedores" value={formatSoles(r.sharedServices.paidToSuppliers)} />
        <KV label="Cobrado a participantes" value={formatSoles(r.sharedServices.collected)} />
        {r.sharedServices.refunds !== "0.00" && <KV label="Devoluciones" value={formatSoles(r.sharedServices.refunds)} />}
        <KV label="Resultado del mes" value={formatSoles(r.net)} strong />
      </Card>

      <Heading>{d.other.label}</Heading>
      <Card outlined>
        <KV label="Transferencias propias (entran / salen)" value={`${formatSoles(d.other.transfers.in)} / ${formatSoles(d.other.transfers.out)}`} />
        <KV label="Pagos de tarjeta de crédito" value={formatSoles(d.other.cardPayments)} />
        <KV label="Capital de préstamos (entra / sale)" value={`${formatSoles(d.other.loans.capitalIn)} / ${formatSoles(d.other.loans.capitalOut)}`} />
        <KV label="Ajustes de saldo" value={formatSoles(d.other.adjustments)} />
        {(d.other.reversals.reversed > 0 || d.other.reversals.reversalEntries > 0) && <KV label="Revertidos (no suman)" value={`${d.other.reversals.reversed} + ${d.other.reversals.reversalEntries} reversiones`} />}
      </Card>

      {d.notes.map((n, i) => <Notice key={i} tone="info">{n}</Notice>)}

      {d.operations && (
        <>
          <Heading>Movimientos</Heading>
          {d.operations.map((o, i) => (
            <Card key={i} outlined>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Txt size={13} bold>{o.description || (KIND_LABEL[o.kind] ?? o.kind)}{o.status === "reversed" ? " (revertido)" : ""}</Txt><Txt size={11} muted>{humanDate(o.date)}{o.time ? ` · ${o.time}` : ""} · {o.account}{o.category ? ` · ${o.category}` : ""}</Txt></View>
                <Txt bold size={13}>{formatSoles(o.amount)}</Txt>
              </View>
            </Card>
          ))}
          {d.operationsTruncated && <Txt size={12} muted>Se muestran los primeros 2000 movimientos.</Txt>}
        </>
      )}
    </>
  );
}

// ───────────────────────── Resumen mensual ─────────────────────────

export function MonthlyReportScreen() {
  const router = useRouter();
  const current = todayLocalIso().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [detail, setDetail] = useState(false);
  const accounts = useAsync(() => api.accounts(), []);
  const rep = useAsync(() => api.monthly({ month, accountIds, detail }), [month, accountIds.join(","), detail]);
  useFocusReload(rep.reload);
  const [msg, setMsg] = useState<{ tone: "ok" | "info" | "err"; text: string } | null>(null);

  const save = useSubmit(async () => {
    const s = await api.saveMonthly({ month, accountIds, detail });
    setMsg(s.unchanged ? { tone: "info", text: `No hubo cambios desde la versión ${s.version}: sigue siendo la última guardada.` } : { tone: "ok", text: `Versión ${s.version} guardada${s.previousVersion ? ` (la ${s.previousVersion} se conserva)` : ""}.` });
    await rep.reload();
  });
  const pdf = useSubmit(async () => {
    const f = await api.monthlyPdf({ month, accountIds, detail });
    await saveAndShare(f.bytes, f.filename ?? `resumen-${month}.pdf`, "application/pdf");
  });

  const d = rep.data;
  return (
    <Screen title="Resumen mensual" subtitle={monthTitle(month)}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Mes anterior" variant="secondary" icon="chevron-back" onPress={() => { setMonth(shift(month, -1)); setMsg(null); }} /></View>
        <View style={{ flex: 1 }}><Button title="Mes siguiente" variant="secondary" icon="chevron-forward" disabled={month >= current} onPress={() => { setMonth(shift(month, 1)); setMsg(null); }} /></View>
      </View>
      <Card>
        <MultiChoice label="Cuentas (ninguna = todas)" options={(accounts.data ?? []).map((a) => ({ id: a.id, label: a.name }))} value={accountIds} onChange={(v) => { setAccountIds(v); setMsg(null); }} />
        <SwitchRow label="Incluir el detalle de movimientos" value={detail} onValueChange={setDetail} />
      </Card>

      {rep.loading && !d ? <Loading /> : rep.error || !d ? <ErrorBox message={rep.error ?? "No se pudo cargar el resumen."} onRetry={rep.reload} /> : (
        <>
          <Card>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Chip status="partial" label="Vista viva" /><Txt size={12} muted style={{ flex: 1, flexShrink: 1 }}>Se recalcula con tus datos actuales</Txt></View>
            {d.differsFromLatestSaved === true && <Notice tone="warn">Cambió desde la última versión guardada (por ejemplo, por una corrección posterior). Puedes guardar una nueva versión.</Notice>}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Guardar versión" icon="save-outline" busy={save.busy} onPress={save.submit} /></View>
              <View style={{ flex: 1 }}><Button title="PDF" variant="secondary" icon="document-outline" busy={pdf.busy} onPress={pdf.submit} /></View>
            </View>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            {[save.error, pdf.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}
          </Card>

          {d.savedVersions.length > 0 && (
            <>
              <Heading>Versiones guardadas</Heading>
              {d.savedVersions.map((s) => (
                <RowLink key={s.id} onPress={() => router.push(`/reports/snapshot/${s.id}` as never)}>
                  <View style={{ flex: 1 }}><Txt bold>Versión {s.version}</Txt><Txt size={12} muted>Guardada el {humanDate(s.generatedAt.slice(0, 10))}</Txt></View>
                </RowLink>
              ))}
            </>
          )}
          {d.counts.movements === 0 ? <Empty icon="document-text-outline" title="Sin movimientos" text="No hay movimientos en este mes con los filtros elegidos." /> : null}
          <ReportBody d={d} />
        </>
      )}
    </Screen>
  );
}

// ───────────────────────── Una versión guardada ─────────────────────────

export function SnapshotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snap = useAsync(() => api.snapshot(id), [id]);
  const pdf = useSubmit(async () => {
    const f = await api.snapshotPdf(id);
    await saveAndShare(f.bytes, f.filename ?? "resumen.pdf", "application/pdf");
  });
  if (snap.loading && !snap.data) return <Screen title="Versión guardada"><Loading /></Screen>;
  if (snap.error || !snap.data) return <Screen title="Versión guardada"><ErrorBox message={snap.error ?? errorMessage({})} onRetry={snap.reload} /></Screen>;
  const s = snap.data;
  return (
    <Screen title={`Versión ${s.version}`} subtitle={monthTitle(s.period)}>
      <Card outlined>
        <KV label="Guardada el" value={humanDate(s.generatedAt.slice(0, 10))} />
        <KV label="Reglas de cálculo" value={s.rulesVersion} />
        <KV label="Cuentas" value={s.data.filters.accounts.length ? s.data.filters.accounts.join(", ") : "Todas"} />
        <KV label="Detalle" value={s.data.filters.detail ? "Con movimientos" : "Solo resumen"} />
        <Txt size={12} muted>Es una instantánea: no cambia aunque corrijas movimientos después.</Txt>
        <Button title="Descargar PDF" variant="secondary" icon="document-outline" busy={pdf.busy} onPress={pdf.submit} />
        {pdf.error && <Notice tone="err">{pdf.error}</Notice>}
      </Card>
      <ReportBody d={s.data} />
    </Screen>
  );
}
