import { AppFrame } from "@/components/app-frame";
import { ThemePicker } from "@/components/theme-picker";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; avatarUrl: string | null; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
export default async function AppearancePage() {
  const user = await serverApi<Me>("/auth/me");
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/settings/appearance"><div className="page-heading"><div><div className="eyebrow">PERSONALIZATION</div><h1>Appearance</h1><p>GharSync ka rang aur display apni pasand ke mutabiq rakhein.</p></div></div><section className="panel appearance-panel"><span className="panel-kicker">THEME MODE</span><h2>Apna color mode chunein</h2><p className="panel-description">8 advanced color themes available hain. System mode aap ke device setting ko follow karta hai.</p><ThemePicker/></section></AppFrame>;
}
