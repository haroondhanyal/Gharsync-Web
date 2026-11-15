import { AppFrame } from "@/components/app-frame";
import { AssistantPanel } from "@/components/assistant-panel";
import { serverApi } from "@/lib/server-api";
type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Status = { ai: { configured: boolean; provider: string } };
type Usage = { id: string; task: string; provider: string; status: string; inputCharacters: number; outputCharacters: number; createdAt: string; user: { fullName: string } };
export default async function AssistantPage() { const user = await serverApi<Me>("/auth/me"); const [status, usage] = await Promise.all([serverApi<Status>("/notifications/status"), serverApi<Usage[]>("/ai/usage")]); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/assistant"><div className="page-heading"><div><div className="eyebrow">PHASE 8 · AI ASSISTANCE</div><h1>Service assistant</h1><p>Create careful drafts from service notes, with a clear human review step.</p></div></div><AssistantPanel configured={status.ai.configured} usage={usage}/></AppFrame>; }
