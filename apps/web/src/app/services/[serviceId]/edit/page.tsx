import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ServiceForm } from "@/components/service-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Branch = { id: string; name: string };
type Service = { id: string; name: string; category: string; description: string | null; basePrice: string | null; minPrice: string | null; maxPrice: string | null; durationMins: number | null; requiredSkills: string[]; serviceAreas: string[]; isActive: boolean; branchLinks: { branchId: string }[] };
export default async function EditServicePage({ params }: { params: Promise<{ serviceId: string }> }) { const { serviceId } = await params; const [user, branches, services] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Branch[]>("/organizations/branches"), serverApi<Service[]>("/services?includeInactive=true")]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect("/services"); const service = services.find((item) => item.id === serviceId); if (!service) redirect("/services"); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/services"><div className="page-heading"><div><Link href="/services" className="back-link-inline"><ArrowLeft size={14}/> Service catalog</Link><h1>Edit {service.name}</h1></div></div><section className="panel customer-editor"><ServiceForm branches={branches} initial={service}/></section></AppFrame>; }
