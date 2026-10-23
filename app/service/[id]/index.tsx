import { useLocalSearchParams } from "expo-router";
import ServiceDetailScreen from "../../../src/screens/planning/ServiceDetail";

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ServiceDetailScreen serviceId={id} />;
}
