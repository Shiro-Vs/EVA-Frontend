import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "../../hooks/useAppTheme";
import { cmpMoney, formatSoles } from "../../utils/money";

const MASK = "S/ ••••";

export interface CategorySliceInput {
  name: string;
  total: string;
  count: number;
  percent: number;
}

interface Props {
  monthLabel: string;
  income: string;
  consumption: string;
  net: string;
  byCategory: CategorySliceInput[];
  hidden: boolean;
  onOpenReports: () => void;
}

interface Slice {
  label: string;
  total: number;
  percent: number;
  color: string;
}

/** Gráfico protagonista del mes en Inicio (directo sobre el fondo, sin tarjeta): pestaña «Categorías» (dona SVG) y «Balance». */
export default function MonthlyChartCard({
  monthLabel,
  income,
  consumption,
  net,
  byCategory,
  hidden,
  onOpenReports,
}: Props) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<"categories" | "balance">("categories");

  const palette = useMemo(
    () => [colors.primary, colors.incomeStrong, colors.warningStrong, colors.sections.services.ink, colors.muted],
    [colors],
  );

  const slices = useMemo<Slice[]>(() => {
    const valid = [...byCategory]
      .map((c) => ({ name: c.name, val: Math.max(0, Number(c.total) || 0) }))
      .filter((c) => c.val > 0)
      .sort((a, b) => b.val - a.val);
    const totalSum = valid.reduce((acc, x) => acc + x.val, 0);
    if (totalSum <= 0) return [];
    const top = valid.slice(0, 4);
    const rest = valid.slice(4);
    const out: Slice[] = top.map((c, idx) => ({
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
  }, [byCategory, palette]);

  const totalSpentNum = slices.reduce((acc, s) => acc + s.total, 0);
  const incNum = Math.max(0, Number(income) || 0);
  const expNum = Math.max(0, Number(consumption) || 0);
  const maxBar = Math.max(incNum, expNum, 1);
  const netCmp = cmpMoney(net, "0.00");
  const savingsPct = incNum > 0 ? Math.round(((incNum - expNum) / incNum) * 100) : null;

  const size = 148;
  const r = 56;
  const strokeW = 16;
  const circ = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 4 : 0;

  let accLen = 0;
  const segments = slices.map((s) => {
    const rawLen = totalSpentNum > 0 ? (s.total / totalSpentNum) * circ : 0;
    const len = Math.max(3, rawLen - gap);
    const offset = -accLen;
    accLen += rawLen;
    return { ...s, len, offset };
  });

  const money = (v: string) => (hidden ? MASK : formatSoles(v));

  return (
    <View style={{ paddingVertical: 4, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <TouchableOpacity onPress={onOpenReports} activeOpacity={0.7} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontFamily: "AsapBold" }}>
            Tu mes · {monthLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 99, padding: 2 }}>
          <TabPill label="Categorías" active={tab === "categories"} onPress={() => setTab("categories")} />
          <TabPill label="Balance" active={tab === "balance"} onPress={() => setTab("balance")} />
        </View>
      </View>

      {tab === "categories" ? (
        slices.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8 }}>
            <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
              <Svg width={84} height={84} viewBox="0 0 84 84">
                <Circle cx={42} cy={42} r={32} stroke={colors.border} strokeWidth={10} fill="none" />
              </Svg>
              <Ionicons name="pie-chart-outline" size={24} color={colors.muted} style={{ position: "absolute" }} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.text, fontSize: 14.5, fontFamily: "AsapBold" }}>Sin gastos este mes</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "Asap", lineHeight: 17 }}>
                Cuando registres gastos verás aquí tu gráfico por categoría.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 2 }}>
            <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
              <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={strokeW} fill="none" />
                {segments.map((seg) => (
                  <Circle
                    key={seg.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={seg.color}
                    strokeWidth={strokeW}
                    strokeDasharray={`${seg.len} ${circ - seg.len}`}
                    strokeDashoffset={seg.offset}
                    rotation={-90}
                    origin={`${size / 2}, ${size / 2}`}
                    fill="none"
                  />
                ))}
              </Svg>
              <View style={{ position: "absolute", alignItems: "center", paddingHorizontal: 14 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10.5, fontFamily: "AsapSemiBold", textTransform: "uppercase", letterSpacing: 0.6 }}>Gastado</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                  {money(consumption)}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, gap: 9 }}>
              {slices.map((s) => (
                <View key={s.label} style={{ gap: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: s.color }} />
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13.5, fontFamily: "AsapSemiBold" }}>
                      {s.label}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                      {s.percent}%
                    </Text>
                  </View>
                  {!hidden && (
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap", marginLeft: 17, fontVariant: ["tabular-nums"] }}>
                      {formatSoles(s.total.toFixed(2))}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )
      ) : (
        <View style={{ gap: 14, paddingVertical: 4 }}>
          <CompareBar label="Ingresos" value={money(income)} ratio={incNum / maxBar} color={colors.incomeStrong} />
          <CompareBar label="Gastos" value={money(consumption)} ratio={expNum / maxBar} color={colors.expenseStrong} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "AsapMedium" }}>
              {netCmp >= 0 ? "Saldo libre del mes" : "Gasto sobre ingresos"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: netCmp >= 0 ? colors.incomeStrong : colors.expenseStrong, fontSize: 16, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                {hidden ? MASK : `${netCmp > 0 ? "+" : ""}${formatSoles(net)}`}
              </Text>
              {savingsPct !== null && !hidden && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: savingsPct >= 0 ? `${colors.incomeStrong}18` : `${colors.expenseStrong}18` }}>
                  <Text style={{ color: savingsPct >= 0 ? colors.incomeStrong : colors.expenseStrong, fontSize: 11.5, fontFamily: "AsapBold" }}>
                    {savingsPct >= 0 ? `Ahorro ${savingsPct}%` : `${savingsPct}%`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 99,
        backgroundColor: active ? colors.primarySurface : "transparent",
      }}
    >
      <Text style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 11.5, fontFamily: active ? "AsapBold" : "AsapMedium" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CompareBar({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: string }) {
  const { colors } = useAppTheme();
  const pct = Math.max(ratio > 0 ? 4 : 0, Math.min(100, Math.round(ratio * 100)));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13.5, fontFamily: "AsapSemiBold" }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{value}</Text>
      </View>
      <View style={{ height: 11, borderRadius: 6, backgroundColor: colors.border, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, borderRadius: 6, backgroundColor: color }} />
      </View>
    </View>
  );
}
