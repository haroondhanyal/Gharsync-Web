import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { CustomerForm } from "@/components/customer-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Customer = { id: string; fullName: string; phone: string; countryCode: string; city: string | null; photoUrl: string | null; email: string | null; notes: string | null; tags: string[]; addresses: { address: string; city: string }[] };

export default async function EditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const [user, customer] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Customer>(`/customers/${customerId}`)]);
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role;
  if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect(`/customers/${customerId}`);
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/customers">
    <div className="page-heading"><div><Link className="back-link-inline" href={`/customers/${customer.id}`}><ArrowLeft size={14}/> {customer.fullName}</Link><h1>Edit customer</h1><p>Update contact details and team notes.</p></div></div>
    <section className="panel customer-editor"><div className="editor-heading"><span className="panel-kicker">CUSTOMER PROFILE</span><p>Changes are saved to this organization's customer record.</p></div><CustomerForm initial={customer}/></section>
  </AppFrame>;
}
