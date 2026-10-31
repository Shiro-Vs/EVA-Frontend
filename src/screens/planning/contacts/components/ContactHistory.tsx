import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "../../../../components/v1/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../hooks/useAppTheme";
import { EVALoading } from "../../../../components/common/EVALoading";
import { EVASeparator } from "../../../../components/common/EVASeparator";
import { EVAActionButton } from "../../../../components/common/EVAActionButton";
import { EVAAvatar } from "../../../../components/common/EVAAvatar";
import { Contact } from "../../../../interfaces/Contact";
import { useContactHistory } from "../../../../logic/contacts/useContactHistory";
import { ServiceIcon } from "../../../../utils/serviceIcons";
import { cmpMoney, formatSoles } from "../../../../utils/money";

interface ContactHistoryProps {
  contact: Contact;
  onBack: () => void;
  onAddServicePress: () => void;
  refreshTrigger?: number;
}

export function ContactHistory({
  contact,
  onBack,
  onAddServicePress,
  refreshTrigger,
}: ContactHistoryProps) {
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const { loading, error, summary, expandedServices, toggleService } = useContactHistory(contact, refreshTrigger);
  const owes = (v: string) => cmpMoney(v, "0.00") > 0;

  if (loading) {
    return <EVALoading message="Cargando historial..." />;
  }

  if (!summary || !summary.services) {
    return (
      <SafeAreaView 
        className="flex-1"
        style={{ backgroundColor: colors.background }}
      >
        <View className="px-6 pt-4">
          <TouchableOpacity 
            onPress={onBack} 
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.text}05` }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text 
            className="mt-10 text-center"
            style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
          >
            {error ?? "No se pudo cargar la información."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-1">
        {/* Header - DISEÑO IDENTICO A SERVICIO */}
        <View 
          className="px-6 pt-4"
          style={{ backgroundColor: colors.background }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={onBack}
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.text}05` }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onAddServicePress}
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: `${colors.primary}15` }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-6">
            <EVAAvatar 
              name={contact.nombre} 
              color={contact.color} 
              size={64} 
              fontSize={28}
              className="mr-4"
            />

            {/* Nombre y Detalles a la derecha del logo */}
            <View className="flex-1">
              <Text 
                className="text-2xl"
                style={{ color: colors.text, fontFamily: fonts.family.bold }}
              >
                {contact.nombre}
              </Text>
              <Text 
                className="text-sm mt-1"
                style={{ color: owes(summary.totalDebt) ? ((colors as any).expenseStrong || colors.expense) : ((colors as any).incomeStrong || colors.income), fontFamily: fonts.family.bold }}
              >
                {formatSoles(summary.totalDebt)} • <Text style={{ color: colors.textSecondary, fontFamily: fonts.family.medium }}>{summary.services.length} {summary.services.length === 1 ? 'servicio' : 'servicios'}</Text>
              </Text>
              <Text 
                className="text-xs mt-0.5 mb-1"
                style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
              >
                Estado: {owes(summary.totalDebt) ? 'Con deudas pendientes' : 'Al día'}
              </Text>
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                <Text 
                  className="text-xs ml-1"
                  style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
                >
                  Miembro de Mis Contactos
                </Text>
              </View>
            </View>
          </View>

          {/* Línea Divisoria de Ancho Completo */}
          <EVASeparator className="mb-2" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="px-6">
          {summary.services.length === 0 ? (
            <View className="items-center justify-center py-20">
              <View 
                className="w-20 h-20 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.card }}
              >
                <Ionicons name="document-text-outline" size={32} color={colors.muted} />
              </View>
              <Text 
                className="text-center px-10"
                style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
              >
                Este contacto aún no participa en ningún servicio. ¡Dale al botón de + Servicio para empezar!
              </Text>
            </View>
          ) : (
            summary.services.map((service: any) => {
              const isExpanded = !!expandedServices[service.serviceId];
              return (
                <View 
                  key={service.serviceId} 
                  className="rounded-3xl mb-4 shadow-sm overflow-hidden"
                  style={{ 
                    backgroundColor: colors.card, 
                    shadowColor: "#000", 
                    shadowOpacity: 0.05,
                    borderWidth: 1,
                    borderColor: `${colors.text}05`
                  }}
                >
                  <TouchableOpacity 
                    onPress={() => toggleService(service.serviceId)}
                    activeOpacity={0.7}
                    className="p-5 flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center flex-1">
                      <View 
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${service.color}15` }}
                      >
                        <ServiceIcon name={service.icon} size={20} color={service.color} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text 
                          className="text-base" 
                          style={{ color: colors.text, fontFamily: fonts.family.bold }}
                          numberOfLines={1}
                        >
                          {service.serviceName}
                        </Text>
                        {owes(service.debt) ? (
                          <Text 
                            className="text-[10px] uppercase"
                            style={{ color: (colors as any).expenseStrong || colors.expense, fontFamily: fonts.family.semiBold }}
                          >
                            {service.overdueCount > 0 ? `${service.overdueCount} ${service.overdueCount === 1 ? 'cobro vencido' : 'cobros vencidos'}` : 'Pendiente'}
                          </Text>
                        ) : (
                          <Text 
                            className="text-[10px] uppercase"
                            style={{ color: (colors as any).incomeStrong || colors.income, fontFamily: fonts.family.semiBold }}
                          >
                            Al día
                          </Text>
                        )}
                      </View>
                    </View>

                    <View className="flex-row items-center">
                      <Text 
                        className="text-lg mr-3"
                        style={{ color: owes(service.debt) ? ((colors as any).expenseStrong || colors.expense) : colors.text, fontFamily: fonts.family.bold }}
                      >
                        {formatSoles(service.debt)}
                      </Text>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={colors.muted} 
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View 
                      className="px-5 pb-5 pt-0"
                      style={{ backgroundColor: `${colors.background}60` }}
                    >
                      <View 
                        className="h-[1px] w-full mb-3" 
                        style={{ backgroundColor: `${colors.text}05` }}
                      />
                      {(service.history || []).map((pay: any, idx: number) => (
                        <View 
                          key={idx} 
                          className="flex-row justify-between items-center py-2.5"
                          style={{ 
                            borderBottomWidth: idx !== service.history.length - 1 ? 1 : 0,
                            borderBottomColor: `${colors.text}05`
                          }}
                        >
                          <Text 
                            className="text-xs"
                            style={{ color: colors.textSecondary, fontFamily: fonts.family.regular }}
                          >
                            {pay.mes_anio}
                          </Text>
                          <View className="flex-row items-center">
                            <Text 
                              className="text-xs mr-3"
                              style={{ color: colors.text, fontFamily: fonts.family.semiBold }}
                            >
                              {pay.free ? "Gratis" : formatSoles(pay.cuota)}
                            </Text>
                            <View 
                              className="px-3 py-1 rounded-full"
                              style={{ 
                                backgroundColor: pay.free 
                                  ? `${colors.primary}15` 
                                  : (pay.status === 'paid' ? `${colors.income}15` : `${colors.expense}15`)
                              }}
                            >
                              <Text 
                                className="text-[11px] uppercase"
                                style={{ 
                                  color: pay.free 
                                    ? colors.primary 
                                    : (pay.status === 'paid' ? ((colors as any).incomeStrong || colors.income) : ((colors as any).expenseStrong || colors.expense)),
                                  fontFamily: fonts.family.bold
                                }}
                              >
                                {pay.free ? 'SIN COBRO' : (pay.status === 'paid' ? 'PAGADO' : pay.status === 'partial' ? 'PARCIAL' : 'PENDIENTE')}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button title="Registrar cobro" icon="cash-outline" onPress={() => router.push({ pathname: "/receipt/new", params: { contactId: contact.id } })} />
            <Button title="Cobros registrados" variant="secondary" icon="receipt-outline" onPress={() => router.push(`/contact/${contact.id}/receipts` as never)} />
            <Button title="Convertir deuda en préstamo" variant="secondary" icon="swap-horizontal-outline" onPress={() => router.push(`/contact/${contact.id}/convert` as never)} />
            <Button title="Préstamos" variant="secondary" icon="cash-outline" onPress={() => router.push({ pathname: "/loans", params: { contactId: contact.id } })} />
            <Button title="Devoluciones" variant="secondary" icon="return-down-back-outline" onPress={() => router.push("/refunds" as never)} />
            <Button title="Estado de cuenta completo" variant="secondary" icon="document-text-outline" onPress={() => router.push(`/contact/${contact.id}` as never)} />
          </View>
          <View className="h-20" />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
