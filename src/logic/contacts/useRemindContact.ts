import { useState, useEffect } from "react";
import { Alert, Linking, Share } from "react-native";
import { api, errorMessage } from "../../api/client";
import { Contact } from "../../interfaces/Contact";

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

  const handleShare = async () => {
    try { await Share.share({ message }); } catch (error) { console.error(error); }
  };

  const handleWhatsApp = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert("WhatsApp", "WhatsApp no está instalado en este dispositivo");
    });
  };

  return { selectedId, setSelectedId, loading, message, handleShare, handleWhatsApp };
};
