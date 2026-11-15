import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { AssetForm } from "@/components/asset-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Asset = { id: string; propertyId: string; category: string; brand: string | null; model: string | null; serialNumber: string | null; purchasedAt: string | null; installedAt: string | null; warrantyStartsAt: string | null; warrantyEndsAt: string | null; purchasePrice: string | null; seller: string | null; property: { id: string; name: string } };
export default async function EditAssetPage({ params }: { params: Promise<{ assetId: string }> }) { const { assetId } = await params; const [user, asset] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Asset>(`/assets/${assetId}`)]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; if (!["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")) redirect(`/assets/${assetId}`); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/properties"><div className="page-heading"><div><Link className="back-link-inline" href={`/assets/${asset.id}`}><ArrowLeft size={14}/> {asset.property.name}</Link><h1>Edit asset</h1></div></div><section className="panel customer-editor"><AssetForm propertyId={asset.propertyId} initial={asset}/></section></AppFrame>; }
