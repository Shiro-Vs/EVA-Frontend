import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SeatSummary } from "../../../../api/types";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { Button } from "../../../../components/v1/ui";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ServiceParticipantsProps {
  seats: SeatSummary[];
  shared: boolean;
  capacity: number;
  canAdd?: boolean;
  onAddSubscriber: () => void;
  onOpenSeat: (seatId: string) => void;
}

/** Quiénes comparten el servicio, cuánto paga cada uno y quién debe. */
export const ServiceParticipants: React.FC<ServiceParticipantsProps> = ({ seats, shared, capacity, canAdd = true, onAddSubscriber, onOpenSeat }) => {
  const { colors } = useAppTheme();
  const others = seats.filter((s) => !s.isOwner);
  const people = new Set(others.map((s) => s.contact?.id)).size;
  const full = seats.length >= capacity;
  const addDisabled = full || !canAdd;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: "AsapBold" }}>{people} {people === 1 ? "persona" : "personas"} comparten</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{seats.length} de {capacity} plazas ocupadas</Text>
        </View>
        <Button title="Incorporar" icon="person-add-outline" size="compact" disabled={addDisabled} onPress={onAddSubscriber} />
      </View>

      <View>
        {seats.map((seat, i) => {
          const owes = cmpMoney(seat.pending, "0.00") > 0;
          const name = seat.isOwner ? "Tú" : seat.contact?.name ?? "—";
          return (
            <TouchableOpacity key={seat.id} disabled={seat.isOwner} onPress={() => onOpenSeat(seat.id)} activeOpacity={0.7} accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <EVAAvatar name={name} color={seat.isOwner ? colors.muted : colors.primary} size={38} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontFamily: "AsapBold" }}>{name}</Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{seat.isOwner ? `${seat.label} · sin cargo` : `${seat.label} · cuota ${formatSoles(seat.quota)}`}</Text>
              </View>
              {!seat.isOwner && (
                <View style={{ backgroundColor: owes ? `${colors.expense}22` : `${colors.income}22`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: owes ? colors.expenseStrong : colors.incomeStrong, fontSize: 11, fontFamily: "AsapBold" }}>{owes ? `Debe ${formatSoles(seat.pending)}` : "Al día"}</Text>
                </View>
              )}
              {!seat.isOwner && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
            </TouchableOpacity>
          );
        })}
        {Array.from({ length: Math.max(0, capacity - seats.length) }).map((_, k) => (
          <TouchableOpacity key={`free-${k}`} disabled={addDisabled} onPress={onAddSubscriber} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Plaza libre, incorporar participante"
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderTopWidth: seats.length + k === 0 ? 0 : 1, borderTopColor: colors.border, opacity: addDisabled ? 0.5 : 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderStyle: "dashed", borderColor: addDisabled ? colors.muted : colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add" size={18} color={addDisabled ? colors.muted : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: addDisabled ? colors.muted : colors.text, fontSize: 14, fontFamily: "AsapBold" }}>Plaza libre</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap" }}>{canAdd ? "Toca para incorporar participante" : "Reactiva el servicio para incorporar"}</Text>
            </View>
            {!addDisabled && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
          </TouchableOpacity>
        ))}
      </View>
      {!shared && <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Asap", textAlign: "center" }}>Este servicio no es compartido.</Text>}
    </View>
  );
};

export default ServiceParticipants;
