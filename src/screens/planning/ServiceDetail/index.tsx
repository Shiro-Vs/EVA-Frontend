import React, { useRef, useState } from "react";
import { ActivityIndicator, PanResponder, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet from "../../../components/common/BottomSheet";
import { ErrorBox, MenuRow } from "../../../components/v1/ui";
import { useDialog } from "../../../context/DialogContext";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { useServiceDetail, type ServiceTab } from "../../../logic/serviceDetail/useServiceDetail";
import EditServiceModal from "./components/EditServiceModal";
import ServiceHeader from "./components/ServiceHeader";
import ServiceHistory from "./components/ServiceHistory";
import ServiceParticipants from "./components/ServiceParticipants";
import ServicePayments from "./components/ServicePayments";

/** Detalle de un servicio: cabecera con sus datos, pestaña de pagos por ciclo y (si es compartido) la de participantes. */
export default function ServiceDetailScreen({ serviceId }: { serviceId: string }) {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const s = useServiceDetail(serviceId);
  const [menu, setMenu] = useState(false);
  const service = s.sub.data;

  // Deslizar a los lados cambia de pestaña (solo si el gesto es claramente horizontal, para no chocar con el scroll vertical).
  const swipe = useRef({ tabs: [] as ServiceTab[], tab: "ciclo" as ServiceTab, go: (_t: ServiceTab) => {} });
  swipe.current = { tabs: service?.mode === "shared" ? ["ciclo", "participantes", "historial"] : ["ciclo", "historial"], tab: s.activeTab, go: s.switchTab };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_e, g) => {
      const { tabs, tab, go } = swipe.current;
      const next = tabs[tabs.indexOf(tab) + (g.dx < -50 ? 1 : g.dx > 50 ? -1 : 0)];
      if (next && next !== tab) go(next);
    },
  })).current;

  if (s.sub.error) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" }}><ErrorBox message={s.sub.error} onRetry={s.reloadAll} /></View>;
  if (!service) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;

  const shared = service.mode === "shared";
  const full = (s.seats.data ?? []).length >= service.capacity;
  const accountName = s.detail.data?.supplierPayment?.account?.name ?? s.preferredAccount?.name ?? null;
  const back = () => (s.router.canGoBack() ? s.router.back() : s.router.replace("/planning"));
  const run = (fn: () => void) => { setMenu(false); setTimeout(fn, 0); };
  const correctPayment = async () => {
    const ok = await dialog.confirm({ title: "¿Corregir el pago al proveedor?", message: "Se revertirá este pago (el dinero vuelve a tu cuenta) para que puedas registrarlo de nuevo con los datos correctos. El historial se conserva.", confirmLabel: "Revertir pago" });
    if (!ok) return;
    await s.reversePayment.submit();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 120, gap: 16 }} {...pan.panHandlers}>
        <ServiceHeader service={service} accountName={accountName} onBack={back} onMenu={() => setMenu(true)} activeTab={s.activeTab} onSwitchTab={s.switchTab} />

        {s.activeTab === "historial" ? (
          <ServicePayments cycles={s.history.data} loading={s.history.loading} shared={shared} />
        ) : shared && s.activeTab === "participantes" ? (
          <ServiceParticipants seats={s.seats.data ?? []} shared={shared} capacity={service.capacity} onAddSubscriber={s.goJoin} onOpenSeat={(sid) => s.router.push(`/seat/${sid}` as never)} />
        ) : (
          <ServiceHistory
            service={service} cycle={s.detail.data} loading={s.detail.loading} cycles={s.ordered} selectedIndex={s.selectedIndex}
            onChangeCycle={s.selectCycleAt} onPayService={s.goPay} onEditPayment={correctPayment} onPressCharge={s.openCharge} onRemindParticipant={s.remind}
            onAdvance={() => void s.advance.submit()} advancing={s.advance.busy}
            error={s.remindError ?? s.advance.error ?? s.reversePayment.error ?? s.detail.error}
          />
        )}
      </ScrollView>

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={service.name} maxHeight={0.6}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
          <MenuRow icon="create-outline" title="Editar nombre, ícono y color" onPress={() => run(() => s.setEditVisible(true))} />
          {shared && <MenuRow icon="person-add-outline" title="Incorporar participante" text={full ? "No quedan plazas libres" : undefined} onPress={() => run(s.goJoin)} />}
          <MenuRow icon="options-outline" title="Gestionar servicio" text="Precio, calendario, cuotas, archivar…" onPress={() => run(() => s.router.push(`/service/${serviceId}/manage` as never))} />
        </View>
      </BottomSheet>

      <EditServiceModal visible={s.isEditVisible} onClose={() => s.setEditVisible(false)} service={service} onSuccess={s.reloadAll} />
    </SafeAreaView>
  );
}
