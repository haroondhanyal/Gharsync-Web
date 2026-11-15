import { AppFrame } from "@/components/app-frame";
import { InventoryPanel } from "@/components/inventory-panel";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; branchId: string | null; organization: { id: string; name: string } }[] };
type Branch = { id: string; name: string };
type Supplier = { id: string; name: string; phone?: string | null; email?: string | null };
type Product = { id: string; sku: string; name: string; category: string; unit: string; unitCost: string; reorderLevel: string; tracksWarranty: boolean; supplier: { id: string; name: string } | null; stocks: { branchId: string; branch: { name: string }; quantity: string; reserved: string; available: string }[]; lowStock: boolean };

export default async function InventoryPage() {
  const user = await serverApi<Me>("/auth/me");
  const [products, branches, suppliers, movements] = await Promise.all([serverApi<Product[]>("/inventory/products"), serverApi<Branch[]>("/organizations/branches"), serverApi<Supplier[]>("/inventory/suppliers"), serverApi<import("@/components/inventory-panel").InventoryMovement[]>("/inventory/movements")]);
  const membership = user.memberships.find((item) => item.organization.id === user.currentOrganizationId);
  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(membership?.role ?? "");
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/inventory"><div className="page-heading"><div><div className="eyebrow">PHASE 7 · PARTS & WARRANTY</div><h1>Inventory</h1><p>Track stock by branch, receive parts, reserve jobs and flag items below reorder level.</p></div><span className="role-pill">{products.filter((product) => product.lowStock).length} low stock</span></div><InventoryPanel initial={products} branches={branches} suppliers={suppliers} movements={movements} canManage={canManage} branchScoped={Boolean(membership?.branchId)}/></AppFrame>;
}
