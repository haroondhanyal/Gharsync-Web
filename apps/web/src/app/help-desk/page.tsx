import { AppFrame } from "@/components/app-frame";
import { HelpDeskChat } from "@/components/help-desk-chat";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; avatarUrl?: string | null; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Status = { ollama: { configured: boolean; model: string } };
export default async function HelpDeskPage() {
  const [user, status] = await Promise.all([serverApi<Me>("/auth/me"), serverApi<Status>("/notifications/status")]);
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/help-desk"><div className="page-heading"><div><div className="eyebrow">HELP & SUPPORT</div><h1>Help Desk Chat</h1><p>Apna sawal type karein, bol kar likhwaein, ya file attach karke madad lein.</p></div></div><HelpDeskChat configured={status.ollama.configured} model={status.ollama.model}/></AppFrame>;
}
