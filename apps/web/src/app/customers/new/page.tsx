import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { CustomerForm } from "@/components/customer-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };

export default async function NewCustomerPage() {
  const user = await serverApi<Me>("/auth/me");
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role;
  if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect("/customers");
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/customers">
    <div className="page-heading"><div><Link className="back-link-inline" href="/customers"><ArrowLeft size={14}/> Customers</Link><h1>Add a customer</h1><p>Add a customer to {user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.organization.name}.</p></div></div>
    <section className="panel customer-editor"><div className="editor-heading"><span className="panel-kicker">CUSTOMER PROFILE</span><p>Phone numbers help your team find returning customers and avoid duplicate records.</p></div><CustomerForm/></section>
  </AppFrame>;
}
