import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { PropertyForm } from "@/components/property-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Property = { id: string; customerId: string; name: string; propertyType: string; address: string; city: string; ownership: string | null; notes: string | null; latitude: string | null; longitude: string | null };
export default async function EditPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) { const { propertyId } = await params; const [user, property] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Property>(`/properties/${propertyId}`)]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect(`/properties/${propertyId}`); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/properties"><div className="page-heading"><div><Link className="back-link-inline" href={`/properties/${property.id}`}><ArrowLeft size={14}/> {property.name}</Link><h1>Edit property</h1></div></div><section className="panel customer-editor"><PropertyForm customerId={property.customerId} initial={property}/></section></AppFrame>; }
