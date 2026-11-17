import { Building2, MapPin, Phone, Plus } from "lucide-react";
import { countries, countryFlag } from "@/lib/locations";
import { AppFrame } from "@/components/app-frame";
import { BranchForm } from "@/components/branch-form";
import { BranchPhotoControl } from "@/components/branch-photo-control";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Branch = { id: string; name: string; city: string; countryCode: string; address: string | null; phone: string | null; photoUrl: string | null; isDefault: boolean; createdAt?: string };

export default async function BranchesPage() {
  const user = await serverApi<Me>("/auth/me");
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role;
  if (!(["OWNER", "ADMIN"].includes(role ?? ""))) redirect("/dashboard");
  const branches = await serverApi<Branch[]>("/organizations/branches");
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/settings/branches">
    <div className="page-heading"><div><div className="eyebrow">ORGANIZATION SETTINGS</div><h1>Branches</h1><p>Set up the locations where your team works.</p></div></div>
    <div className="branch-layout"><section className="branch-list">{branches.map((branch) => <article className="panel branch-card" key={branch.id}><span className="branch-card-icon branch-photo-icon">{branch.photoUrl ? <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}${branch.photoUrl}`} alt={`${branch.name} photo`}/> : <Building2 size={18}/>}</span><div className="branch-card-title"><h2>{branch.name}</h2>{branch.isDefault && <span className="default-badge">Default</span>}</div><p><MapPin size={14}/>{countryFlag(branch.countryCode)} {countries.find((item) => item.code === branch.countryCode)?.name ?? branch.countryCode}{branch.address ? ` · ${branch.address}` : ""} · {branch.city}</p>{branch.phone && <p><Phone size={14}/>{branch.phone}</p>}<BranchPhotoControl branchId={branch.id} photoUrl={branch.photoUrl}/></article>)}</section>
      <section className="panel branch-create-panel"><div className="panel-heading"><div><span className="panel-kicker">NEW LOCATION</span><h2>Add a branch</h2></div><span className="invite-icon"><Plus size={17}/></span></div><p className="panel-description">New branches use your organization's PKR and timezone settings.</p><BranchForm/></section></div>
  </AppFrame>;
}
