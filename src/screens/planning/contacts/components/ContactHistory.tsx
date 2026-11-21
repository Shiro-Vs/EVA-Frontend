import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../api/client";
import BottomSheet from "../../../../components/common/BottomSheet";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { EVALoading } from "../../../../components/common/EVALoading";
import { Button, MenuRow } from "../../../../components/v1/ui";
import { useDialog } from "../../../../context/DialogContext";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { Contact } from "../../../../interfaces/Contact";
import { useContactHistory } from "../../../../logic/contacts/useContactHistory";
import { shareText } from "../../../../utils/share";
import { cmpMoney, formatSoles } from "../../../../utils/money";
import { getAdjustedColor, ServiceIcon } from "../../../../utils/serviceIcons";

interface ContactHistoryProps {
  contact: Contact;
  onBack: () => void;
  onAddServicePress: () => void;
  refreshTrigger?: number;
}

const PAY_LABEL: Record<string, string> = { paid: "Pagado", partial: "Parcial", converted: "A préstamo" };

/** Detalle de una persona: cuánto debe, en qué servicios está y el estado de cada ciclo. Las acciones secundarias van en el menú ⋯. */
export function ContactHistory({ contact, onBack, onAddServicePress, refreshTrigger }: ContactHistoryProps) {
  const { colors, fonts, isDark } = useAppTheme();
  const router = useRouter();
  const dialog = useDialog();
  const { loading, error, summary, expandedServices, toggleService } = useContactHistory(contact, refreshTrigger);
  const [menu, setMenu] = useState(false);
  const [reminding, setReminding] = useState(false);
  const owes = (v: string) => cmpMoney(v, "0.00") > 0;
  const go = (path: string) => { setMenu(false); setTimeout(() => router.push(path as never), 0); };

  const remind = async () => {
    setReminding(true);
    try { await shareText((await api.contactStatement(contact.id)).shareText); }
    catch (e) { await dialog.fail(e, "No se pudo preparar el mensaje"); }
    finally { setReminding(false); }
  };

  if (loading) return <EVALoading message="Cargando historial..." />;

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
  const n = summary.services.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 10, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {back}
          <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Más acciones" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <EVAAvatar name={contact.nombre} color={getAdjustedColor(contact.color, isDark)} size={60} fontSize={26} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontFamily: fonts.family.bold }}>{contact.nombre}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: fonts.family.medium }}>
              <Text style={{ color: debt ? colors.expenseStrong : colors.incomeStrong, fontFamily: fonts.family.bold }}>{debt ? `Debe ${formatSoles(summary.totalDebt)}` : "Al día"}</Text> · {n} {n === 1 ? "servicio" : "servicios"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button title="Registrar cobro" icon="cash-outline" size="compact" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId: contact.id } })} /></View>
          {debt && <View style={{ flex: 1 }}><Button title="Recordar" icon="logo-whatsapp" size="compact" variant="secondary" busy={reminding} onPress={remind} /></View>}
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginTop: 18, marginBottom: 2 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.family.bold }}>Servicios</Text>
        <TouchableOpacity onPress={onAddServicePress} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.family.bold }}>Añadir a un servicio</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
        {n === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
            <Ionicons name="layers-outline" size={32} color={colors.muted} />
            <Text style={{ textAlign: "center", color: colors.textSecondary, fontFamily: fonts.family.regular, paddingHorizontal: 24 }}>Esta persona aún no participa en ningún servicio. Usa "Añadir a un servicio" para empezar.</Text>
          </View>
        ) : summary.services.map((service: any, i: number) => {
          const open = !!expandedServices[service.serviceId];
          const sOwes = owes(service.debt);
          const tone = getAdjustedColor(service.color || colors.primary, isDark);
          return (
            <View key={service.serviceId} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => toggleService(service.serviceId)} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ expanded: open }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                <View style={{ alignSelf: "stretch", width: 4, borderRadius: 2, backgroundColor: sOwes ? colors.expense : colors.income }} />
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${tone}26` }}>
                  <ServiceIcon name={service.icon} size={20} color={tone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: fonts.family.bold }}>{service.serviceName}</Text>
                  <Text style={{ color: sOwes ? colors.expenseStrong : colors.incomeStrong, fontSize: 12, fontFamily: fonts.family.semiBold }}>
                    {sOwes ? (service.overdueCount > 0 ? `${service.overdueCount} ${service.overdueCount === 1 ? "cobro vencido" : "cobros vencidos"}` : "Pendiente") : "Al día"}
                  </Text>
                </View>
                {sOwes && <Text style={{ color: colors.expenseStrong, fontSize: 15, fontFamily: fonts.family.bold }}>{formatSoles(service.debt)}</Text>}
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
              </TouchableOpacity>

              {open && (
                <View style={{ marginLeft: 16, paddingBottom: 10 }}>
                  {(service.history || []).map((pay: any, idx: number) => {
                    const label = pay.free ? "Sin cobro" : PAY_LABEL[pay.status] ?? "Pendiente";
                    const color = pay.free ? colors.primary : pay.status === "paid" ? colors.incomeStrong : pay.status === "converted" ? colors.textSecondary : pay.status === "partial" ? colors.warningStrong : colors.expenseStrong;
                    return (
                      <View key={idx} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.family.regular }}>{pay.mes_anio}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontFamily: fonts.family.semiBold }}>{pay.free ? "—" : formatSoles(pay.cuota)}</Text>
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
      </ScrollView>

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={contact.nombre} maxHeight={0.7}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
          <MenuRow icon="receipt-outline" title="Cobros registrados" onPress={() => go(`/contact/${contact.id}/receipts`)} />
          <MenuRow icon="document-text-outline" title="Estado de cuenta completo" onPress={() => go(`/contact/${contact.id}`)} />
          <MenuRow icon="swap-horizontal-outline" title="Convertir deuda en préstamo" onPress={() => go(`/contact/${contact.id}/convert`)} />
          <MenuRow icon="cash-outline" title="Préstamos" onPress={() => { setMenu(false); setTimeout(() => router.push({ pathname: "/loans", params: { contactId: contact.id } }), 0); }} />
          <MenuRow icon="return-down-back-outline" title="Devoluciones" onPress={() => go("/refunds")} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
