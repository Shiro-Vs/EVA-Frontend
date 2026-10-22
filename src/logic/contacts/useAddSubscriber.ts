import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../../api/client";
import type { Subscription } from "../../api/types";
import { Contact } from "../../interfaces/Contact";

/**
 * Elegir el servicio al que se incorpora al contacto. La cuota, la fecha de ingreso y la vista previa del cálculo
 * se confirman en la pantalla de incorporación (el cálculo siempre lo hace el servidor).
 */
export const useAddSubscriber = (visible: boolean, contact: Contact | null, onClose: () => void) => {
  const router = useRouter();
  const [services, setServices] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type: "success" | "error" | "warning" }>({
    visible: false, title: "", message: "", type: "success",
  });

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.subscriptions();
      setServices(data.filter((s) => s.mode === "shared" && s.status === "active" && s.occupiedSeats < s.capacity));
    } catch (e) {
      setAlertConfig({ visible: true, title: "No se pudo cargar", message: errorMessage(e), type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) { setSelectedServiceId(null); void loadServices(); } }, [visible, loadServices]);

  const handleSave = () => {
    if (!selectedServiceId || !contact) return;
    onClose();
    router.push({ pathname: "/service/join", params: { id: selectedServiceId, contactId: contact.id } });
  };

  return { services, loading, selectedServiceId, setSelectedServiceId, alertConfig, setAlertConfig, handleSave };
};
