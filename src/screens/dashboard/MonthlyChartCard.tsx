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

/** Gráfico general del mes en Inicio: pestaña «Categorías» (dona SVG) y pestaña «Balance» (Ingresos vs Gastos). */
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
      .map((c) => ({ name: c.name, val: Math.max(0, Number(c.total) || 0), pct: Number(c.percent) || 0 }))
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

  const size = 112;
  const r = 42;
  const strokeW = 13;
  const circ = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 3 : 0;

  let accLen = 0;
  const segments = slices.map((s) => {
    const rawLen = totalSpentNum > 0 ? (s.total / totalSpentNum) * circ : 0;
    const len = Math.max(2, rawLen - gap);
    const offset = -accLen;
    accLen += rawLen;
    return { ...s, len, offset };
  });

  const money = (v: string) => (hidden ? MASK : formatSoles(v));

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>
            Tu mes · {monthLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", backgroundColor: colors.elevated, borderRadius: 99, padding: 2 }}>
          <TabPill label="Categorías" active={tab === "categories"} onPress={() => setTab("categories")} />
          <TabPill label="Balance" active={tab === "balance"} onPress={() => setTab("balance")} />
        </View>
      </View>

      {tab === "categories" ? (
        slices.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 }}>
            <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
              <Svg width={64} height={64} viewBox="0 0 64 64">
                <Circle cx={32} cy={32} r={24} stroke={colors.border} strokeWidth={8} fill="none" />
              </Svg>
              <Ionicons name="pie-chart-outline" size={20} color={colors.muted} style={{ position: "absolute" }} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold" }}>Sin gastos este mes</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                Cuando registres gastos verás aquí en qué se va tu dinero por categoría.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
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
              <View style={{ position: "absolute", alignItems: "center", paddingHorizontal: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 9.5, fontFamily: "AsapMedium", textTransform: "uppercase" }}>Gasto</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                  {money(consumption)}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, gap: 7 }}>
              {slices.map((s) => (
                <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 12.5, fontFamily: "AsapMedium" }}>
                    {s.label}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                    {s.percent}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )
      ) : (
        <View style={{ gap: 10 }}>
          <CompareBar label="Ingresos" value={money(income)} ratio={incNum / maxBar} color={colors.incomeStrong} />
          <CompareBar label="Gastos" value={money(consumption)} ratio={expNum / maxBar} color={colors.expenseStrong} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>
              {netCmp >= 0 ? "Saldo libre del mes" : "Gasto sobre ingresos"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: netCmp >= 0 ? colors.incomeStrong : colors.expenseStrong, fontSize: 14, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                {hidden ? MASK : `${netCmp > 0 ? "+" : ""}${formatSoles(net)}`}
              </Text>
              {savingsPct !== null && !hidden && (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: savingsPct >= 0 ? `${colors.incomeStrong}18` : `${colors.expenseStrong}18` }}>
                  <Text style={{ color: savingsPct >= 0 ? colors.incomeStrong : colors.expenseStrong, fontSize: 11, fontFamily: "AsapBold" }}>
                    {savingsPct >= 0 ? `Ahorro ${savingsPct}%` : `${savingsPct}%`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={onOpenReports}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, paddingTop: 2 }}
      >
        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapSemiBold" }}>Ver resumen completo</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </TouchableOpacity>
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
        paddingHorizontal: 10,
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
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: "AsapMedium" }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 13.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>{value}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}
