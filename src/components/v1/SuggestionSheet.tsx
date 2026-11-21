import React, { useState } from "react";
import { Keyboard, Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { api } from "../../api/client";
import BottomSheet from "../common/BottomSheet";
import { Button, Field, Notice, Txt } from "./ui";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { DEV_EMAIL, mailtoLink, whatsappLink } from "../../constants/contact";

type Kind = "idea" | "problem" | "other";
const KINDS: Array<{ id: Kind; label: string }> = [{ id: "idea", label: "Idea" }, { id: "problem", label: "Algo no funciona" }, { id: "other", label: "Otro" }];
const MAX = 2000;

/** Hoja para enviar una sugerencia o reporte al desarrollador: le llega por correo con el nombre y el correo de la cuenta. */
export function SuggestionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const dialog = useDialog();
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setError("");
    const text = message.trim();
    if (text.length < 5) return setError("Cuéntame un poco más (al menos 5 caracteres).");
    setBusy(true);
    try {
      await api.sendSuggestion({ kind, message: text, appVersion: Constants.expoConfig?.version, platform: `${Platform.OS} ${Platform.Version}` });
      setMessage("");
      Keyboard.dismiss();
      onClose();
      await dialog.success("¡Gracias!", "Recibí tu sugerencia y la voy a revisar pronto.");
    } catch (e) {
      setError((e as Error).message || "No se pudo enviar. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { await dialog.notify({ kind: "info", title: "No se pudo abrir", message: `Escríbeme a ${DEV_EMAIL}.` }); }
  };
  const who = profile?.displayName ? `Hola, soy ${profile.displayName}. ` : "Hola. ";

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sugerencias" maxHeight={0.92}>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 12 }}>
        <Notice tone="info">EVA es una app en desarrollo: tus sugerencias se revisan con rapidez.</Notice>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {KINDS.map((k) => {
            const on = kind === k.id;
            return (
              <TouchableOpacity key={k.id} onPress={() => setKind(k.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} activeOpacity={0.8}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={{ flex: 1, minHeight: 40, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.primarySurface : `${colors.primary}14` }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 12.5, fontFamily: "AsapBold" }}>{k.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View>
          <Field value={message} onChangeText={(t) => { setMessage(t.slice(0, MAX)); if (error) setError(""); }} multiline numberOfLines={5} maxLength={MAX}
            placeholder="Cuéntame qué mejorarías o qué no funciona…" textAlignVertical="top" style={{ minHeight: 110, paddingTop: 10 }} />
          <Txt size={11} muted style={{ textAlign: "right", marginTop: -6 }}>{message.length}/{MAX}</Txt>
        </View>

        {error ? <Notice tone="err">{error}</Notice> : null}
        <Button title="Enviar sugerencia" icon="paper-plane-outline" busy={busy} onPress={send} />
        {profile?.email ? <Txt size={11} muted style={{ textAlign: "center", marginTop: -4 }}>Se envía con tu cuenta ({profile.email}) para poder responderte.</Txt> : null}

        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 }}>
          <Txt size={13} muted>¿Prefieres escribirme directo?</Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Correo" icon="mail-outline" variant="outline" size="compact" onPress={() => open(mailtoLink("Sugerencia de EVA"))} /></View>
            <View style={{ flex: 1 }}><Button title="WhatsApp" icon="logo-whatsapp" variant="outline" size="compact" onPress={() => open(whatsappLink(`${who}Te escribo desde la app EVA: `))} /></View>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
