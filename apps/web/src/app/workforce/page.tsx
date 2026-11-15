import { AppFrame } from "@/components/app-frame";
import { WorkforcePanel } from "@/components/workforce-panel";
import { serverApi } from "@/lib/server-api";

type Me = { id: string; fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Technician = { id: string; branch: { name: string } | null; user: { id: string; fullName: string; phone: string | null; email: string }; technicianProfile: { skills: string[]; employmentType: string; hourlyRate: string | null; bio: string | null; isAvailable: boolean; availability: { weekday: number; startMinute: number; endMinute: number; isAvailable: boolean }[]; timeOff: { id: string; startsAt: string; endsAt: string; status: string; reason: string | null }[] } | null; _count: { assignedBookings: number }; completedJobs: number };

export default async function WorkforcePage() {
  const user = await serverApi<Me>("/auth/me");
  const technicians = await serverApi<Technician[]>("/workforce/technicians");
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role ?? "";
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/workforce"><div className="page-heading"><div><div className="eyebrow">PHASE 6 · FIELD OPERATIONS</div><h1>Workforce</h1><p>Keep technician profiles, skills, working hours and planned leave current for scheduling.</p></div></div><WorkforcePanel initial={technicians} canManage={["OWNER", "ADMIN", "MANAGER"].includes(role)} currentUserId={user.id}/></AppFrame>;
}
