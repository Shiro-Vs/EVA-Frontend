import { useLocalSearchParams } from "expo-router";
import AccountDetailScreen from "../../src/screens/v1/AccountDetailScreen";

export default function AccountRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountDetailScreen accountId={id} />;
}
