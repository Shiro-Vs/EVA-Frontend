import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CycleRef } from "../../../../api/types";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { humanDate } from "../../../../utils/dates";

interface CycleCarouselProps {
  cycles: CycleRef[]; // en orden cronológico
  selectedIndex: number;
  currentId?: string | null;
  onChange: (index: number) => void;
}

/** Selector de ciclo: flechas para ir al anterior o al siguiente y, en el centro, el ciclo que se está viendo. */
export const CycleCarousel: React.FC<CycleCarouselProps> = ({ cycles, selectedIndex, currentId, onChange }) => {
  const { colors } = useAppTheme();
  if (cycles.length === 0) return null;
  const cur = cycles[selectedIndex];
  const hasPrev = selectedIndex > 0, hasNext = selectedIndex < cycles.length - 1;
  const rel = cur && currentId ? (cur.id === currentId ? "Ciclo actual" : cur.startDate < (cycles.find((c) => c.id === currentId)?.startDate ?? "") ? "Ciclo anterior" : "Ciclo siguiente") : "Ciclo";
  const Arrow = ({ icon, enabled, onPress, label }: { icon: "chevron-back" | "chevron-forward"; enabled: boolean; onPress: () => void; label: string }) => (
    <TouchableOpacity onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12`, opacity: enabled ? 1 : 0.35 }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 6 }}>
      <Arrow icon="chevron-back" enabled={hasPrev} onPress={() => onChange(selectedIndex - 1)} label="Ciclo anterior" />
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "AsapMedium", textTransform: "uppercase", letterSpacing: 0.8 }}>{rel}</Text>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontFamily: "AsapBold" }}>{humanDate(cur!.startDate)} → {humanDate(cur!.endDate)}</Text>
      </View>
      <Arrow icon="chevron-forward" enabled={hasNext} onPress={() => onChange(selectedIndex + 1)} label="Ciclo siguiente" />
    </View>
  );
};
