import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { api, errorMessage } from "../../api/client";
import { Contact } from "../../interfaces/Contact";
import { openWhatsApp, shareText } from "../../utils/share";

export const useRemindContact = (visible: boolean, debtors: Contact[]) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (visible && debtors.length > 0) setSelectedId((cur) => (cur && debtors.some((d) => d.id === cur) ? cur : debtors[0].id));
  }, [visible, debtors]);

  useEffect(() => {
    if (!visible || !selectedId) return;
    let cancelled = false;
    setLoading(true);
    // El texto lo arma el servidor (estado de cuenta discreto); EVA nunca envía nada por su cuenta.
    api.contactStatement(selectedId)
      .then((st) => { if (!cancelled) setMessage(st.shareText); })
      .catch((e) => { if (!cancelled) setMessage(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, selectedId]);

  const selectedContact = debtors.find((d) => d.id === selectedId) ?? null;

  const handleShare = async () => {
    try { await shareText(message); } catch (error) { console.error(error); }
  };

  const handleWhatsApp = async () => {
    const ok = await openWhatsApp(message, selectedContact?.telefono);
    if (!ok) {
      Alert.alert("WhatsApp", "No se pudo abrir WhatsApp en este dispositivo.");
    }
  };

  return { selectedId, setSelectedId, selectedContact, loading, message, handleShare, handleWhatsApp };
};
