import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { api, errorMessage } from "../../api/client";
import type { MonthlyData } from "../../api/types";
import BottomSheet from "../../components/common/BottomSheet";
import { Button, Card, Chip, Empty, ErrorBox, Heading, KV, Loading, Notice, RowLink, Screen, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate, todayLocalIso } from "../../utils/dates";
import { saveAndShare } from "../../utils/files";
import { cmpMoney, formatSoles } from "../../utils/money";
import { MultiChoice } from "../e4/shared";

const MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const KIND_LABEL: Record<string, string> = { income: "Ingreso", expense: "Gasto", transfer: "Transferencia", opening: "Saldo inicial", adjustment: "Ajuste", reversal: "Reversión" };
const LEGACY_REV_RE = /^Reversión de [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monthTitle = (m: string) => `${MES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const shift = (m: string, d: number) => {
  const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const isNonZero = (v: string | null | undefined) => !!v && cmpMoney(v, "0.00") !== 0;

/** Cuerpo del resumen mensual: visual, claro y completo (usado tanto en la vista viva como en versiones guardadas). */
export function ReportBody({
  d,
  onRequestMovements,
  loadingMovements,
}: {
  d: MonthlyData;
  onRequestMovements?: () => void;
  loadingMovements?: boolean;
}) {
  const { colors } = useAppTheme();
  const [showFlow, setShowFlow] = useState(false);
  const [showOps, setShowOps] = useState(false);

  const r = d.results;
  const incNum = Math.max(0, Number(r.income.total) || 0);
  const expNum = Math.max(0, Number(r.consumption.total) || 0);
  const netCmp = cmpMoney(r.net, "0.00");
  const savingsPct = incNum > 0 ? Math.round(((incNum - expNum) / incNum) * 100) : null;

  const palette = useMemo(
    () => [colors.primary, colors.incomeStrong, colors.warningStrong, colors.sections.services.ink, colors.muted],
    [colors],
  );

  // Top 4 categorías + Otros para la dona SVG.
  const slices = useMemo(() => {
    const valid = [...r.consumption.byCategory]
      .map((c) => ({ name: c.name, val: Math.max(0, Number(c.total) || 0) }))
      .filter((c) => c.val > 0)
      .sort((a, b) => b.val - a.val);
    const totalSum = valid.reduce((acc, x) => acc + x.val, 0);
    if (totalSum <= 0) return [];
    const top = valid.slice(0, 4);
    const rest = valid.slice(4);
    const out = top.map((c, idx) => ({
      label: c.name,
      total: c.val,
      percent: Math.round((c.val / totalSum) * 100),
      color: palette[idx % palette.length]!,
    }));
    if (rest.length > 0) {
      const restVal = rest.reduce((acc, x) => acc + x.val, 0);
      out.push({
        label: "Otros",
        total: restVal,
        percent: Math.max(1, Math.round((restVal / totalSum) * 100)),
        color: palette[4]!,
      });
    }
    return out;
  }, [r.consumption.byCategory, palette]);

  const totalSlices = slices.reduce((acc, s) => acc + s.total, 0);
  const donutSize = 136;
  const radius = 51;
  const strokeW = 15;
  const circ = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 4 : 0;
  let accLen = 0;
  const segments = slices.map((s) => {
    const rawLen = totalSlices > 0 ? (s.total / totalSlices) * circ : 0;
    const len = Math.max(3, rawLen - gap);
    const offset = -accLen;
    accLen += rawLen;
    return { ...s, len, offset };
  });

  const hasShared = isNonZero(r.sharedServices.paidToSuppliers) || isNonZero(r.sharedServices.collected) || isNonZero(r.sharedServices.refunds);
  const finCostRows = ([
    ["Interés de préstamos", r.financialCosts.loanInterest],
    ["Mora de préstamos", r.financialCosts.loanLateFees],
    ["Interés bancario", r.financialCosts.bankInterest],
    ["Seguros bancarios", r.financialCosts.bankInsurance],
    ["Comisiones bancarias", r.financialCosts.bankFees],
  ] as const).filter(([, v]) => isNonZero(v));
  const hasFinancial = isNonZero(r.financialCosts.total) || isNonZero(r.financialIncome);

  const otherItems: Array<[string, string]> = [];
  if (isNonZero(d.other.transfers.in) || isNonZero(d.other.transfers.out)) {
    otherItems.push(["Transferencias propias", `${formatSoles(d.other.transfers.in)} / ${formatSoles(d.other.transfers.out)}`]);
  }
  if (isNonZero(d.other.cardPayments)) otherItems.push(["Pagos de tarjeta de crédito", formatSoles(d.other.cardPayments)]);
  if (isNonZero(d.other.loans.capitalIn) || isNonZero(d.other.loans.capitalOut)) {
    otherItems.push(["Capital de préstamos (entra / sale)", `${formatSoles(d.other.loans.capitalIn)} / ${formatSoles(d.other.loans.capitalOut)}`]);
  }
  if (isNonZero(d.other.adjustments)) otherItems.push(["Ajustes de saldo", formatSoles(d.other.adjustments)]);
  if (d.other.reversals.reversed > 0 || d.other.reversals.reversalEntries > 0) {
    otherItems.push(["Movimientos revertidos (no suman)", `${d.other.reversals.reversed}`]);
  }

  const toggleOps = () => {
    if (!showOps && !d.operations && onRequestMovements) {
      onRequestMovements();
    }
    setShowOps((v) => !v);
  };

  return (
    <>
      {/* 1. Resumen ejecutivo del mes */}
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {netCmp >= 0 ? "Te quedó libre este mes" : "Gastaste más de lo ingresado"}
          </Text>
          {savingsPct !== null && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: savingsPct >= 0 ? `${colors.incomeStrong}18` : `${colors.expenseStrong}18` }}>
              <Text style={{ color: savingsPct >= 0 ? colors.incomeStrong : colors.expenseStrong, fontSize: 11.5, fontFamily: "AsapBold" }}>
                {savingsPct >= 0 ? `Ahorro ${savingsPct}%` : `${savingsPct}%`}
              </Text>
            </View>
          )}
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: netCmp > 0 ? colors.incomeStrong : netCmp < 0 ? colors.expenseStrong : colors.text,
            fontSize: 32,
            fontFamily: "AsapBold",
            fontVariant: ["tabular-nums"],
          }}
        >
          {netCmp > 0 ? `+${formatSoles(r.net)}` : formatSoles(r.net)}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="arrow-down-circle-outline" size={14} color={colors.incomeStrong} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>Ingresos</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.incomeStrong, fontSize: 17, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
              {formatSoles(r.income.total)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="arrow-up-circle-outline" size={14} color={colors.expenseStrong} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>Gastos</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.expenseStrong, fontSize: 17, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
              {formatSoles(r.consumption.total)}
            </Text>
          </View>
        </View>
        <Txt size={11.5} muted>
          {d.counts.movements} {d.counts.movements === 1 ? "movimiento" : "movimientos"} en el mes
          {d.filters.accounts.length > 0 ? ` · Filtro: ${d.filters.accounts.join(", ")}` : ""}
        </Txt>
      </Card>

      {/* 2. Gráfico protagonista de gastos por categoría (sin tarjeta) */}
      <View style={{ paddingVertical: 4, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>En qué gastaste</Text>
        {slices.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
            <Ionicons name="pie-chart-outline" size={26} color={colors.muted} />
            <Txt size={13} muted style={{ flex: 1 }}>No registraste gastos en este mes.</Txt>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <View style={{ width: donutSize, height: donutSize, alignItems: "center", justifyContent: "center" }}>
                <Svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                  <Circle cx={donutSize / 2} cy={donutSize / 2} r={radius} stroke={colors.border} strokeWidth={strokeW} fill="none" />
                  {segments.map((seg) => (
                    <Circle
                      key={seg.label}
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      stroke={seg.color}
                      strokeWidth={strokeW}
                      strokeDasharray={`${seg.len} ${circ - seg.len}`}
                      strokeDashoffset={seg.offset}
                      rotation={-90}
                      origin={`${donutSize / 2}, ${donutSize / 2}`}
                      fill="none"
                    />
                  ))}
                </Svg>
                <View style={{ position: "absolute", alignItems: "center", paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: "AsapSemiBold", textTransform: "uppercase" }}>Total</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                    {formatSoles(r.consumption.total)}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                {slices.map((s) => (
                  <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: s.color }} />
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "AsapSemiBold" }}>{s.label}</Text>
                    <Text style={{ color: colors.text, fontSize: 12.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{s.percent}%</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Desglose completo con barras por categoría */}
            <View style={{ gap: 10, marginTop: 4 }}>
              {r.consumption.byCategory.map((c, idx) => (
                <CategoryBarRow
                  key={c.name}
                  name={c.name}
                  countLabel={`${c.count} ${c.count === 1 ? "gasto" : "gastos"}`}
                  percent={c.percent}
                  amount={formatSoles(c.total)}
                  color={palette[idx < 4 ? idx : 4]!}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* 3. Desglose de ingresos (solo si hubo ingresos) */}
      {r.income.byCategory.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>De dónde vinieron tus ingresos</Text>
          <Card style={{ gap: 10 }}>
            {r.income.byCategory.map((c) => (
              <CategoryBarRow
                key={c.name}
                name={c.name}
                countLabel={`${c.count} ${c.count === 1 ? "ingreso" : "ingresos"}`}
                percent={c.percent}
                amount={formatSoles(c.total)}
                color={colors.incomeStrong}
              />
            ))}
          </Card>
        </View>
      )}

      {/* 4. Cómo cambiaron tus cuentas */}
      {d.accounts.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Cómo cambiaron tus cuentas</Text>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {d.accounts.map((a, i) => {
              const chgCmp = cmpMoney(a.change, "0.00");
              const chgColor = chgCmp > 0 ? colors.incomeStrong : chgCmp < 0 ? colors.expenseStrong : colors.textSecondary;
              return (
                <View
                  key={a.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{a.name}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", fontVariant: ["tabular-nums"] }}>
                      {formatSoles(a.opening)} → {formatSoles(a.closing)}
                    </Text>
                  </View>
                  <Text style={{ color: chgColor, fontSize: 13.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                    {chgCmp > 0 ? `+${formatSoles(a.change)}` : chgCmp === 0 ? "Sin cambio" : formatSoles(a.change)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {/* 5. Servicios compartidos (solo si hubo actividad) */}
      {hasShared && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Servicios compartidos</Text>
          <Card>
            <KV label="Pagado a proveedores" value={formatSoles(r.sharedServices.paidToSuppliers)} />
            <KV label="Cobrado a participantes" value={formatSoles(r.sharedServices.collected)} />
            {isNonZero(r.sharedServices.refunds) && <KV label="Devoluciones" value={formatSoles(r.sharedServices.refunds)} />}
            <KV label="Tu costo real del mes" value={formatSoles(r.sharedServices.netCost)} strong />
          </Card>
        </View>
      )}

      {/* 6. Intereses y costos bancarios (solo si hay) */}
      {hasFinancial && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Intereses y costos bancarios</Text>
          <Card>
            {isNonZero(r.financialIncome) && <KV label="Intereses ganados" value={formatSoles(r.financialIncome)} strong />}
            {finCostRows.map(([label, val]) => <KV key={label} label={label} value={formatSoles(val)} />)}
            {isNonZero(r.financialCosts.total) && <KV label="Total de costos financieros" value={formatSoles(r.financialCosts.total)} strong />}
          </Card>
        </View>
      )}

      {!d.flow.reconciles && (
        <Notice tone="warn">El flujo no cuadra con los saldos: revisa los movimientos de este mes.</Notice>
      )}

      {/* 7. Desplegable: detalle completo de entradas, salidas y otros movimientos */}
      <AccordionHeader
        icon="swap-vertical-outline"
        title="Entradas, salidas y otros movimientos"
        subtitle="Transferencias, pagos de tarjeta, préstamos y cuadre"
        open={showFlow}
        onPress={() => setShowFlow((v) => !v)}
      />
      {showFlow && (
        <View style={{ gap: 10 }}>
          <Card outlined>
            <Txt bold size={13} style={{ marginBottom: 4 }}>Flujo total de dinero</Txt>
            <KV label="Saldo al inicio del mes" value={formatSoles(d.flow.opening)} strong />
            <KV label="Entró en total" value={formatSoles(d.flow.totalIn)} />
            <KV label="Salió en total" value={formatSoles(d.flow.totalOut)} />
            <KV label="Saldo al cierre" value={formatSoles(d.flow.closing)} strong />
            {d.flow.lines.length > 0 && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                {d.flow.lines.map((l) => (
                  <KV key={l.type} label={l.label} value={`+${formatSoles(l.in)} / −${formatSoles(l.out)}`} />
                ))}
              </View>
            )}
          </Card>

          {otherItems.length > 0 && (
            <Card outlined>
              <Txt bold size={13} style={{ marginBottom: 4 }}>Movimientos que no son ingreso ni gasto</Txt>
              {otherItems.map(([label, val]) => <KV key={label} label={label} value={val} />)}
            </Card>
          )}

          {d.notes.map((n, i) => <Notice key={i} tone="info">{n}</Notice>)}
        </View>
      )}

      {/* 8. Desplegable: lista completa de movimientos del mes */}
      {(d.counts.movements > 0 || (d.operations && d.operations.length > 0)) && (
        <>
          <AccordionHeader
            icon="list-outline"
            title="Movimientos del mes"
            subtitle={showOps ? "Toca para ocultar" : `Ver los ${d.counts.movements} movimientos`}
            open={showOps}
            onPress={toggleOps}
          />
          {showOps && (
            loadingMovements && !d.operations ? (
              <Loading />
            ) : !d.operations || d.operations.length === 0 ? (
              <Card outlined><Txt size={13} muted>No hay movimientos para mostrar.</Txt></Card>
            ) : (
              <Card style={{ paddingVertical: 4, gap: 0 }}>
                {d.operations.map((o, i) => {
                  const rawDesc = o.description?.trim() ?? "";
                  const title = !rawDesc ? (KIND_LABEL[o.kind] ?? o.kind) : LEGACY_REV_RE.test(rawDesc) ? "Reversión de movimiento" : rawDesc;
                  const amtCmp = cmpMoney(o.amount, "0.00");
                  const amtColor = o.kind === "transfer" ? colors.primary : amtCmp > 0 ? colors.incomeStrong : amtCmp < 0 ? colors.expenseStrong : colors.text;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 10,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        opacity: o.status === "reversed" ? 0.55 : 1,
                      }}
                    >
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>
                          {title}{o.status === "reversed" ? " (revertido)" : ""}
                        </Text>
                        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>
                          {humanDate(o.date)}{o.time ? ` · ${o.time}` : ""} · {o.account}{o.category ? ` · ${o.category}` : ""}
                        </Text>
                      </View>
                      <Text style={{ color: amtColor, fontSize: 13.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                        {formatSoles(o.amount)}
                      </Text>
                    </View>
                  );
                })}
                {d.operationsTruncated && <Txt size={12} muted style={{ paddingVertical: 8 }}>Se muestran los primeros 2000 movimientos.</Txt>}
              </Card>
            )
          )}
        </>
      )}
    </>
  );
}

function CategoryBarRow({
  name,
  countLabel,
  percent,
  amount,
  color,
}: {
  name: string;
  countLabel: string;
  percent: number;
  amount: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  const pct = Math.max(2, Math.min(100, Math.round(percent)));
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapSemiBold" }}>{name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Asap" }}>{countLabel} · {Math.round(percent)}%</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{amount}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

function AccordionHeader({
  icon,
  title,
  subtitle,
  open,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  open: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>{subtitle}</Text>
      </View>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={17} color={colors.muted} />
    </TouchableOpacity>
  );
}

// ───────────────────────── Resumen mensual ─────────────────────────

export function MonthlyReportScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const current = todayLocalIso().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [detail, setDetail] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const accounts = useAsync(() => api.accounts(), []);
  const rep = useAsync(() => api.monthly({ month, accountIds, detail }), [month, accountIds.join(","), detail]);
  useFocusReload(rep.reload);
  const [msg, setMsg] = useState<{ tone: "ok" | "info" | "err"; text: string } | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([rep.reload(), accounts.reload()]); } finally { setRefreshing(false); }
  };

  const save = useSubmit(async () => {
    const s = await api.saveMonthly({ month, accountIds, detail });
    setMsg(s.unchanged
      ? { tone: "info", text: `Sin cambios desde la versión ${s.version}: sigue siendo la última guardada.` }
      : { tone: "ok", text: `Versión ${s.version} guardada${s.previousVersion ? ` (la ${s.previousVersion} se conserva)` : ""}.` });
    await rep.reload();
  });
  const pdf = useSubmit(async () => {
    const f = await api.monthlyPdf({ month, accountIds, detail });
    await saveAndShare(f.bytes, f.filename ?? `resumen-${month}.pdf`, "application/pdf");
  });

  const d = rep.data;
  const canNext = month < current;

  return (
    <Screen title="Resumen del mes" refreshing={refreshing} onRefresh={onRefresh}>
      {/* Selector de mes compacto en una sola fila */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 6,
          paddingVertical: 6,
        }}
      >
        <TouchableOpacity
          onPress={() => { setMonth(shift(month, -1)); setMsg(null); setDetail(false); }}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{monthTitle(month)}</Text>
        <TouchableOpacity
          onPress={() => { if (canNext) { setMonth(shift(month, 1)); setMsg(null); setDetail(false); } }}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: canNext ? 1 : 0.3 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Acciones rápidas en una sola línea: Filtrar, PDF, Guardar */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ActionPill
          icon="funnel-outline"
          label={accountIds.length > 0 ? `Cuentas (${accountIds.length})` : "Filtrar"}
          active={accountIds.length > 0}
          onPress={() => setFilterSheet(true)}
        />
        <ActionPill
          icon="document-outline"
          label={pdf.busy ? "Generando…" : "PDF"}
          disabled={pdf.busy || !d}
          onPress={pdf.submit}
        />
        <ActionPill
          icon="bookmark-outline"
          label={save.busy ? "Guardando…" : "Guardar"}
          disabled={save.busy || !d}
          onPress={save.submit}
        />
      </View>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {[save.error, pdf.error].filter(Boolean).map((e, i) => <Notice key={i} tone="err">{e}</Notice>)}

      {rep.loading && !d ? <Loading /> : rep.error || !d ? <ErrorBox message={rep.error ?? "No se pudo cargar el resumen."} onRetry={rep.reload} /> : (
        <>
          {d.differsFromLatestSaved === true && (
            <Notice tone="warn">Este mes cambió desde tu última versión guardada. Toca «Guardar» si quieres actualizar una copia.</Notice>
          )}

          {d.counts.movements === 0 ? (
            <Empty icon="document-text-outline" title="Sin movimientos" text="No hay movimientos en este mes con los filtros elegidos." />
          ) : (
            <ReportBody d={d} onRequestMovements={() => setDetail(true)} loadingMovements={rep.loading && detail} />
          )}

          {d.savedVersions.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Heading>Versiones guardadas</Heading>
              {d.savedVersions.map((s) => (
                <RowLink key={s.id} onPress={() => router.push(`/reports/snapshot/${s.id}` as never)}>
                  <View style={{ flex: 1 }}>
                    <Txt bold>Versión {s.version}</Txt>
                    <Txt size={12} muted>Guardada el {humanDate(s.generatedAt.slice(0, 10))}</Txt>
                  </View>
                </RowLink>
              ))}
            </View>
          )}
        </>
      )}

      {/* Hoja de filtro de cuentas */}
      <BottomSheet visible={filterSheet} onClose={() => setFilterSheet(false)} title="Filtrar por cuentas" maxHeight={0.7}>
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <MultiChoice
            label="Elige una o más cuentas (ninguna = todas)"
            options={(accounts.data ?? []).map((a) => ({ id: a.id, label: a.name }))}
            value={accountIds}
            onChange={(v) => { setAccountIds(v); setMsg(null); }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {accountIds.length > 0 && (
              <View style={{ flex: 1 }}>
                <Button title="Ver todas" variant="secondary" onPress={() => { setAccountIds([]); setMsg(null); setFilterSheet(false); }} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button title="Aplicar" onPress={() => setFilterSheet(false)} />
            </View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function ActionPill({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 38,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: active ? `${colors.primary}18` : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={15} color={active ? colors.primary : colors.text} />
      <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.text, fontSize: 12.5, fontFamily: "AsapSemiBold" }}>{label}</Text>
    </TouchableOpacity>
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <Chip status="converted" label="Copia fija" />
          <Txt size={12} muted>Guardada el {humanDate(s.generatedAt.slice(0, 10))}</Txt>
        </View>
        <KV label="Cuentas" value={s.data.filters.accounts.length ? s.data.filters.accounts.join(", ") : "Todas"} />
        <Txt size={12} muted>Es una instantánea: no cambia aunque corrijas movimientos después.</Txt>
        <Button title="Descargar PDF" variant="secondary" icon="document-outline" busy={pdf.busy} onPress={pdf.submit} />
        {pdf.error && <Notice tone="err">{pdf.error}</Notice>}
      </Card>
      <ReportBody d={s.data} />
    </Screen>
  );
}
