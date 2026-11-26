import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

/**
 * Detecta gestos claramente horizontales (swipe izquierda/derecha) para cambiar sub-pestañas
 * sin interferir con el scroll vertical ni con los toques en tarjetas o botones.
 */
export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
}) {
  const leftRef = useRef(onSwipeLeft);
  const rightRef = useRef(onSwipeRight);
  const enabledRef = useRef(enabled);
  leftRef.current = onSwipeLeft;
  rightRef.current = onSwipeRight;
  enabledRef.current = enabled;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          enabledRef.current && Math.abs(g.dx) > 22 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_evt, g) => {
          if (!enabledRef.current) return;
          if (g.dx < -45) leftRef.current?.();
          else if (g.dx > 45) rightRef.current?.();
        },
      }),
    [],
  );

  return pan.panHandlers;
}
