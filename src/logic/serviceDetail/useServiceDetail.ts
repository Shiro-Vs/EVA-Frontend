import { useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { Charge } from "../../api/types";
import { useAsync, useSubmit } from "../../hooks/useAsync";
import { useFocusReload } from "../../hooks/useFocusReload";
import { todayLocalIso } from "../../utils/dates";
import { shareText } from "../../utils/share";

const SCREEN_WIDTH = Dimensions.get("window").width;
export type ServiceTab = "ciclo" | "participantes" | "historial";

/**
 * Datos y acciones de la pantalla de detalle del servicio, con la API real.
 * Reemplaza al hook anterior (basado en meses y datos de ejemplo): ahora la unidad es el CICLO del servicio.
 */
export function useServiceDetail(serviceId: string) {
  const router = useRouter();
  const sub = useAsync(() => api.subscription(serviceId), [serviceId]);
  const cycles = useAsync(() => api.cycles(serviceId), [serviceId]);
  const seats = useAsync(() => api.seats(serviceId), [serviceId]);
  const accounts = useAsync(() => api.accounts(), []);

  const [activeTab, setActiveTab] = useState<ServiceTab>("ciclo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditVisible, setEditVisible] = useState(false);
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Ciclos en orden cronológico: el carrusel navega de uno a otro.
  const ordered = useMemo(() => [...(cycles.data ?? [])].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)), [cycles.data]);
  const currentId = sub.data?.currentCycle?.id ?? null;
  const activeId = selectedId ?? currentId ?? ordered[ordered.length - 1]?.id ?? null;
  const selectedIndex = Math.max(0, ordered.findIndex((c) => c.id === activeId));
  const detail = useAsync(async () => (activeId ? api.cycle(activeId) : null), [activeId]);

  // Historial: el detalle de los ciclos ya iniciados (del más reciente al más antiguo); solo se pide al abrir esa pestaña.
  const pastIds = useMemo(() => ordered.filter((c) => c.startDate <= todayLocalIso()).reverse().slice(0, 12).map((c) => c.id), [ordered]);
  const history = useAsync(async () => (activeTab === "historial" ? Promise.all(pastIds.map((id) => api.cycle(id))) : null), [activeTab, pastIds.join(",")]);

  const reloadAll = useCallback(() => {
    void sub.reload(); void cycles.reload(); void seats.reload(); void detail.reload(); void accounts.reload(); void history.reload();
  }, [sub.reload, cycles.reload, seats.reload, detail.reload, accounts.reload, history.reload]);
  useFocusReload(reloadAll);

  const switchTab = (tab: ServiceTab) => {
    setActiveTab(tab);
    scrollViewRef.current?.scrollTo({ x: tab === "participantes" ? SCREEN_WIDTH : 0, animated: true });
  };

  const selectCycleAt = (index: number) => { const c = ordered[index]; if (c) setSelectedId(c.id); };

  const advance = useSubmit(async (key: string) => { await api.generateAhead(serviceId, 1, key); reloadAll(); });

  const reversePayment = useSubmit(async (key: string) => {
    const pid = detail.data?.supplierPayment?.id;
    if (!pid) return;
    await api.reverseSupplierPayment(pid, "Corrección del pago desde la app", key);
    setConfirmReverse(false);
    reloadAll();
  });

  const preferredAccount = (accounts.data ?? []).find((a) => a.id === sub.data?.preferredAccountId) ?? null;

  const goPay = () => {
    const cycle = detail.data;
    if (!cycle) return;
    router.push({ pathname: "/service/pay", params: { cycleId: cycle.id, serviceId, announced: cycle.announcedPrice } });
  };
  const goJoin = () => router.push({ pathname: "/service/join", params: { id: serviceId } });
  const openCharge = (c: Charge) => {
    if (Number(c.pending) > 0) router.push({ pathname: "/receipt/new", params: { contactId: c.contactId } });
    else router.push(`/contact/${c.contactId}`);
  };

  /** Prepara el texto de cobro y deja que el usuario elija cómo enviarlo (no se envía nada solo). */
  const remind = async (contactId: string) => {
    setRemindError(null);
    try {
      await shareText((await api.contactStatement(contactId)).shareText);
    } catch (e) {
      setRemindError(e instanceof Error ? e.message : "No se pudo preparar el mensaje.");
    }
  };

  return {
    sub, seats, accounts, detail, history, ordered, selectedIndex, selectCycleAt,
    activeTab, switchTab, scrollViewRef, SCREEN_WIDTH,
    isEditVisible, setEditVisible, confirmReverse, setConfirmReverse,
    advance, reversePayment, preferredAccount, remindError,
    goPay, goJoin, openCharge, remind, reloadAll, router,
  };
}
