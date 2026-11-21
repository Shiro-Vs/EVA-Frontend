import React, { useEffect, useState } from "react";
import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { session } from "../../api/http";
import * as sb from "../../api/supabaseAuth";
import { Button, Card, Field, Heading, Notice, Screen, Txt } from "../../components/v1/ui";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubmit } from "../../hooks/useAsync";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DATA_URL_LEN = 480_000;

export function ProfileSettingsScreen() {
  const { colors } = useAppTheme();
  const { profile, setProfile, refreshProfile } = useAuth();
  const dialog = useDialog();

  const [name, setName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatarUrl ?? null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState(false);

  const [email, setEmail] = useState(profile?.email ?? "");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    void refreshProfile().then((p) => {
      if (!p) return;
      setName((cur) => (cur ? cur : p.displayName));
      setEmail((cur) => (cur ? cur : p.email ?? ""));
      setAvatar((cur) => (avatarDirty ? cur : (p.avatarUrl ?? null)));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPhoto = async (source: "library" | "camera") => {
    setPhotoError(null);
    setSavedProfile(false);
    try {
      if (Platform.OS !== "web") {
        const perm = source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPhotoError(source === "camera" ? "Necesitamos permiso de cámara para tomar la foto." : "Necesitamos permiso para abrir tu galería.");
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (!asset.base64) {
        setPhotoError("No se pudo leer la imagen elegida. Prueba con otra foto.");
        return;
      }
      const mime = asset.mimeType && /^image\/(jpeg|jpg|png|webp)$/i.test(asset.mimeType) ? asset.mimeType.toLowerCase() : "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      if (dataUrl.length > MAX_DATA_URL_LEN) {
        setPhotoError("La foto es muy pesada. Recórtala un poco más o elige una imagen más ligera.");
        return;
      }
      setAvatar(dataUrl);
      setAvatarDirty(true);
    } catch {
      setPhotoError("No se pudo abrir la imagen. Inténtalo de nuevo.");
    }
  };

  const removePhoto = () => {
    setPhotoError(null);
    setSavedProfile(false);
    setAvatar(null);
    setAvatarDirty(true);
  };

  const nameChanged = name.trim().length > 0 && name.trim() !== (profile?.displayName ?? "");
  const profileDirty = nameChanged || avatarDirty;

  const saveProfile = useSubmit(async () => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Escribe tu nombre.");
    const latest = (await refreshProfile()) ?? profile;
    if (!latest) throw new Error("No se pudo cargar tu perfil.");
    const patch: { displayName?: string; avatarDataUrl?: string | null } = {};
    if (trimmed !== latest.displayName) patch.displayName = trimmed;
    if (avatarDirty) patch.avatarDataUrl = avatar;
    if (Object.keys(patch).length === 0) return latest;
    const updated = await api.patchMe(patch, latest.version);
    setProfile(updated);
    setAvatarDirty(false);
    setSavedProfile(true);
    // Sincronizar nombre en Supabase Auth en segundo plano (best-effort)
    if (patch.displayName && sb.supabaseConfigured()) {
      const token = await session.getToken();
      if (token) void sb.updateUser(token, { fullName: patch.displayName }).catch(() => {});
    }
    return updated;
  });

  const emailTrim = email.trim().toLowerCase();
  const currentEmail = (profile?.email ?? "").trim().toLowerCase();
  const emailValid = EMAIL_RE.test(emailTrim);
  const emailChanged = emailValid && emailTrim !== currentEmail;

  const saveEmail = useSubmit(async () => {
    if (!sb.supabaseConfigured()) {
      throw new Error("El cambio de correo solo está disponible con inicio de sesión de Supabase.");
    }
    if (!emailValid) throw new Error("Escribe un correo electrónico válido.");
    const ok = await dialog.confirm({
      title: "¿Cambiar correo electrónico?",
      message: `Se enviará un enlace de confirmación a ${emailTrim}. Tu correo se actualizará cuando lo confirmes.`,
      confirmLabel: "Enviar confirmación",
    });
    if (!ok) return null;
    const token = await session.getToken();
    if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");
    await sb.updateUser(token, { email: emailTrim });
    setEmailSent(true);
    return true;
  });

  const initial = (name.trim() || profile?.displayName || "E").charAt(0).toUpperCase();

  return (
    <Screen title="Editar perfil" subtitle="Nombre, foto y correo">
      <Card style={{ alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => void pickPhoto("library")} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" style={{ position: "relative" }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.elevated }} />
          ) : (
            <View style={{ width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySurface }}>
              <Text style={{ color: colors.onPrimary, fontSize: 36, fontFamily: "AsapBold" }}>{initial}</Text>
            </View>
          )}
          <View style={{ position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card }}>
            <Ionicons name="camera-outline" size={16} color={colors.onPrimary} />
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <Button title="Galería" icon="images-outline" variant="secondary" size="small" onPress={() => void pickPhoto("library")} />
          {Platform.OS !== "web" && <Button title="Cámara" icon="camera-outline" variant="secondary" size="small" onPress={() => void pickPhoto("camera")} />}
          {avatar && <Button title="Quitar" icon="trash-outline" variant="secondary" size="small" onPress={removePhoto} />}
        </View>
        {photoError && <Notice tone="err">{photoError}</Notice>}
      </Card>

      <Heading>Datos personales</Heading>
      <Card>
        <Field label="Nombre" value={name} onChangeText={(v) => { setName(v); setSavedProfile(false); }} placeholder="Tu nombre" autoCapitalize="words" maxLength={80} />
        <Button title="Guardar cambios" busy={saveProfile.busy} disabled={!profileDirty || !name.trim()} onPress={saveProfile.submit} />
        {savedProfile && <Notice tone="ok">Perfil actualizado.</Notice>}
        {saveProfile.error && <Notice tone="err">{saveProfile.error}</Notice>}
      </Card>

      <Heading>Correo electrónico</Heading>
      <Card>
        <Field
          label="Correo de tu cuenta"
          value={email}
          onChangeText={(v) => { setEmail(v); setEmailSent(false); }}
          placeholder="tu@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Txt size={12} muted>Al cambiarlo te llegará un enlace de confirmación por correo para verificar que eres tú.</Txt>
        <Button title="Cambiar correo" variant="secondary" busy={saveEmail.busy} disabled={!emailChanged} onPress={saveEmail.submit} />
        {emailSent && <Notice tone="ok">Listo: revisa tu bandeja de entrada para confirmar el cambio de correo.</Notice>}
        {saveEmail.error && <Notice tone="err">{saveEmail.error}</Notice>}
      </Card>
    </Screen>
  );
}
