import { listCustomers } from "@/lib/actions/customers";
import { CustomerManager } from "./customer-manager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();
  return <CustomerManager initial={customers} />;
}
