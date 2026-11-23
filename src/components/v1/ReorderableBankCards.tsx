import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
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

const LONG_PRESS_MS = 260;
const MOVE_CANCEL_PX = 8;
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
 * Carrusel horizontal de tarjetas bancarias con reordenamiento por mantener presionado y deslizar.
 * 100% compatible con OTA (usa Animated + PanResponder + expo-haptics).
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
    lastDx: number;
    lastMoveX: number;
  } | null>(null);

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

  // Mantener referencias frescas para los callbacks del PanResponder.
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

  const beginDrag = (id: string, index: number, moveX: number) => {
    const { accounts: list, onDragStateChange: notify } = latestRef.current;
    if (list.length <= 1) return;
    draggingRef.current = {
      id,
      startIndex: index,
      targetIndex: index,
      startScrollX: scrollXRef.current,
      lastDx: 0,
      lastMoveX: moveX,
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

  return (
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
      style={{ marginHorizontal: -24, marginTop: -4, overflow: "visible" }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 6, gap }}
    >
      {accounts.map((a, index) => {
        const isDragging = draggingId === a.id;
        const someDragging = draggingId !== null;
        return (
          <DraggableCardSlot
            key={a.id}
            account={a}
            index={index}
            cardW={cardW}
            cardH={cardH}
            hidden={hidden}
            canDrag={accounts.length > 1}
            isDragging={isDragging}
            dimmed={someDragging && !isDragging}
            dragX={dragX}
            dragScale={dragScale}
            shiftX={getShiftAnim(a.id)}
            onBeginDrag={beginDrag}
            onMoveDrag={(dx, moveX) => {
              if (!draggingRef.current) return;
              draggingRef.current.lastDx = dx;
              draggingRef.current.lastMoveX = moveX;
              recomputeDrag();
            }}
            onEndDrag={finishDrag}
            onTap={() => onPressAccount(a.id)}
          />
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
  );
}

interface DraggableCardSlotProps {
  account: Account;
  index: number;
  cardW: number;
  cardH: number;
  hidden: boolean;
  canDrag: boolean;
  isDragging: boolean;
  dimmed: boolean;
  dragX: Animated.Value;
  dragScale: Animated.Value;
  shiftX: Animated.Value;
  onBeginDrag: (id: string, index: number, moveX: number) => void;
  onMoveDrag: (dx: number, moveX: number) => void;
  onEndDrag: (commit: boolean) => void;
  onTap: () => void;
}

function DraggableCardSlot({
  account,
  index,
  cardW,
  cardH,
  hidden,
  canDrag,
  isDragging,
  dimmed,
  dragX,
  dragScale,
  shiftX,
  onBeginDrag,
  onMoveDrag,
  onEndDrag,
  onTap,
}: DraggableCardSlotProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const movedRef = useRef(false);
  const startPageXRef = useRef(0);

  const propsRef = useRef({ account, index, canDrag, onBeginDrag, onMoveDrag, onEndDrag, onTap });
  propsRef.current = { account, index, canDrag, onBeginDrag, onMoveDrag, onEndDrag, onTap };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => activeRef.current,
      onPanResponderTerminationRequest: () => !activeRef.current,
      onPanResponderGrant: (evt) => {
        activeRef.current = false;
        movedRef.current = false;
        startPageXRef.current = evt.nativeEvent.pageX;
        clearTimer();
        if (propsRef.current.canDrag) {
          timerRef.current = setTimeout(() => {
            activeRef.current = true;
            propsRef.current.onBeginDrag(
              propsRef.current.account.id,
              propsRef.current.index,
              startPageXRef.current,
            );
          }, LONG_PRESS_MS);
        }
      },
      onPanResponderMove: (_evt, g) => {
        if (!activeRef.current) {
          if (Math.abs(g.dx) > MOVE_CANCEL_PX || Math.abs(g.dy) > MOVE_CANCEL_PX) {
            movedRef.current = true;
            clearTimer();
          }
          return;
        }
        propsRef.current.onMoveDrag(g.dx, g.moveX);
      },
      onPanResponderRelease: () => {
        clearTimer();
        if (activeRef.current) {
          activeRef.current = false;
          propsRef.current.onEndDrag(true);
        } else if (!movedRef.current) {
          propsRef.current.onTap();
        }
      },
      onPanResponderTerminate: () => {
        clearTimer();
        if (activeRef.current) {
          activeRef.current = false;
          propsRef.current.onEndDrag(true);
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, mantén presionado para reordenar`}
      style={{
        zIndex: isDragging ? 50 : 1,
        elevation: isDragging ? 12 : 0,
        opacity: dimmed ? 0.72 : 1,
        transform: isDragging
          ? [{ translateX: dragX }, { scale: dragScale }]
          : [{ translateX: shiftX }],
        shadowColor: "#000",
        shadowOpacity: isDragging ? 0.32 : 0,
        shadowRadius: isDragging ? 14 : 0,
        shadowOffset: { width: 0, height: isDragging ? 8 : 0 },
      }}
    >
      <BankCard width={cardW} height={cardH} account={account} hidden={hidden} />
    </Animated.View>
  );
}
