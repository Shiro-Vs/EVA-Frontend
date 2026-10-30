import { Tabs } from "expo-router";
import { View } from "react-native";
import EVATabBar from "../../src/components/layout/EVATabBar";
import QuickAddSheet from "../../src/screens/tabs/QuickAddSheet";

// Seis pestañas y el «+» al centro: Inicio · Dinero · Servicios | + | Personas · Planificar · Más.
export default function MainLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <EVATabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Inicio" }} />
        <Tabs.Screen name="money" options={{ title: "Dinero" }} />
        <Tabs.Screen name="planning" options={{ title: "Servicios" }} />
        <Tabs.Screen name="add" options={{ title: "Nuevo" }} />
        <Tabs.Screen name="people" options={{ title: "Personas" }} />
        <Tabs.Screen name="plan" options={{ title: "Plan" }} />
        <Tabs.Screen name="more" options={{ title: "Más" }} />
      </Tabs>
      <QuickAddSheet />
    </View>
  );
}
