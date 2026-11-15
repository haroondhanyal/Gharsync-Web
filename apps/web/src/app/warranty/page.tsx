import { AppFrame } from "@/components/app-frame";
import { WarrantyPanel } from "@/components/warranty-panel";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Asset = { id: string; category: string; brand: string | null; serialNumber: string | null; warrantyStartsAt: string | null; warrantyEndsAt: string | null; property: { name: string; city: string } };
type Claim = { id: string; claimNumber: string; status: string; issue: string; resolution: string | null; createdAt: string; asset: Asset; product: { name: string; sku: string } | null; supplier: { name: string } | null };

export default async function WarrantyPage() {
  const user = await serverApi<Me>("/auth/me");
  const [claims, assets, products, suppliers, expiring] = await Promise.all([serverApi<Claim[]>("/warranty-claims"), serverApi<Asset[]>("/assets"), serverApi<{ id: string; name: string; sku: string }[]>("/inventory/products"), serverApi<{ id: string; name: string }[]>("/inventory/suppliers"), serverApi<Asset[]>("/assets/warranty-expiring?days=60")]);
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/warranty"><div className="page-heading"><div><div className="eyebrow">PHASE 7 · ASSET AFTERCARE</div><h1>Warranty claims</h1><p>Open cases against covered home equipment and follow the supplier decision through resolution.</p></div></div><WarrantyPanel initial={claims} assets={assets} products={products} suppliers={suppliers} expiring={expiring}/></AppFrame>;
}
