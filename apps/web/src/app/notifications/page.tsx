import { AppFrame } from "@/components/app-frame";
import { NotificationCenter } from "@/components/notification-center";
import { serverApi } from "@/lib/server-api";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Notice = { id: string; eventKey: string; channel: string; status: string; subject: string | null; body: string; readAt: string | null; createdAt: string; error: string | null };
type Template = { id: string; eventKey: string; channel: string; subject: string | null; body: string; enabled: boolean; organizationId: string | null };
type Status = { channels: Record<string, { configured: boolean; delivery: string }>; ai: { configured: boolean; provider: string } };
export default async function NotificationsPage() { const user = await serverApi<Me>("/auth/me"); const [items, status, templates] = await Promise.all([serverApi<Notice[]>("/notifications"), serverApi<Status>("/notifications/status"), serverApi<Template[]>("/notifications/templates")]); const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role; return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/notifications"><div className="page-heading"><div><div className="eyebrow">PHASE 8 · MESSAGES</div><h1>Notifications</h1><p>Keep team updates visible and track provider-confirmed message delivery.</p></div></div><NotificationCenter initial={items} initialTemplates={templates} status={status} canManage={["OWNER", "ADMIN", "MANAGER"].includes(role ?? "")}/></AppFrame>; }
