import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Budget, Goal } from "../../api/types";
import { Button, Card, Empty, ErrorBox, Heading, Loading, MenuRow, Screen, SeeAll, SummaryTile, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { humanDate } from "../../utils/dates";
import { formatSoles } from "../../utils/money";

const PERIOD: Record<Budget["period"], string> = { weekly: "semanal", monthly: "mensual", yearly: "anual" };

/** Pestaña Planificar: presupuestos, metas y movimientos recurrentes, con lo que requiere atención arriba. */
export default function PlanScreen() {
  const router = useRouter();
  const budgets = useAsync(() => api.budgets(), []);
  const goals = useAsync(() => api.goals(), []);
  const overview = useAsync(() => api.goalsOverview(), []);
  const pending = useAsync(() => api.recurringPending(7), []);
  const reload = useCallback(() => { void budgets.reload(); void goals.reload(); void overview.reload(); void pending.reload(); }, [budgets.reload, goals.reload, overview.reload, pending.reload]);
  useFocusReload(reload);

  const due = pending.data?.due.length ?? 0;
  const bl = (budgets.data ?? []).filter((b) => b.status === "active");
  const gl = (goals.data ?? []).filter((g) => g.status === "active");

  return (
    <Screen title="Planificar" back={false} subtitle="Presupuestos, metas y recurrentes">
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SummaryTile label="Libre para gastar" icon="lock-open-outline" value={overview.data ? formatSoles(overview.data.totals.free) : "…"} tone="income" onPress={() => router.push("/goals/accounts" as never)} />
        <SummaryTile label="Reservado" icon="lock-closed-outline" value={overview.data ? formatSoles(overview.data.totals.reserved) : "…"} onPress={() => router.push("/goals/accounts" as never)} />
      </View>

      <Heading action={<SeeAll onPress={() => router.push("/recurring" as never)} />}>Recurrentes</Heading>
      <MenuRow section="plan" icon="repeat-outline" title="Sueldo, alquiler y otros" text={due > 0 ? `${due} por decidir: confírmalos u omítelos` : "Nada pendiente por ahora"} badge={due > 0 ? due : null} onPress={() => router.push("/recurring" as never)} />

      <Heading action={<SeeAll onPress={() => router.push("/budgets" as never)} />}>Presupuestos</Heading>
      {budgets.loading && !budgets.data ? <Loading /> : budgets.error ? <ErrorBox message={budgets.error} onRetry={budgets.reload} /> : bl.length === 0 ? (
        <Empty icon="speedometer-outline" title="Sin presupuestos" text="Ponle un límite a una categoría o a todo tu gasto del mes." action={<Button title="Crear presupuesto" icon="add" onPress={() => router.push("/budgets/new" as never)} />} />
      ) : bl.slice(0, 4).map((b) => <BudgetCard key={b.id} b={b} onPress={() => router.push(`/budgets/${b.id}` as never)} />)}
      {bl.length > 4 && <Button title={`Ver los ${bl.length} presupuestos`} variant="secondary" onPress={() => router.push("/budgets" as never)} />}

      <Heading action={<SeeAll label="Reservas" onPress={() => router.push("/goals/accounts" as never)} />}>Metas de ahorro</Heading>
      {goals.loading && !goals.data ? <Loading /> : goals.error ? <ErrorBox message={goals.error} onRetry={goals.reload} /> : gl.length === 0 ? (
        <Empty icon="flag-outline" title="Aún no tienes metas" text="Crea una y reserva dinero que ya tienes en tus cuentas: reservar no lo mueve." />
      ) : gl.map((g) => <GoalCard key={g.id} g={g} onPress={() => router.push(`/goals/${g.id}` as never)} />)}
      <Button title="Nueva meta" variant="secondary" icon="add" onPress={() => router.push("/goals/new" as never)} />

      <Heading>Ordenar tus datos</Heading>
      <MenuRow section="plan" icon="pricetags-outline" title="Categorías" text="Categorías y subcategorías" onPress={() => router.push("/categories" as never)} />
      <MenuRow section="plan" icon="git-branch-outline" title="Reglas de clasificación" text="Asignan o sugieren categorías solas" onPress={() => router.push("/rules" as never)} />
      <MenuRow section="plan" icon="help-circle-outline" title="Movimientos sin categoría" text="Clasifica lo que quedó pendiente" onPress={() => router.push("/classify" as never)} />
    </Screen>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.border }}>
      <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
    </View>
  );
}

function BudgetCard({ b, onPress }: { b: Budget; onPress: () => void }) {
  const { colors } = useAppTheme();
  const c = b.current;
  const pct = c.percent ?? 0;
  const tone = c.exceeded ? colors.expenseStrong : pct >= 80 ? colors.warningStrong : colors.incomeStrong;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt bold numberOfLines={1}>{b.name}</Txt>
            <Txt size={12} muted numberOfLines={1}>{PERIOD[b.period]}{b.category ? ` · ${b.category.name}` : " · todo el gasto"}</Txt>
          </View>
          <Txt bold color={tone}>{c.exceeded ? "Excedido" : `${Math.round(pct)}%`}</Txt>
        </View>
        <Bar pct={pct} color={tone} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
          <Txt size={12} muted style={{ flexShrink: 1 }}>Gastado {formatSoles(c.spent)} de {formatSoles(c.available)}</Txt>
          <Txt size={12} bold color={c.exceeded ? colors.expenseStrong : colors.text} style={{ flexShrink: 1 }}>{c.exceeded ? `+${formatSoles(c.overBy)}` : `Quedan ${formatSoles(c.remaining)}`}</Txt>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function GoalCard({ g, onPress }: { g: Goal; onPress: () => void }) {
  const { colors } = useAppTheme();
  const tone = g.achieved ? colors.incomeStrong : colors.warningStrong;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt bold numberOfLines={1}>{g.name}</Txt>
            <Txt size={12} muted numberOfLines={1}>Objetivo {formatSoles(g.targetAmount)}{g.targetDate ? ` · hasta ${humanDate(g.targetDate)}` : ""}</Txt>
          </View>
          <View style={{ padding: 8, borderRadius: 12, backgroundColor: `${tone}1A` }}>
            <Ionicons name={g.achieved ? "checkmark-circle-outline" : "flag-outline"} size={22} color={tone} />
          </View>
        </View>
        <Bar pct={g.percent} color={tone} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
          <Txt size={12} muted style={{ flexShrink: 1 }}>{g.achieved ? "¡Meta cumplida!" : `${g.percent}% completado`}</Txt>
          <Txt size={12} bold style={{ flexShrink: 1 }}>{formatSoles(g.saved)}</Txt>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
