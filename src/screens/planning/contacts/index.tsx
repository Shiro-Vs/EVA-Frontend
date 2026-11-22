import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
    contacts,
    archivedContacts,
    loading,
    statusFilter,
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
    setStatusFilter,
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
    handleArchiveContact,
    handleRestoreContact,
    handleDeleteContact,
    openHistory,
    closeHistory,
    setHistoryRefreshKey,
  } = useContacts();

  const [menuFor, setMenuFor] = useState<Contact | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { action } = useLocalSearchParams<{ action?: string }>();
  useEffect(() => {
    if (action === "add") {
      handleNewContact();
      router.setParams({ action: undefined } as never);
    }
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (fn: (c: Contact) => void) => { const c = menuFor; setMenuFor(null); if (c) setTimeout(() => fn(c), 0); };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadContacts(); } finally { setRefreshing(false); }
  };

  // Mantener actualizado el contacto mostrado en el perfil si se edita desde ahí.
  const liveSelectedContact = selectedContact
    ? (contacts.find((c) => c.id === selectedContact.id)
      ?? archivedContacts.find((c) => c.id === selectedContact.id)
      ?? selectedContact)
    : null;

  const activeDebtors = contacts.filter((c) => cmpMoney(c.deuda ?? "0.00", "0.00") > 0);

  if (loading && filteredContacts.length === 0) {
    return <EVALoading message="Cargando contactos..." />;
  }

  // Vista de Perfil unificado de la persona
  if (showHistory && liveSelectedContact) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ContactHistory
          contact={liveSelectedContact}
          onBack={closeHistory}
          onAddServicePress={() => setIsAddSubModalVisible(true)}
          onEditPress={() => handleEditContact(liveSelectedContact)}
          refreshTrigger={historyRefreshKey}
        />
        <AddSubscriberModal
          visible={isAddSubModalVisible}
          onClose={() => setIsAddSubModalVisible(false)}
          contact={liveSelectedContact}
          onSuccess={() => setHistoryRefreshKey((prev) => prev + 1)}
        />
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
          onClose={alertConfig.onConfirm || (() => setAlertConfig((prev) => ({ ...prev, visible: false })))}
          secondaryButtonText={alertConfig.onConfirm ? "Cancelar" : undefined}
          onSecondaryAction={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
          onDismiss={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
          horizontalButtons={!!alertConfig.onConfirm}
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 14 }}>
          {!asTab && (
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 24, fontFamily: fonts.family.bold }}>{asTab ? "Personas" : "Mis contactos"}</Text>
          <Button title={asTab ? "Nueva" : "Nuevo"} icon="add" size="compact" onPress={handleNewContact} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          contentContainerStyle={{ gap: 14, paddingBottom: asTab ? 120 : 24 }}
        >
          <ContactsHeader totalDeuda={stats.totalDeudaGlobal} count={stats.totalCount} debtorCount={stats.debtorCount} onRemindPress={() => setIsRemindModalVisible(true)} />

          {asTab && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push("/loans" as never)}
                activeOpacity={0.75}
                accessibilityRole="button"
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: `${colors.text}08` }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: fonts.family.bold }}>Préstamos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/refunds" as never)}
                activeOpacity={0.75}
                accessibilityRole="button"
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: `${colors.text}08` }}
              >
                <Ionicons name="return-down-back-outline" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: fonts.family.bold }}>Devoluciones</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card }}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput placeholder="Buscar persona…" placeholderTextColor={colors.muted} accessibilityLabel="Buscar persona" style={{ flex: 1, color: colors.text, fontFamily: fonts.family.regular, fontSize: 15 }} value={searchQuery} onChangeText={setSearchQuery} />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setSortBy(sortBy === "name" ? "debt" : "name")} accessibilityRole="button" accessibilityLabel={sortBy === "name" ? "Ordenado de la A a la Z; cambiar a deuda" : "Ordenado por deuda; cambiar a A-Z"}
              style={{ height: 44, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.primary}1A` }}>
              <Ionicons name={sortBy === "name" ? "text" : "trending-down"} size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fonts.family.bold }}>{sortBy === "name" ? "A-Z" : "Deuda"}</Text>
            </TouchableOpacity>
          </View>

          {stats.archivedCount > 0 && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {([["active", `Activos (${stats.totalCount})`], ["archived", `Archivados (${stats.archivedCount})`]] as const).map(([id, label]) => {
                const on = statusFilter === id;
                return (
                  <TouchableOpacity key={id} onPress={() => setStatusFilter(id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 99, justifyContent: "center", backgroundColor: on ? colors.primarySurface : `${colors.primary}12` }}>
                    <Text style={{ color: on ? colors.onPrimary : colors.primary, fontSize: 12, fontFamily: fonts.family.bold }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <ContactList contacts={filteredContacts} onContactPress={openHistory} onMenuPress={setMenuFor} />
        </ScrollView>
      </View>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.nombre} maxHeight={0.55}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
          <MenuRow icon="person-outline" title="Ver perfil" onPress={() => pick((c) => openHistory(c))} />
          <MenuRow icon="create-outline" title="Editar" onPress={() => pick(handleEditContact)} />
          {statusFilter === "archived" ? (
            <MenuRow icon="refresh-outline" title="Restaurar" text="Vuelve a aparecer en tu lista activa" onPress={() => pick(handleRestoreContact)} />
          ) : (
            <MenuRow icon="archive-outline" title="Archivar" text="Deja de aparecer en tu lista activa" onPress={() => pick(handleArchiveContact)} />
          )}
          <MenuRow icon="trash-outline" title="Eliminar" text="Solo si no tiene historial ni servicios" danger onPress={() => pick(handleDeleteContact)} />
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
        debtors={activeDebtors}
      />
    </SafeAreaView>
  );
}
