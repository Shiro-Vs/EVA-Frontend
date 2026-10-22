import { useLocalSearchParams } from "expo-router";
import ContactDetailScreen from "../../src/screens/v1/ContactDetailScreen";

export default function ContactRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContactDetailScreen contactId={id} />;
}
