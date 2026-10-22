import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api, errorMessage } from "../../../../api/client";
import type { Subscription } from "../../../../api/types";
import EVAModal from "../../../../components/common/EVAModal";
import { EVAInput } from "../../../../components/common/EVAInput";
import { ServiceStylePicker } from "../../../../components/v1/ServiceStylePicker";
import { useAppTheme } from "../../../../hooks/useAppTheme";

interface EditServiceModalProps {
  visible: boolean;
  onClose: () => void;
  service: Subscription;
  onSuccess: () => void;
}

/**
 * Edita lo que no afecta al dinero: nombre, ícono y color. Cambiar precio o calendario es un cambio con vigencia
 * que se implementa en la Entrega 2 (docs/especificacion/15), por eso aquí no se ofrece.
 */
export default function EditServiceModal({ visible, onClose, service, onSuccess }: EditServiceModalProps) {
  const { colors, fonts } = useAppTheme();
  const [name, setName] = useState(service.name);
  const [style, setStyle] = useState({ icon: service.icon || "receipt", color: service.color || colors.primary });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setName(service.name); setStyle({ icon: service.icon || "receipt", color: service.color || colors.primary }); setError(null); }
  }, [visible, service, colors.primary]);

  const save = async () => {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    try {
      await api.patchSubscription(service.id, { name: name.trim(), icon: style.icon, color: style.color }, service.version);
      onSuccess();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <EVAModal visible={visible} title="Editar Servicio" onClose={onClose} primaryButtonText="Guardar" onPrimaryAction={save}>
      <EVAInput label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" error={error && !name.trim() ? error : undefined} />
      <ServiceStylePicker icon={style.icon} color={style.color} onChange={setStyle} />
      {error && name.trim() ? <Text style={{ color: colors.expenseStrong, fontFamily: fonts.family.regular, fontSize: 12, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ height: 8 }} />
    </EVAModal>
  );
}
