import React, { useCallback, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { BankLoanListItem, Loan } from "../../api/types";
import { Button, Chip, Empty, ErrorBox, Loading, Screen, Txt } from "../../components/v1/ui";
import { useModules } from "../../context/ModulesContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAsync } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { useHorizontalSwipe } from "../../hooks/useHorizontalSwipe";
import { humanDate } from "../../utils/dates";
import { cmpMoney, formatSoles } from "../../utils/money";

function sumMoney(values: string[]): string {
  const cents = values.reduce((acc, v) => {
    const clean = v.replace(",", "").trim();
    const neg = clean.startsWith("-");
    const abs = neg ? clean.slice(1) : clean;
    const [whole = "0", frac = "00"] = abs.split(".");
    const c = BigInt(whole || "0") * 100n + BigInt((frac + "00").slice(0, 2));
    return acc + (neg ? -c : c);
  }, 0n);
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const s = abs.toString().padStart(3, "0");
  return `${neg ? "-" : ""}${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** Pestaña principal de Préstamos: unifica préstamos entre personas y bancarios, con acceso rápido a Personas si está activo. */
export default function LoansHubScreen() {
  const { colors } = useAppTheme();
  const { modules } = useModules();
  const router = useRouter();
  const [tab, setTab] = useState<"people" | "bank">(modules.people ? "people" : "bank");
  const [refreshing, setRefreshing] = useState(false);

  const activeTab: "people" | "bank" = modules.people ? tab : "bank";

  const loansQ = useAsync(() => (modules.people ? api.loans() : Promise.resolve<Loan[]>([])), [modules.people]);
  const bankQ = useAsync(() => api.bankLoans(), []);

  const reload = useCallback(() => {
    if (modules.people) void loansQ.reload();
    void bankQ.reload();
  }, [modules.people, loansQ.reload, bankQ.reload]);
  useFocusReload(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...(modules.people ? [loansQ.reload()] : []),
        bankQ.reload(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [modules.people, loansQ.reload, bankQ.reload]);

  const personLoans = loansQ.data ?? [];
  const bankLoans = bankQ.data ?? [];

  const openLent = useMemo(
    () => personLoans.filter((l) => l.status === "open" && l.direction !== "borrowed"),
    [personLoans],
  );
  const openBorrowed = useMemo(
    () => personLoans.filter((l) => l.status === "open" && l.direction === "borrowed"),
    [personLoans],
  );
  const activeBank = useMemo(
    () => bankLoans.filter((b) => b.status === "active"),
    [bankLoans],
  );

  const totalLent = useMemo(() => sumMoney(openLent.map((l) => l.pending)), [openLent]);
  const totalOwed = useMemo(
    () => sumMoney([...openBorrowed.map((l) => l.pending), ...activeBank.map((b) => b.remainingScheduled)]),
    [openBorrowed, activeBank],
  );

  const loading = (modules.people && loansQ.loading && !loansQ.data) || (bankQ.loading && !bankQ.data);
  const error = (modules.people ? loansQ.error : null) ?? bankQ.error;

  const newRoute = activeTab === "bank" ? "/bank-loans/new" : "/loans/new";

  const swipeHandlers = useHorizontalSwipe({
    enabled: modules.people,
    onSwipeLeft: () => setTab("bank"),
    onSwipeRight: () => setTab("people"),
  });

  return (
    <Screen
      title="Préstamos"
      back={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      panHandlers={swipeHandlers}
      right={<Button title="Nuevo" icon="add" size="compact" onPress={() => router.push(newRoute as never)} />}
    >
      {/* Resumen superior editorial */}
      <View style={{ flexDirection: "row", paddingTop: 2, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {modules.people && (
          <View style={{ flex: 1, gap: 2, paddingRight: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>
              Te deben
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: cmpMoney(totalLent, "0.00") > 0 ? colors.incomeStrong : colors.text, fontSize: 26, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], letterSpacing: -0.4 }}>
              {formatSoles(totalLent)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>
              {openLent.length} {openLent.length === 1 ? "préstamo activo" : "préstamos activos"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2, paddingLeft: modules.people ? 14 : 0, borderLeftWidth: modules.people ? 1 : 0, borderLeftColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "AsapMedium" }}>
            Debes
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 26, fontFamily: "AsapBold", fontVariant: ["tabular-nums"], letterSpacing: -0.4 }}>
            {formatSoles(totalOwed)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: "Asap" }}>
            {openBorrowed.length + activeBank.length} {openBorrowed.length + activeBank.length === 1 ? "activo" : "activos"}
          </Text>
        </View>
      </View>

      {/* Acceso rápido a Personas (solo si Personas está activo) */}
      {modules.people && (
        <TouchableOpacity
          onPress={() => router.push("/contacts" as never)}
          activeOpacity={0.75}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: `${colors.text}08` }}
        >
          <Ionicons name="people-outline" size={16} color={colors.sections.people.ink} />
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: "AsapBold" }}>Personas</Text>
        </TouchableOpacity>
      )}

      {/* Sub-pestañas: Entre personas | Bancarios */}
      {modules.people && (
        <View style={{ flexDirection: "row", gap: 6, backgroundColor: `${colors.text}08`, borderRadius: 16, padding: 4 }}>
          {([
            ["people", `Entre personas (${personLoans.length})`],
            ["bank", `Bancarios (${bankLoans.length})`],
          ] as const).map(([id, label]) => {
            const on = activeTab === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setTab(id)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center", backgroundColor: on ? colors.card : "transparent" }}
              >
                <Text numberOfLines={1} style={{ color: on ? colors.primary : colors.textSecondary, fontSize: 13, fontFamily: on ? "AsapBold" : "AsapMedium" }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : activeTab === "people" ? (
        personLoans.length === 0 ? (
          <Empty
            icon="swap-horizontal-outline"
            title="Sin préstamos entre personas"
            text="Registra dinero que prestaste o que te prestaron para llevar sus cuotas y saldos al día."
            action={<Button title="Nuevo préstamo" icon="add" onPress={() => router.push("/loans/new" as never)} />}
          />
        ) : (
          <View>
            {personLoans.map((l, i) => {
              const isBorrowed = l.direction === "borrowed";
              const dirLabel = isBorrowed ? "Te prestó" : "Le prestaste";
              const dirColor = isBorrowed ? colors.expenseStrong : colors.incomeStrong;
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => router.push(`/loan/${l.id}` as never)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                >
                  <Ionicons name={isBorrowed ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} size={23} color={dirColor} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{l.contactName}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>
                      {dirLabel} · desde {humanDate(l.openedOn)} · capital {formatSoles(l.principal)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Chip
                      status={l.status === "open" ? "partial" : l.status === "cancelled" ? "converted" : "paid"}
                      label={l.status === "open" ? "Abierto" : l.status === "cancelled" ? "Anulado" : "Cerrado"}
                    />
                    <Text style={{ color: cmpMoney(l.pending, "0.00") > 0 ? dirColor : colors.textSecondary, fontSize: 13.5, fontFamily: "AsapBold", fontVariant: ["tabular-nums"] }}>
                      {formatSoles(l.pending)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )
      ) : bankLoans.length === 0 ? (
        <Empty
          icon="business-outline"
          title="Sin préstamos bancarios"
          text="Registra tus préstamos de banco o financieras para controlar cuotas y vencimientos."
          action={<Button title="Nuevo préstamo bancario" icon="add" onPress={() => router.push("/bank-loans/new" as never)} />}
        />
      ) : (
        <View>
          {bankLoans.map((b: BankLoanListItem, i: number) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => router.push(`/bank-loan/${b.id}` as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
            >
              <Ionicons name="business-outline" size={22} color={b.status === "active" ? colors.primary : colors.muted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{b.name}</Text>
                <Text numberOfLines={1} style={{ color: b.overdue > 0 ? colors.expenseStrong : colors.textSecondary, fontSize: 12, fontFamily: b.overdue > 0 ? "AsapSemiBold" : "Asap" }}>
                  {b.status === "closed"
                    ? "Cerrado"
                    : b.nextDue
                      ? `Cuota ${b.nextDue.number} · vence ${humanDate(b.nextDue.dueDate)}${b.overdue > 0 ? ` · ${b.overdue} vencida${b.overdue === 1 ? "" : "s"}` : ""}`
                      : b.entity ?? "Activo"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Chip status={b.status === "active" ? (b.overdue > 0 ? "overdue" : "partial") : "paid"} label={b.status === "active" ? (b.overdue > 0 ? "Vencido" : "Activo") : "Cerrado"} />
                <Txt bold size={13}>{formatSoles(b.remainingScheduled)}</Txt>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Screen>
  );
}
