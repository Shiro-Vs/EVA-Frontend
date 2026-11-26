import React, { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Budget, Goal, Occurrence } from "../../api/types";
import { Button, Card, Chip, Empty, ErrorBox, Heading, Loading, Money, Notice, RowLink, Screen, SeeAll, SummaryTile, Txt } from "../../components/v1/ui";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { useHorizontalSwipe } from "../../hooks/useHorizontalSwipe";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

const PERIOD: Record<Budget["period"], string> = { weekly: "semanal", monthly: "mensual", yearly: "anual" };

type PlanTab = "budgets" | "goals" | "recurring";

/** Pestaña Planificar: sub-pestañas limpias para Presupuestos, Metas y Recurrentes. */
export default function PlanScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<PlanTab>("budgets");
  const [refreshing, setRefreshing] = useState(false);

  const budgets = useAsync(() => api.budgets(undefined, "active"), []);
  const goals = useAsync(() => api.goals("active"), []);
  const overview = useAsync(() => api.goalsOverview(), []);
  const pending = useAsync(() => api.recurringPending(14), []);
  const templates = useAsync(() => api.recurringTemplates("active"), []);
  const skip = useSubmit(async (_k: string, o: Occurrence) => api.skipOccurrence(o.id));

  const reload = useCallback(() => {
    void budgets.reload();
    void goals.reload();
    void overview.reload();
    void pending.reload();
    void templates.reload();
  }, [budgets.reload, goals.reload, overview.reload, pending.reload, templates.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([budgets.reload(), goals.reload(), overview.reload(), pending.reload(), templates.reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [budgets.reload, goals.reload, overview.reload, pending.reload, templates.reload]);

  const dueList = pending.data?.due ?? [];
  const upcomingList = pending.data?.upcoming ?? [];
  const due = dueList.length;
  const bl = (budgets.data ?? []).filter((b) => b.status === "active");
  const gl = (goals.data ?? []).filter((g) => g.status === "active");
  const tl = templates.data ?? [];
  const hasReserved = !!overview.data && cmpMoney(overview.data.totals.reserved, "0.00") > 0;
  const showReserveTiles = gl.length > 0 || hasReserved;

  const newRoute = tab === "budgets" ? "/budgets/new" : tab === "goals" ? "/goals/new" : "/recurring/new";

  const tabs: Array<{ id: PlanTab; label: string; badge?: number }> = [
    { id: "budgets", label: "Presupuestos" },
    { id: "goals", label: "Metas" },
    { id: "recurring", label: "Recurrentes", badge: due > 0 ? due : undefined },
  ];

  const tabOrder: PlanTab[] = ["budgets", "goals", "recurring"];
  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: () => {
      const idx = tabOrder.indexOf(tab);
      if (idx < tabOrder.length - 1) setTab(tabOrder[idx + 1]!);
    },
    onSwipeRight: () => {
      const idx = tabOrder.indexOf(tab);
      if (idx > 0) setTab(tabOrder[idx - 1]!);
    },
  });

  return (
    <Screen
      title="Planificar"
      back={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      panHandlers={swipeHandlers}
      right={<Button title="Nuevo" icon="add" size="compact" onPress={() => router.push(newRoute as never)} />}
    >
      {/* Selector de sub-pestañas */}
      <View style={{ flexDirection: "row", gap: 6, backgroundColor: `${colors.text}08`, borderRadius: 16, padding: 4 }}>
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 9,
                paddingHorizontal: 6,
                borderRadius: 12,
                backgroundColor: on ? colors.card : "transparent",
              }}
            >
              <Text numberOfLines={1} style={{ color: on ? colors.primary : colors.textSecondary, fontSize: 13, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                {t.label}
              </Text>
              {t.badge ? (
                <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: colors.warningStrong }}>
                  <Text style={{ color: "#fff", fontSize: 10.5, fontFamily: "AsapBold" }}>{t.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Presupuestos ─── */}
      {tab === "budgets" && (
        <>
          {budgets.loading && !budgets.data ? (
            <Loading />
          ) : budgets.error ? (
            <ErrorBox message={budgets.error} onRetry={budgets.reload} />
          ) : bl.length === 0 ? (
            <Empty
              icon="speedometer-outline"
              title="Sin presupuestos"
              text="Ponle un límite a una categoría o a todo tu gasto del mes. Avisan, pero nunca bloquean."
              action={<Button title="Crear presupuesto" icon="add" onPress={() => router.push("/budgets/new" as never)} />}
            />
          ) : (
            <>
              {bl.map((b) => (
                <BudgetCard key={b.id} b={b} onPress={() => router.push(`/budgets/${b.id}` as never)} />
              ))}
              <Button title="Ver archivados y detalles" variant="secondary" onPress={() => router.push("/budgets" as never)} />
            </>
          )}
        </>
      )}

      {/* ─── Metas de ahorro ─── */}
      {tab === "goals" && (
        <>
          {showReserveTiles && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SummaryTile label="Libre para gastar" icon="lock-open-outline" value={overview.data ? formatSoles(overview.data.totals.free) : "…"} tone="income" onPress={() => router.push("/goals/accounts" as never)} />
              <SummaryTile label="Reservado" icon="lock-closed-outline" value={overview.data ? formatSoles(overview.data.totals.reserved) : "…"} onPress={() => router.push("/goals/accounts" as never)} />
            </View>
          )}
          {goals.loading && !goals.data ? (
            <Loading />
          ) : goals.error ? (
            <ErrorBox message={goals.error} onRetry={goals.reload} />
          ) : gl.length === 0 ? (
            <Empty
              icon="flag-outline"
              title="Aún no tienes metas"
              text="Crea una meta y aparta dinero que ya tienes en tus cuentas: reservar no lo mueve."
              action={<Button title="Nueva meta" icon="add" onPress={() => router.push("/goals/new" as never)} />}
            />
          ) : (
            <>
              {gl.map((g) => (
                <GoalCard key={g.id} g={g} onPress={() => router.push(`/goals/${g.id}` as never)} />
              ))}
              <Button title="Ver reservas por cuenta y archivadas" variant="secondary" onPress={() => router.push("/goals/accounts" as never)} />
            </>
          )}
        </>
      )}

      {/* ─── Recurrentes ─── */}
      {tab === "recurring" && (
        <>
          {pending.loading && !pending.data && templates.loading && !templates.data ? (
            <Loading />
          ) : pending.error ? (
            <ErrorBox message={pending.error} onRetry={reload} />
          ) : dueList.length === 0 && upcomingList.length === 0 && tl.length === 0 ? (
            <Empty
              icon="repeat-outline"
              title="Sin movimientos recurrentes"
              text="Programa sueldo, alquiler u otros fijos. EVA te los propondrá en su fecha sin registrar nada solo."
              action={<Button title="Nueva recurrencia" icon="add" onPress={() => router.push("/recurring/new" as never)} />}
            />
          ) : (
            <>
              {dueList.length > 0 && (
                <>
                  <Heading>Por decidir</Heading>
                  {dueList.map((o) => (
                    <Card key={o.id} outlined>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <Txt bold style={{ flex: 1, flexShrink: 1 }}>{o.templateName}</Txt>
                        <Money value={o.amount} size={15} tone={o.kind === "income" ? "income" : "expense"} />
                      </View>
                      <Txt size={12} muted>{o.kind === "income" ? "Ingreso" : "Gasto"} del {humanDate(o.dueDate)}</Txt>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                        <View style={{ flex: 1 }}><Button title="Confirmar" onPress={() => router.push(`/recurring/occurrence/${o.id}` as never)} /></View>
                        <View style={{ flex: 1 }}><Button title="Omitir" variant="secondary" busy={skip.busy} onPress={async () => { if (await skip.submit(o)) void pending.reload(); }} /></View>
                      </View>
                    </Card>
                  ))}
                  {skip.error && <Notice tone="err">{skip.error}</Notice>}
                </>
              )}

              {upcomingList.length > 0 && (
                <>
                  <Heading>Próximas</Heading>
                  {upcomingList.map((u) => (
                    <RowLink key={u.templateId} onPress={() => router.push(`/recurring/${u.templateId}` as never)}>
                      <View style={{ flex: 1 }}>
                        <Txt bold>{u.name}</Txt>
                        <Txt size={12} muted>{u.kind === "income" ? "Ingreso" : "Gasto"} · {humanDate(u.dueDate)}</Txt>
                      </View>
                      <Money value={u.amount} size={14} tone={u.kind === "income" ? "income" : "expense"} />
                    </RowLink>
                  ))}
                </>
              )}

              <Heading action={<SeeAll label="Todas" onPress={() => router.push("/recurring" as never)} />}>Plantillas activas</Heading>
              {tl.length === 0 ? (
                <Card><Txt muted>Sin plantillas activas.</Txt></Card>
              ) : (
                tl.map((t) => (
                  <RowLink key={t.id} onPress={() => router.push(`/recurring/${t.id}` as never)}>
                    <View style={{ flex: 1 }}>
                      <Txt bold>{t.name}</Txt>
                      <Txt size={12} muted>{formatSoles(t.amount)} · {t.account.name}{t.nextDue ? ` · próxima ${humanDate(t.nextDue)}` : ""}</Txt>
                    </View>
                    {!!t.pendingCount && <Chip status="partial" label={`${t.pendingCount} por decidir`} />}
                  </RowLink>
                ))
              )}
            </>
          )}
        </>
      )}
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
  const tone = c.exceeded ? colors.expenseStrong : c.level !== null ? colors.warningStrong : colors.incomeStrong;
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
          <Ionicons name={g.achieved ? "checkmark-circle-outline" : "flag-outline"} size={22} color={tone} />
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
