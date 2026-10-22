import { useState, useEffect, useCallback, useMemo } from "react";
import { BackHandler } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../hooks/useAppTheme";
import { api, errorMessage } from "../../api/client";
import { Contact } from "../../interfaces/Contact";
import { cmpMoney } from "../../utils/money";
import { toUiContact } from "./adapt";

const ZERO = "0.00";
const owes = (c: Contact) => cmpMoney(c.deuda ?? ZERO, ZERO) > 0;

export const useContacts = () => {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalPending, setTotalPending] = useState(ZERO);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "debt">("name");

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRemindModalVisible, setIsRemindModalVisible] = useState(false);
  const [isAddSubModalVisible, setIsAddSubModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactDraft, setContactDraft] = useState<Omit<Contact, "id">>({ nombre: "", color: colors.primary });

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean; title: string; message: string; type: "success" | "error" | "warning"; onConfirm?: () => void;
  }>({ visible: false, title: "", message: "", type: "success" });

  const [showHistory, setShowHistory] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const fail = (e: unknown) => setAlertConfig({ visible: true, title: "No se pudo completar", message: errorMessage(e), type: "error" });

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([api.contacts(), api.summary()]);
      setContacts(list.filter((c) => c.status === "active").map(toUiContact));
      setTotalPending(summary.receivable.pending);
    } catch (e) {
      setAlertConfig({ visible: true, title: "No se pudo cargar", message: errorMessage(e), type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
    setSelectedContact(null);
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showHistory) { closeHistory(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showHistory, closeHistory]);

  const handleSaveContact = async () => {
    if (!contactDraft.nombre.trim()) {
      setAlertConfig({ visible: true, title: "Campo requerido", message: "Por favor, ingresa un nombre para el contacto.", type: "warning" });
      return;
    }
    const body = { name: contactDraft.nombre.trim(), phone: contactDraft.telefono?.trim() || null, color: contactDraft.color };
    try {
      if (editingContact) await api.patchContact(editingContact.id, body, editingContact.version ?? 1);
      else await api.createContact(body);
      const wasEditing = !!editingContact;
      setIsModalVisible(false);
      setEditingContact(null);
      await loadContacts();
      setAlertConfig({ visible: true, title: "¡Éxito!", message: `Contacto ${wasEditing ? "actualizado" : "creado"} correctamente.`, type: "success" });
    } catch (e) {
      fail(e);
    }
  };

  const handleNewContact = () => {
    setEditingContact(null);
    setContactDraft({ nombre: "", color: colors.primary });
    setIsModalVisible(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactDraft({ nombre: contact.nombre, color: contact.color, telefono: contact.telefono });
    setIsModalVisible(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (owes(contact)) {
      setAlertConfig({ visible: true, title: "No se puede archivar", message: "Este contacto tiene deudas pendientes. Cóbrale o ajusta primero.", type: "error" });
      return;
    }
    setAlertConfig({
      visible: true,
      title: "¿Archivar contacto?",
      message: `${contact.nombre} dejará de aparecer en tu lista. Su historial se conserva.`,
      type: "error",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        try { await api.archiveContact(contact.id); await loadContacts(); } catch (e) { fail(e); }
      },
    });
  };

  const filteredContacts = useMemo(() => {
    return contacts
      .filter((c) => c.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (sortBy === "name" ? a.nombre.localeCompare(b.nombre) : cmpMoney(b.deuda ?? ZERO, a.deuda ?? ZERO)));
  }, [contacts, searchQuery, sortBy]);

  const stats = useMemo(() => ({
    totalDeudaGlobal: totalPending,
    debtorCount: contacts.filter(owes).length,
    totalCount: contacts.length,
  }), [contacts, totalPending]);

  const openHistory = (contact: Contact) => { setSelectedContact(contact); setShowHistory(true); };

  return {
    contacts, loading, searchQuery, sortBy, isModalVisible, isRemindModalVisible, isAddSubModalVisible, editingContact, contactDraft,
    alertConfig, showHistory, selectedContact, historyRefreshKey, filteredContacts, stats, colors, router,
    setSearchQuery, setSortBy, setIsModalVisible, setIsRemindModalVisible, setIsAddSubModalVisible, setContactDraft, setAlertConfig,
    loadContacts, handleSaveContact, handleNewContact, handleEditContact, handleDeleteContact, closeHistory, openHistory, setHistoryRefreshKey,
  };
};
