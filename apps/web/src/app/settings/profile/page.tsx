import { AppFrame } from "@/components/app-frame";
import { ProfileEditor } from "@/components/profile-editor";
import { serverApi } from "@/lib/server-api";

type Me = { id: string; fullName: string; email: string; phone: string | null; countryCode: string; city: string | null; avatarUrl: string | null; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
export default async function ProfilePage() {
  const user = await serverApi<Me>("/auth/me");
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/settings/profile"><div className="page-heading"><div><div className="eyebrow">ACCOUNT SETTINGS</div><h1>My profile</h1><p>Update your account details and profile photo.</p></div></div><ProfileEditor initialName={user.fullName} email={user.email} phone={user.phone} countryCode={user.countryCode} city={user.city} avatarUrl={user.avatarUrl}/></AppFrame>;
}
