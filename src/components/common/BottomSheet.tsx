import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";

const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 0.8;

/**
 * Hoja inferior de EVA. Se cierra de tres maneras: tocando fuera, con la «X», o deslizando hacia abajo desde la barrita
 * y el título (siempre) o desde el contenido cuando ya está en el tope.
 */
export default function BottomSheet({ visible, onClose, title, children, maxHeight = 0.72, scrollable = true }: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; maxHeight?: number; scrollable?: boolean;
}) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const H = Dimensions.get("window").height;
  const ty = useRef(new Animated.Value(H)).current;
  const [mounted, setMounted] = useState(visible);
  const atTop = useRef(true);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      atTop.current = true;
      ty.setValue(H);
      Animated.timing(ty, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(ty, { toValue: H, duration: 180, useNativeDriver: true }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const release = (dy: number, vy: number) => {
    if (dy > CLOSE_DISTANCE || vy > CLOSE_VELOCITY) onClose();
    else Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const makePan = (onlyAtTop: boolean) => PanResponder.create({
    onStartShouldSetPanResponder: () => !onlyAtTop,
    // Desde el contenido solo se toma el gesto si ya está arriba del todo y se arrastra hacia abajo.
    onMoveShouldSetPanResponderCapture: (_, g) => (onlyAtTop ? atTop.current && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5 : g.dy > 4),
    onMoveShouldSetPanResponder: (_, g) => (onlyAtTop ? false : g.dy > 4),
    onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
    onPanResponderRelease: (_, g) => release(g.dy, g.vy),
    onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
  });
  const headerPan = useMemo(() => makePan(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const bodyPan = useMemo(() => makePan(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const backdrop = ty.interpolate({ inputRange: [0, H], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)", opacity: backdrop }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ transform: [{ translateY: ty }], backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 8, maxHeight: `${Math.round(maxHeight * 100)}%` }}>
          <View {...headerPan.panHandlers}>
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: `${colors.text}25` }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 6, minHeight: 36 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontFamily: "AsapBold" }} accessibilityRole="header" numberOfLines={1}>{title ?? ""}</Text>
              <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <View {...bodyPan.panHandlers} style={{ flexShrink: 1 }}>
            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled" scrollEventThrottle={16} bounces={false}
                onScroll={(e) => { atTop.current = e.nativeEvent.contentOffset.y <= 0; }}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}
              >
                {children}
              </ScrollView>
            ) : <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>{children}</View>}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
