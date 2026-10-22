import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { Charge, CycleDetail, CycleRef, Subscription } from "../../../../api/types";
import { CycleCarousel } from "./CycleCarousel";
import { ServiceSummaryCard } from "./ServiceSummaryCard";
import { SharedParticipantsList } from "./SharedParticipantsList";
import { Notice } from "../../../../components/v1/ui";

interface ServiceHistoryProps {
  service: Subscription;
  cycle: CycleDetail | null;
  loading: boolean;
  cycles: CycleRef[];
  selectedIndex: number;
  screenWidth: number;
  onChangeCycle: (index: number) => void;
  onPayService: () => void;
  onEditPayment: () => void;
  onPressCharge: (c: Charge) => void;
  onRemindParticipant: (contactId: string) => void;
  onAdvance: () => void;
  advancing: boolean;
  error?: string | null;
}

export const ServiceHistory: React.FC<ServiceHistoryProps> = ({
  service, cycle, loading, cycles, selectedIndex, screenWidth, onChangeCycle, onPayService, onEditPayment, onPressCharge, onRemindParticipant, onAdvance, advancing, error,
}) => {
  const { colors, fonts } = useAppTheme();
  const shared = service.mode === "shared";

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, width: screenWidth }}>
      {cycle ? (
        <ServiceSummaryCard cycle={cycle} service={service} onPayService={onPayService} onEditPayment={onEditPayment} />
      ) : (
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, textAlign: "center", marginVertical: 24 }}>
          {loading ? "Cargando ciclo…" : "Este servicio todavía no tiene ciclos."}
        </Text>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ marginBottom: shared ? 24 : 12 }}>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.semiBold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            {shared ? "CONTROL DE PAGO" : "CICLOS"}
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, paddingVertical: 6 }}>
            <CycleCarousel cycles={cycles} selectedIndex={selectedIndex} onChange={onChangeCycle} />
          </View>
          {shared && (
            <TouchableOpacity onPress={onAdvance} disabled={advancing} style={{ alignSelf: "flex-end", marginTop: 8, opacity: advancing ? 0.5 : 1 }} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: fonts.family.semiBold, fontSize: 11 }}>+ Emitir el próximo ciclo por adelantado</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && <View style={{ marginBottom: 12 }}><Notice tone="err">{error}</Notice></View>}

        {shared && cycle && (
          <SharedParticipantsList charges={cycle.charges} onPressCharge={onPressCharge} onRemindParticipant={onRemindParticipant} />
        )}
      </View>
    </View>
  );
};

export default ServiceHistory;
