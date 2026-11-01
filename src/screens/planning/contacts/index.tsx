import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useContacts } from "../../../logic/contacts/useContacts";

import EVAAlert from "../../../components/common/EVAAlert";
import { EVALoading } from "../../../components/common/EVALoading";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { cmpMoney } from "../../../utils/money";
import BottomSheet from "../../../components/common/BottomSheet";
import { Button, MenuRow } from "../../../components/v1/ui";
import type { Contact } from "../../../interfaces/Contact";

// Importaciones de componentes
import { ContactsHeader } from "./components/ContactsHeader";
import { ContactList } from "./components/ContactList";
import { ContactModal } from "./components/ContactModal";
import { ContactHistory } from "./components/ContactHistory";
import { RemindModal } from "./components/RemindModal";
import { AddSubscriberModal } from "./components/AddSubscriberModal";

export default function ContactsScreen({ asTab = false }: { asTab?: boolean } = {}) {
  const { fonts } = useAppTheme();
  const {
    loading,
    searchQuery,
    sortBy,
    isModalVisible,
    isRemindModalVisible,
    isAddSubModalVisible,
    editingContact,
    contactDraft,
    alertConfig,
    showHistory,
    selectedContact,
    historyRefreshKey,
    filteredContacts,
    stats,
    colors,
    router,
    setSearchQuery,
    setSortBy,
    setIsModalVisible,
    setIsRemindModalVisible,
    setIsAddSubModalVisible,
    setContactDraft,
    setAlertConfig,
    loadContacts,
    handleSaveContact,
    handleNewContact,
    handleEditContact,
    handleDeleteContact,
    openHistory,
    closeHistory,
    setHistoryRefreshKey,
  } = useContacts();

  const [menuFor, setMenuFor] = useState<Contact | null>(null);
  const pick = (fn: (c: Contact) => void) => { const c = menuFor; setMenuFor(null); if (c) setTimeout(() => fn(c), 0); };

  if (loading && filteredContacts.length === 0) {
    return <EVALoading message="Cargando contactos..." />;
  }

  // Vista de Historial
  if (showHistory && selectedContact) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ContactHistory
          contact={selectedContact}
          onBack={closeHistory}
          onAddServicePress={() => setIsAddSubModalVisible(true)}
          refreshTrigger={historyRefreshKey}
        />
        <AddSubscriberModal
          visible={isAddSubModalVisible}
          onClose={() => setIsAddSubModalVisible(false)}
          contact={selectedContact}
          onSuccess={() => setHistoryRefreshKey((prev) => prev + 1)}
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 14 }}>
          {!asTab && (
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Text style={{ flex: 1, color: colors.text, fontSize: 24, fontFamily: fonts.family.bold }}>{asTab ? "Personas" : "Mis contactos"}</Text>
          <View style={{ minWidth: 104 }}><Button title="Nueva" icon="add" size="compact" onPress={handleNewContact} /></View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ gap: 14, paddingBottom: asTab ? 120 : 24 }}>
          <ContactsHeader totalDeuda={stats.totalDeudaGlobal} count={stats.totalCount} debtorCount={stats.debtorCount} onRemindPress={() => setIsRemindModalVisible(true)} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card }}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput placeholder="Buscar persona…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.text, fontFamily: fonts.family.regular, fontSize: 15 }} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity onPress={() => setSortBy(sortBy === "name" ? "debt" : "name")} accessibilityRole="button" accessibilityLabel={sortBy === "name" ? "Ordenado de la A a la Z; cambiar a deuda" : "Ordenado por deuda; cambiar a A-Z"}
              style={{ height: 44, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.primary}1A` }}>
              <Ionicons name={sortBy === "name" ? "text" : "trending-down"} size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.family.bold }}>{sortBy === "name" ? "A-Z" : "Deuda"}</Text>
            </TouchableOpacity>
          </View>

          <ContactList contacts={filteredContacts} onContactPress={openHistory} onMenuPress={setMenuFor} />

          {asTab && (
            <View style={{ gap: 10, marginTop: 4 }}>
              <MenuRow section="people" icon="return-down-back-outline" title="Devoluciones" text="Dinero que debes devolver a alguien" onPress={() => router.push("/refunds" as never)} />
              <MenuRow section="people" icon="people-outline" title="Préstamos entre personas" text="Lo que prestaste o te prestaron" onPress={() => router.push("/loans" as never)} />
            </View>
          )}
        </ScrollView>
      </View>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.nombre} maxHeight={0.5}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
          <MenuRow icon="time-outline" title="Ver historial" onPress={() => pick((c) => openHistory(c))} />
          <MenuRow icon="create-outline" title="Editar" onPress={() => pick(handleEditContact)} />
          <MenuRow icon="archive-outline" title="Archivar" text="Deja de aparecer en tu lista" danger onPress={() => pick(handleDeleteContact)} />
        </View>
      </BottomSheet>

      {/* Modales */}
      <ContactModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleSaveContact}
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        isEditing={!!editingContact}
      />

      <EVAAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttonText={alertConfig.onConfirm ? "Confirmar" : "Entendido"}
        onClose={
          alertConfig.onConfirm ||
          (() => setAlertConfig((prev) => ({ ...prev, visible: false })))
        }
        secondaryButtonText={alertConfig.onConfirm ? "Cancelar" : undefined}
        onSecondaryAction={() =>
          setAlertConfig((prev) => ({ ...prev, visible: false }))
        }
        onDismiss={() =>
          setAlertConfig((prev) => ({ ...prev, visible: false }))
        }
        horizontalButtons={!!alertConfig.onConfirm}
      />

      <RemindModal
        visible={isRemindModalVisible}
        onClose={() => setIsRemindModalVisible(false)}
        debtors={filteredContacts.filter((c) => cmpMoney(c.deuda ?? "0.00", "0.00") > 0)}
      />
    </SafeAreaView>
  );
}
