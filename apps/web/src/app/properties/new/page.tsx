import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { PropertyForm } from "@/components/property-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Customer = { id: string; fullName: string };
export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) { const customerId = (await searchParams).customerId; if (!customerId) redirect("/customers"); const [user, customer] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Customer>(`/customers/${customerId}`)]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(role ?? "")) redirect(`/customers/${customerId}`); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/properties"><div className="page-heading"><div><Link className="back-link-inline" href={`/customers/${customerId}`}><ArrowLeft size={14}/> {customer.fullName}</Link><h1>Add a property</h1><p>Create a Home Passport for this customer.</p></div></div><section className="panel customer-editor"><PropertyForm customerId={customerId}/></section></AppFrame>; }
