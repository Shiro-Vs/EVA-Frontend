import React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { useAppTheme } from "../../../hooks/useAppTheme";
import EVAAlert from "../../../components/common/EVAAlert";
import { ErrorBox } from "../../../components/v1/ui";

// Componentes y modales
import ServiceHeader from "./components/ServiceHeader";
import ServiceHistory from "./components/ServiceHistory";
import ServiceParticipants from "./components/ServiceParticipants";
import EditServiceModal from "./components/EditServiceModal";

// Lógica (hook con datos reales)
import { useServiceDetail } from "../../../logic/serviceDetail/useServiceDetail";

export default function ServiceDetailScreen({ serviceId }: { serviceId: string }) {
  const { colors } = useAppTheme();
  const s = useServiceDetail(serviceId);
  const service = s.sub.data;

  if (s.sub.error) {
    return <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" }}><ErrorBox message={s.sub.error} onRetry={s.reloadAll} /></View>;
  }
  if (!service) {
    return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }
  const shared = service.mode === "shared";
  const accountName = s.detail.data?.supplierPayment?.account?.name ?? s.preferredAccount?.name ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 40 }}>
      {/* Header Fijo */}
      <ServiceHeader
        service={service}
        accountName={accountName}
        onBack={() => (s.router.canGoBack() ? s.router.back() : s.router.replace("/planning"))}
        onEdit={() => s.setEditVisible(true)}
        activeTab={s.activeTab}
        onSwitchTab={s.switchTab}
      />

      {/* Contenedor de Pestañas */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={s.scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={shared}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const newTab = x >= s.SCREEN_WIDTH / 2 ? "participantes" : "historial";
            if (newTab !== s.activeTab) s.switchTab(newTab);
          }}
          contentContainerStyle={{ width: shared ? s.SCREEN_WIDTH * 2 : s.SCREEN_WIDTH }}
        >
          {/* Pestaña: Historial de pagos */}
          <View style={{ width: s.SCREEN_WIDTH, flex: 1 }}>
            <ServiceHistory
              service={service}
              cycle={s.detail.data}
              loading={s.detail.loading}
              cycles={s.ordered}
              selectedIndex={s.selectedIndex}
              screenWidth={s.SCREEN_WIDTH}
              onChangeCycle={s.selectCycleAt}
              onPayService={s.goPay}
              onEditPayment={() => s.setConfirmReverse(true)}
              onPressCharge={s.openCharge}
              onRemindParticipant={s.remind}
              onAdvance={() => void s.advance.submit()}
              advancing={s.advance.busy}
              error={s.remindError ?? s.advance.error ?? s.reversePayment.error ?? s.detail.error}
            />
          </View>

          {/* Pestaña: Participantes (solo si es compartido) */}
          {shared && (
            <View style={{ width: s.SCREEN_WIDTH, flex: 1 }}>
              <ServiceParticipants
                seats={s.seats.data ?? []}
                shared={shared}
                capacity={service.capacity}
                onAddSubscriber={s.goJoin}
                onOpenContact={(id) => s.router.push(`/contact/${id}`)}
              />
            </View>
          )}
        </ScrollView>
      </View>

      <EditServiceModal visible={s.isEditVisible} onClose={() => s.setEditVisible(false)} service={service} onSuccess={s.reloadAll} />

      <EVAAlert
        visible={s.confirmReverse}
        title="¿Corregir el pago al proveedor?"
        message="Se revertirá este pago (el dinero vuelve a tu cuenta) para que puedas registrarlo de nuevo con los datos correctos. El historial se conserva."
        type="info"
        buttonText="Revertir pago"
        onClose={() => void s.reversePayment.submit()}
        secondaryButtonText="Cancelar"
        onSecondaryAction={() => s.setConfirmReverse(false)}
        horizontalButtons
        onDismiss={() => s.setConfirmReverse(false)}
      />
    </View>
  );
}
