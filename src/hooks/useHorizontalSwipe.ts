import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

/**
 * Detecta gestos claramente horizontales (swipe izquierda/derecha) para cambiar sub-pestañas
 * en toda el área de la pantalla sin interferir con el scroll vertical ni con los toques.
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

  const pan = useMemo(() => {
    const isHorizontal = (dx: number, dy: number) =>
      enabledRef.current && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.6;
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, g) => isHorizontal(g.dx, g.dy),
      onMoveShouldSetPanResponder: (_evt, g) => isHorizontal(g.dx, g.dy),
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_evt, g) => {
        if (!enabledRef.current) return;
        if (g.dx < -40) leftRef.current?.();
        else if (g.dx > 40) rightRef.current?.();
      },
    });
  }, []);

  return pan.panHandlers;
}
