import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { SeatSummary } from "../../../../api/types";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ServiceParticipantsProps {
  seats: SeatSummary[];
  shared: boolean;
  capacity: number;
  onAddSubscriber: () => void;
  onOpenContact: (contactId: string) => void;
}

export const ServiceParticipants: React.FC<ServiceParticipantsProps> = ({ seats, shared, capacity, onAddSubscriber, onOpenContact }) => {
  const { colors, fonts } = useAppTheme();
  const others = seats.filter((s) => !s.isOwner);
  const people = new Set(others.map((s) => s.contact?.id)).size;
  const full = seats.length >= capacity;

  return (
    <View style={{ flex: 1, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <View>
          <Text style={{ color: colors.text, fontFamily: fonts.family.bold, fontSize: 18 }}>Participantes</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 12 }}>
            {people} {people === 1 ? "persona" : "personas"} dividiendo gastos · {seats.length}/{capacity} plazas
          </Text>
        </View>
        <TouchableOpacity
          onPress={onAddSubscriber} disabled={full} accessibilityLabel="Incorporar participante"
          style={{ width: 40, height: 40, backgroundColor: `${colors.primary}15`, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: full ? 0.4 : 1 }}
        >
          <Ionicons name="person-add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {seats.map((seat) => {
          const owes = cmpMoney(seat.pending, "0.00") > 0;
          const name = seat.isOwner ? "Tú" : seat.contact?.name ?? "—";
          return (
            <TouchableOpacity
              key={seat.id}
              disabled={seat.isOwner}
              onPress={() => seat.contact && onOpenContact(seat.contact.id)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: `${colors.text}10` }}
            >
              <EVAAvatar name={name} color={seat.isOwner ? colors.muted : colors.primary} size={40} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ color: colors.text, fontFamily: fonts.family.bold, fontSize: 14 }}>{name}</Text>
                <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 12 }}>
                  {seat.isOwner ? `${seat.label} · sin cargo` : `${seat.label} · Cuota: ${formatSoles(seat.quota)}`}
                </Text>
              </View>
              {!seat.isOwner && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: owes ? colors.expenseStrong : colors.incomeStrong, fontFamily: fonts.family.bold, fontSize: 12 }}>
                    {owes ? `Debe ${formatSoles(seat.pending)}` : "Al día"}
                  </Text>
                </View>
              )}
              {!seat.isOwner && <View style={{ marginLeft: 8 }}><Ionicons name="chevron-forward" size={16} color={colors.muted} /></View>}
            </TouchableOpacity>
          );
        })}

        {!shared && (
          <View style={{ backgroundColor: `${colors.card}80`, borderRadius: 24, padding: 32, alignItems: "center", borderStyle: "dashed", borderWidth: 1, borderColor: `${colors.border}30`, marginTop: 16 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.family.bold, textAlign: "center", marginBottom: 8 }}>Servicio Individual</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.regular, fontSize: 12, textAlign: "center" }}>
              Este servicio no es compartido.
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

export default ServiceParticipants;
