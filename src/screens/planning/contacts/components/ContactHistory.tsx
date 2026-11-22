import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet from "../../../../components/common/BottomSheet";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { EVALoading } from "../../../../components/common/EVALoading";
import { Button, MenuRow } from "../../../../components/v1/ui";
import { useDialog } from "../../../../context/DialogContext";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { Contact } from "../../../../interfaces/Contact";
import { useContactHistory } from "../../../../logic/contacts/useContactHistory";
import { humanDate } from "../../../../utils/dates";
import { openWhatsApp, shareText } from "../../../../utils/share";
import { cmpMoney, formatSoles } from "../../../../utils/money";
import { getAdjustedColor, ServiceIcon } from "../../../../utils/serviceIcons";

interface ContactHistoryProps {
  contact: Contact;
  onBack: () => void;
  onAddServicePress: () => void;
  onEditPress?: () => void;
  refreshTrigger?: number;
}

const PAY_LABEL: Record<string, string> = { paid: "Pagado", partial: "Parcial", converted: "A préstamo" };

/** Perfil unificado de una persona: deuda, crédito a favor, servicios, préstamos y acciones rápidas. */
export function ContactHistory({ contact, onBack, onAddServicePress, onEditPress, refreshTrigger }: ContactHistoryProps) {
  const { colors, fonts, isDark } = useAppTheme();
  const router = useRouter();
  const dialog = useDialog();
  const { loading, error, summary, expandedServices, toggleService, loadSummary } = useContactHistory(contact, refreshTrigger);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const owes = (v: string) => cmpMoney(v, "0.00") > 0;
  const go = (path: string) => { setMenu(false); setTimeout(() => router.push(path as never), 0); };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadSummary(); } finally { setRefreshing(false); }
  };

  const remindWhatsApp = async () => {
    if (!summary) return;
    const ok = await openWhatsApp(summary.shareText, contact.telefono);
    if (!ok) await shareText(summary.shareText).catch((e) => dialog.fail(e, "No se pudo compartir el mensaje"));
  };

  const shareStatement = async () => {
    if (!summary) return;
    try { await shareText(summary.shareText); }
    catch (e) { await dialog.fail(e, "No se pudo preparar el mensaje"); }
  };

  if (loading && !summary) return <EVALoading message="Cargando perfil..." />;

  const back = (
    <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
    </TouchableOpacity>
  );

  if (!summary || !summary.services) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 10, gap: 40 }}>
          {back}
          <Text style={{ textAlign: "center", color: colors.textSecondary, fontFamily: fonts.family.regular }}>{error ?? "No se pudo cargar la información."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const debt = owes(summary.totalDebt);
  const hasOverdue = owes(summary.overdue);
  const hasCredit = owes(summary.creditTotal);
  const n = summary.services.length;
  const contactMeta = [contact.telefono, contact.email].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 120, gap: 16 }}
      >
        {/* Barra superior */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {back}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {onEditPress && (
              <TouchableOpacity onPress={onEditPress} accessibilityRole="button" accessibilityLabel="Editar persona" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="create-outline" size={19} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Más acciones" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Identidad */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <EVAAvatar name={contact.nombre} color={getAdjustedColor(contact.color, isDark)} size={56} fontSize={24} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontFamily: fonts.family.bold }}>{contact.nombre}</Text>
            {contactMeta ? (
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: fonts.family.regular }}>{contactMeta}</Text>
            ) : null}
            {contact.notas ? (
              <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.family.regular }}>{contact.notas}</Text>
            ) : null}
          </View>
        </View>

        {/* Resumen rápido: Pendiente y Crédito a favor */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: `${colors.text}07`, gap: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: fonts.family.medium }}>Pendiente</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: debt ? colors.expenseStrong : colors.incomeStrong, fontSize: 22, fontFamily: fonts.family.bold, fontVariant: ["tabular-nums"] }}>
              {debt ? formatSoles(summary.totalDebt) : "Al día"}
            </Text>
            {hasOverdue && (
              <Text style={{ color: colors.expenseStrong, fontSize: 11.5, fontFamily: fonts.family.semiBold }}>
                {formatSoles(summary.overdue)} vencido
              </Text>
            )}
          </View>
          {hasCredit && (
            <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: `${colors.incomeStrong}14`, gap: 2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: fonts.family.medium }}>Saldo a favor</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.incomeStrong, fontSize: 22, fontFamily: fonts.family.bold, fontVariant: ["tabular-nums"] }}>
                {formatSoles(summary.creditTotal)}
              </Text>
              {owes(summary.creditReserved) && (
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: fonts.family.regular }}>
                  {formatSoles(summary.creditReserved)} reservado
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Acciones principales */}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Button title="Registrar cobro" icon="cash-outline" size="compact" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId: contact.id } })} />
          </View>
          {debt && (
            <View style={{ flex: 1 }}>
              <Button title="WhatsApp" icon="logo-whatsapp" size="compact" variant="secondary" onPress={remindWhatsApp} />
            </View>
          )}
          <TouchableOpacity
            onPress={shareStatement}
            accessibilityRole="button"
            accessibilityLabel="Compartir estado de cuenta"
            style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.text}0A` }}
          >
            <Ionicons name="share-outline" size={19} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Servicios */}
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.family.bold }}>Servicios</Text>
            <TouchableOpacity onPress={onAddServicePress} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.family.bold }}>Añadir a un servicio</Text>
            </TouchableOpacity>
          </View>

          {n === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
              <Ionicons name="layers-outline" size={28} color={colors.muted} />
              <Text style={{ textAlign: "center", color: colors.textSecondary, fontSize: 13, fontFamily: fonts.family.regular, paddingHorizontal: 16 }}>
                Aún no participa en ningún servicio. Toca «Añadir a un servicio» para empezar.
              </Text>
            </View>
          ) : summary.services.map((service, i) => {
            const open = !!expandedServices[service.serviceId];
            const sOwes = owes(service.debt);
            const tone = getAdjustedColor(service.color || colors.primary, isDark);
            return (
              <View key={service.serviceId} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <TouchableOpacity onPress={() => toggleService(service.serviceId)} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ expanded: open }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                  <ServiceIcon name={service.icon} size={22} color={tone} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: fonts.family.bold }}>{service.serviceName}</Text>
                    <Text style={{ color: sOwes ? colors.expenseStrong : colors.incomeStrong, fontSize: 12, fontFamily: fonts.family.semiBold }}>
                      {sOwes ? (service.overdueCount > 0 ? `${service.overdueCount} ${service.overdueCount === 1 ? "cobro vencido" : "cobros vencidos"}` : "Pendiente") : "Al día"}
                    </Text>
                  </View>
                  {sOwes && <Text style={{ color: colors.expenseStrong, fontSize: 14.5, fontFamily: fonts.family.bold, fontVariant: ["tabular-nums"] }}>{formatSoles(service.debt)}</Text>}
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                </TouchableOpacity>

                {open && (
                  <View style={{ marginLeft: 34, paddingBottom: 10 }}>
                    {(service.history || []).map((pay, idx) => {
                      const label = pay.free ? "Sin cobro" : PAY_LABEL[pay.status] ?? "Pendiente";
                      const color = pay.free ? colors.primary : pay.status === "paid" ? colors.incomeStrong : pay.status === "converted" ? colors.textSecondary : pay.status === "partial" ? colors.warningStrong : colors.expenseStrong;
                      return (
                        <View key={idx} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: `${colors.border}66` }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontFamily: fonts.family.regular }}>{pay.mes_anio}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <Text style={{ color: colors.text, fontSize: 13, fontFamily: fonts.family.semiBold, fontVariant: ["tabular-nums"] }}>{pay.free ? "—" : formatSoles(pay.cuota)}</Text>
                            <Text style={{ color, fontSize: 12, fontFamily: fonts.family.bold, minWidth: 64, textAlign: "right" }}>{label}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Préstamos activos de esta persona */}
        {summary.openLoans.length > 0 && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.family.bold }}>Préstamos activos</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: "/loans", params: { contactId: contact.id } })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.family.bold }}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {summary.openLoans.map((l, i) => {
              const isLent = l.direction === "lent";
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => router.push(`/loan/${l.id}` as never)}
                  activeOpacity={0.75}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                >
                  <Ionicons name={isLent ? "arrow-up-circle-outline" : "arrow-down-circle-outline"} size={22} color={isLent ? colors.incomeStrong : colors.expenseStrong} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14.5, fontFamily: fonts.family.bold }}>
                      {isLent ? "Le prestaste" : "Te prestó"}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.family.regular }}>
                      Desde {humanDate(l.openedOn)} · capital {formatSoles(l.principal)}
                    </Text>
                  </View>
                  <Text style={{ color: isLent ? colors.incomeStrong : colors.expenseStrong, fontSize: 14, fontFamily: fonts.family.bold, fontVariant: ["tabular-nums"] }}>
                    {formatSoles(l.pending)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Crédito reservado */}
        {summary.reservations.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.family.bold }}>Crédito reservado</Text>
            {summary.reservations.map((r, i) => (
              <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13.5, fontFamily: fonts.family.medium }}>Para {r.subscriptionName}</Text>
                <Text style={{ color: colors.incomeStrong, fontSize: 14, fontFamily: fonts.family.bold, fontVariant: ["tabular-nums"] }}>{formatSoles(r.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={contact.nombre} maxHeight={0.7}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
          {onEditPress && <MenuRow icon="create-outline" title="Editar datos" onPress={() => { setMenu(false); setTimeout(onEditPress, 0); }} />}
          <MenuRow icon="receipt-outline" title="Cobros registrados" onPress={() => go(`/contact/${contact.id}/receipts`)} />
          <MenuRow icon="swap-horizontal-outline" title="Convertir deuda en préstamo" onPress={() => go(`/contact/${contact.id}/convert`)} />
          <MenuRow icon="cash-outline" title="Préstamos" onPress={() => { setMenu(false); setTimeout(() => router.push({ pathname: "/loans", params: { contactId: contact.id } }), 0); }} />
          <MenuRow icon="return-down-back-outline" title="Devoluciones" onPress={() => go("/refunds")} />
          <MenuRow icon="share-outline" title="Compartir estado de cuenta" onPress={() => { setMenu(false); setTimeout(() => { void shareStatement(); }, 0); }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
