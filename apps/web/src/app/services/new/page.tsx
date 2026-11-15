import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ServiceForm } from "@/components/service-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Branch = { id: string; name: string };
export default async function NewServicePage() { const [user, branches] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Branch[]>("/organizations/branches")]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect("/services"); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/services"><div className="page-heading"><div><Link href="/services" className="back-link-inline"><ArrowLeft size={14}/> Service catalog</Link><h1>Add a service</h1><p>Define pricing and which branches can take this work.</p></div></div><section className="panel customer-editor"><ServiceForm branches={branches}/></section></AppFrame>; }
