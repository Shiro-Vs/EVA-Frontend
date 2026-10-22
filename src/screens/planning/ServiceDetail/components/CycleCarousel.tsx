import React from "react";
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import type { CycleRef } from "../../../../api/types";
import { humanDate } from "../../../../utils/dates";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// El contenedor de ServiceHistory tiene 24 de padding horizontal por lado: ancho útil = SCREEN_WIDTH - 48
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 3;

interface CycleCarouselProps {
  cycles: CycleRef[]; // en orden cronológico
  selectedIndex: number;
  onChange: (index: number) => void;
}

/** Selector de ciclo: el anterior, el actual y el siguiente (equivale al carrusel de meses de antes). */
export const CycleCarousel: React.FC<CycleCarouselProps> = ({ cycles, selectedIndex, onChange }) => {
  const { colors } = useAppTheme();
  if (cycles.length === 0) return null;

  const render = (item: CycleRef | undefined, index: number, isCenter: boolean) => {
    if (!item) return <View style={{ width: ITEM_WIDTH }} />;
    return (
      <TouchableOpacity
        onPress={() => { if (!isCenter) onChange(index); }}
        style={{ width: ITEM_WIDTH, alignItems: "center", justifyContent: "center" }}
        activeOpacity={isCenter ? 1 : 0.6}
        accessibilityRole="button"
        accessibilityLabel={`Ciclo desde el ${humanDate(item.startDate)}`}
      >
        <Text style={{
          color: isCenter ? colors.primary : colors.textSecondary, fontFamily: isCenter ? "AsapBold" : "AsapSemiBold",
          fontSize: isCenter ? 16 : 12, textAlign: "center", opacity: isCenter ? 1 : 0.4, transform: [{ scale: isCenter ? 1.1 : 0.9 }],
        }}>
          {humanDate(item.startDate)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {render(cycles[selectedIndex - 1], selectedIndex - 1, false)}
        {render(cycles[selectedIndex], selectedIndex, true)}
        {render(cycles[selectedIndex + 1], selectedIndex + 1, false)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({ container: { height: 36, justifyContent: "center" } });
