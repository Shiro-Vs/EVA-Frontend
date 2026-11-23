import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { Account } from "../../api/types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { moveItem } from "../../utils/accountOrder";
import { BankCard } from "./BankCard";

const LONG_PRESS_MS = 280;
const EDGE_ZONE_PX = 56;
const AUTO_SCROLL_STEP = 9;

interface ReorderableBankCardsProps {
  accounts: Account[];
  cardW: number;
  cardH: number;
  gap: number;
  hidden: boolean;
  onPressAccount: (id: string) => void;
  onPressNew: () => void;
  onReorder: (nextAccounts: Account[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

/**
 * Carrusel horizontal de tarjetas bancarias:
 * - Deslizar normal desplaza el carrusel de forma 100% nativa.
 * - Mantener presionada una tarjeta (~280ms) la levanta y permite arrastrarla para reordenar.
 * 100% compatible con OTA (Pressable + PanResponder en captura solo durante drag + Animated + expo-haptics).
 */
export function ReorderableBankCards({
  accounts,
  cardW,
  cardH,
  gap,
  hidden,
  onPressAccount,
  onPressNew,
  onReorder,
  onDragStateChange,
}: ReorderableBankCardsProps) {
  const { colors } = useAppTheme();
  const { width: screenW } = useWindowDimensions();
  const slotStep = cardW + gap;

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollXRef = useRef(0);
  const contentWidthRef = useRef(0);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingRef = useRef<{
    id: string;
    startIndex: number;
    targetIndex: number;
    startScrollX: number;
    startPageX: number;
    lastDx: number;
    lastMoveX: number;
  } | null>(null);
  const panGrantedRef = useRef(false);
  const pressPageXRef = useRef(0);

  const dragX = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const shiftMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getShiftAnim = (id: string) => {
    let v = shiftMapRef.current.get(id);
    if (!v) {
      v = new Animated.Value(0);
      shiftMapRef.current.set(id, v);
    }
    return v;
  };

  const latestRef = useRef({ accounts, slotStep, screenW, onPressAccount, onReorder, onDragStateChange });
  latestRef.current = { accounts, slotStep, screenW, onPressAccount, onReorder, onDragStateChange };

  const stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  useEffect(() => () => stopAutoScroll(), []);

  const updateNeighborShifts = (startIndex: number, targetIndex: number, list: Account[]) => {
    const step = latestRef.current.slotStep;
    list.forEach((acc, idx) => {
      if (idx === startIndex) return;
      let shift = 0;
      if (startIndex < targetIndex && idx > startIndex && idx <= targetIndex) shift = -step;
      else if (startIndex > targetIndex && idx >= targetIndex && idx < startIndex) shift = step;
      Animated.timing(getShiftAnim(acc.id), {
        toValue: shift,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const resetAllShifts = (list: Account[]) => {
    list.forEach((acc) => {
      getShiftAnim(acc.id).stopAnimation();
      getShiftAnim(acc.id).setValue(0);
    });
  };

  const recomputeDrag = () => {
    const d = draggingRef.current;
    if (!d) return;
    const { accounts: list, slotStep: step } = latestRef.current;
    const scrollDelta = scrollXRef.current - d.startScrollX;
    const totalDx = d.lastDx + scrollDelta;
    dragX.setValue(totalDx);

    const rawTarget = d.startIndex + Math.round(totalDx / step);
    const nextTarget = Math.max(0, Math.min(list.length - 1, rawTarget));
    if (nextTarget !== d.targetIndex) {
      d.targetIndex = nextTarget;
      if (Platform.OS !== "web") {
        void Haptics.selectionAsync().catch(() => {});
      }
      updateNeighborShifts(d.startIndex, nextTarget, list);
    }
  };

  const startAutoScrollIfNeeded = () => {
    if (autoScrollTimerRef.current) return;
    autoScrollTimerRef.current = setInterval(() => {
      const d = draggingRef.current;
      if (!d) {
        stopAutoScroll();
        return;
      }
      const { screenW: sw } = latestRef.current;
      const maxScroll = Math.max(0, contentWidthRef.current - sw);
      let delta = 0;
      if (d.lastMoveX > 0 && d.lastMoveX < EDGE_ZONE_PX && scrollXRef.current > 0) {
        delta = -AUTO_SCROLL_STEP;
      } else if (d.lastMoveX > sw - EDGE_ZONE_PX && scrollXRef.current < maxScroll) {
        delta = AUTO_SCROLL_STEP;
      }
      if (delta !== 0) {
        const nextX = Math.max(0, Math.min(maxScroll, scrollXRef.current + delta));
        if (nextX !== scrollXRef.current) {
          scrollXRef.current = nextX;
          scrollRef.current?.scrollTo({ x: nextX, animated: false });
          recomputeDrag();
        }
      }
    }, 16);
  };

  const beginDrag = (id: string, index: number, pageX: number) => {
    const { accounts: list, onDragStateChange: notify } = latestRef.current;
    if (list.length <= 1 || draggingRef.current) return;
    panGrantedRef.current = false;
    draggingRef.current = {
      id,
      startIndex: index,
      targetIndex: index,
      startScrollX: scrollXRef.current,
      startPageX: pageX,
      lastDx: 0,
      lastMoveX: pageX,
    };
    dragX.setValue(0);
    setDraggingId(id);
    notify?.(true);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    Animated.spring(dragScale, {
      toValue: 1.045,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
    startAutoScrollIfNeeded();
  };

  const finishDrag = (commit: boolean) => {
    stopAutoScroll();
    const d = draggingRef.current;
    draggingRef.current = null;
    panGrantedRef.current = false;
    const { accounts: list, onReorder: commitOrder, onDragStateChange: notify } = latestRef.current;

    dragX.stopAnimation();
    dragX.setValue(0);
    dragScale.stopAnimation();
    dragScale.setValue(1);
    resetAllShifts(list);
    setDraggingId(null);
    notify?.(false);

    if (commit && d && d.startIndex !== d.targetIndex) {
      const next = moveItem(list, d.startIndex, d.targetIndex);
      commitOrder(next);
    }
  };

  // El PanResponder SOLO captura el movimiento cuando ya se activó el modo arrastre por long-press.
  // Así el ScrollView horizontal funciona 100% nativo en desplazamientos normales.
  const containerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => !!draggingRef.current,
      onPanResponderTerminationRequest: () => !draggingRef.current,
      onPanResponderGrant: () => {
        panGrantedRef.current = true;
      },
      onPanResponderMove: (evt, g) => {
        const d = draggingRef.current;
        if (!d) return;
        const pageX = evt.nativeEvent.pageX ?? g.moveX;
        d.lastDx = pageX - d.startPageX;
        d.lastMoveX = pageX;
        recomputeDrag();
      },
      onPanResponderRelease: () => {
        if (draggingRef.current) finishDrag(true);
      },
      onPanResponderTerminate: () => {
        if (draggingRef.current) finishDrag(true);
      },
    }),
  ).current;

  return (
    <View {...containerPan.panHandlers} style={{ marginHorizontal: -24, marginTop: -4 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={!draggingId}
        showsHorizontalScrollIndicator={false}
        snapToInterval={draggingId ? undefined : slotStep}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x;
        }}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w;
        }}
        style={{ overflow: "visible" }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 6, gap }}
      >
        {accounts.map((a, index) => {
          const isDragging = draggingId === a.id;
          const someDragging = draggingId !== null;
          return (
            <Animated.View
              key={a.id}
              style={{
                zIndex: isDragging ? 50 : 1,
                elevation: isDragging ? 12 : 0,
                opacity: someDragging && !isDragging ? 0.72 : 1,
                transform: isDragging
                  ? [{ translateX: dragX }, { scale: dragScale }]
                  : [{ translateX: getShiftAnim(a.id) }],
                shadowColor: "#000",
                shadowOpacity: isDragging ? 0.32 : 0,
                shadowRadius: isDragging ? 14 : 0,
                shadowOffset: { width: 0, height: isDragging ? 8 : 0 },
              }}
            >
              <Pressable
                onPressIn={(evt) => {
                  pressPageXRef.current = evt.nativeEvent.pageX;
                }}
                onLongPress={(evt) => {
                  if (accounts.length <= 1) return;
                  const px = evt.nativeEvent.pageX || pressPageXRef.current;
                  beginDrag(a.id, index, px);
                }}
                delayLongPress={LONG_PRESS_MS}
                onPress={() => {
                  if (!draggingRef.current) onPressAccount(a.id);
                }}
                onPressOut={() => {
                  // Si el usuario levantó el dedo tras el long-press sin llegar a arrastrar
                  if (draggingRef.current && !panGrantedRef.current) {
                    finishDrag(false);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, mantén presionado para reordenar`}
              >
                <BankCard width={cardW} height={cardH} account={a} hidden={hidden} />
              </Pressable>
            </Animated.View>
          );
        })}

        <TouchableOpacity
          onPress={onPressNew}
          disabled={!!draggingId}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Nueva cuenta"
          style={{
            width: 104,
            height: cardH,
            borderRadius: 16,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.muted,
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            opacity: draggingId ? 0.35 : 1,
          }}
        >
          <Ionicons name="add" size={22} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: "AsapBold" }}>Nueva cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
