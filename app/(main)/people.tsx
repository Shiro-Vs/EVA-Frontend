import { useModules } from "../../src/context/ModulesContext";
import ContactsScreen from "../../src/screens/planning/contacts";
import LoansHubScreen from "../../src/screens/tabs/LoansHubScreen";

/** Pestaña dinámica: muestra Préstamos cuando está activo; si solo está activo Personas, muestra Personas. */
export default function PeopleOrLoansTab() {
  const { modules } = useModules();
  return modules.loans ? <LoansHubScreen /> : <ContactsScreen asTab />;
}
