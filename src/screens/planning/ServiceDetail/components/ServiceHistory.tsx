import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Charge, CycleDetail, CycleRef, Subscription } from "../../../../api/types";
import { Notice } from "../../../../components/v1/ui";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { CycleCarousel } from "./CycleCarousel";
import { ServiceSummaryCard } from "./ServiceSummaryCard";
import { SharedParticipantsList } from "./SharedParticipantsList";

interface ServiceHistoryProps {
  service: Subscription;
  cycle: CycleDetail | null;
  loading: boolean;
  cycles: CycleRef[];
  selectedIndex: number;
  onChangeCycle: (index: number) => void;
  onPayService: () => void;
  onEditPayment: () => void;
  onPressCharge: (c: Charge) => void;
  onRemindParticipant: (contactId: string) => void;
  onAddParticipant?: () => void;
  onAdvance: () => void;
  advancing: boolean;
  error?: string | null;
}

/** Pestaña de pagos: elegir ciclo, ver su resumen y, si es compartido, el estado de cada participante. */
export const ServiceHistory: React.FC<ServiceHistoryProps> = ({ service, cycle, loading, cycles, selectedIndex, onChangeCycle, onPayService, onEditPayment, onPressCharge, onRemindParticipant, onAddParticipant, onAdvance, advancing, error }) => {
  const { colors } = useAppTheme();
  const shared = service.mode === "shared";
  const active = service.status === "active";
  const advanceButton = active && cycle ? (
    <TouchableOpacity onPress={onAdvance} disabled={advancing} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ opacity: advancing ? 0.5 : 1 }}>
      <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "AsapBold" }}>+ Adelantar ciclo</Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={{ gap: 14 }}>
      <CycleCarousel cycles={cycles} selectedIndex={selectedIndex} currentId={service.currentCycle?.id} onChange={onChangeCycle} />
      {cycle ? <ServiceSummaryCard cycle={cycle} service={service} onPayService={onPayService} onEditPayment={onEditPayment} /> : (
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Asap", textAlign: "center", paddingVertical: 24 }}>{loading ? "Cargando ciclo…" : "Este servicio todavía no tiene ciclos."}</Text>
      )}
      {error && <Notice tone="err">{error}</Notice>}
      {!shared && advanceButton && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>¿Necesitas el siguiente ciclo?</Text>
          {advanceButton}
        </View>
      )}
      {shared && cycle && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>Quién ha pagado</Text>
            {advanceButton}
          </View>
          <SharedParticipantsList
            charges={cycle.charges}
            hasParticipants={service.occupiedSeats > 1}
            canAddParticipant={active && service.occupiedSeats < service.capacity}
            onAddParticipant={onAddParticipant}
            onPressCharge={onPressCharge}
            onRemindParticipant={onRemindParticipant}
          />
        </>
      )}
    </View>
  );
};

export default ServiceHistory;
