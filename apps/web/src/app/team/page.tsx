import { AppFrame } from "@/components/app-frame";
import { TeamAdmin } from "@/components/team-admin";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Branch = { id: string; name: string };
type Member = { id: string; role: string; status: string; branch: Branch | null; user: { id: string; fullName: string; email: string } };
type Invite = { id: string; email: string; role: string; expiresAt: string; branch: Branch | null };

export default async function TeamPage() {
  const user = await serverApi<Me>("/auth/me");
  const [members, invites, branches] = await Promise.all([
    serverApi<Member[]>(`/organizations/${user.currentOrganizationId}/members`),
    serverApi<Invite[]>(`/organizations/${user.currentOrganizationId}/invites`),
    serverApi<Branch[]>("/organizations/branches"),
  ]);
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role;
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/team">
    <div className="page-heading"><div><div className="eyebrow">PEOPLE & PERMISSIONS</div><h1>Team & branches</h1><p>Manage who can access your organization and where they work.</p></div></div>
    <TeamAdmin organizationId={user.currentOrganizationId} branches={branches} initialMembers={members} initialInvites={invites} canInviteAdmin={role === "OWNER"}/>
  </AppFrame>;
}
