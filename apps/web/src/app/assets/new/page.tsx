import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { AssetForm } from "@/components/asset-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Property = { id: string; name: string; customer: { fullName: string } };
export default async function NewAssetPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) { const propertyId = (await searchParams).propertyId; if (!propertyId) redirect("/properties"); const [user, property] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Property>(`/properties/${propertyId}`)]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(role ?? "")) redirect(`/properties/${propertyId}`); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/properties"><div className="page-heading"><div><Link className="back-link-inline" href={`/properties/${property.id}`}><ArrowLeft size={14}/> {property.name}</Link><h1>Register equipment</h1><p>Add an appliance to {property.customer.fullName}'s Home Passport.</p></div></div><section className="panel customer-editor"><AssetForm propertyId={property.id}/></section></AppFrame>; }
