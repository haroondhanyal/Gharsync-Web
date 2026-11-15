"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LoaderCircle, MailPlus, UserMinus, X } from "lucide-react";

type Branch = { id: string; name: string };
type Member = { id: string; role: string; status: string; branch: Branch | null; user: { id: string; fullName: string; email: string } };
type Invite = { id: string; email: string; role: string; expiresAt: string; branch: Branch | null };

function messageFrom(data: any) {
  const message = data?.message;
  return Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "The request could not be completed.";
}

export function TeamAdmin({ organizationId, branches, initialMembers, initialInvites, canInviteAdmin }: { organizationId: string; branches: Branch[]; initialMembers: Member[]; initialInvites: Invite[]; canInviteAdmin: boolean }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteUrl, setInviteUrl] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setInviteUrl(""); setDeliveryStatus("");
    const data = new FormData(event.currentTarget);
    const body = { email: String(data.get("email") ?? ""), role: String(data.get("role") ?? "STAFF"), ...(data.get("branchId") ? { branchId: String(data.get("branchId")) } : {}) };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/organizations/${organizationId}/invites`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFrom(result));
      setDeliveryStatus(result.deliveryStatus === "sent" ? "Invitation email was confirmed by the provider." : "Email delivery is not configured. Copy and share this private invitation link with the teammate.");
      setInviteUrl(result.inviteUrl ?? "");
      setInvites((rows) => [{ ...result.invite, branch: branches.find((item) => item.id === body.branchId) ?? null }, ...rows]);
      event.currentTarget.reset();
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the invitation."); }
    finally { setBusy(false); }
  }

  async function revokeInvite(id: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/organizations/${organizationId}/invites/${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (response?.ok) setInvites((rows) => rows.filter((row) => row.id !== id));
    else setError("Could not revoke this invitation.");
  }

  async function suspendMember(id: string) {
    if (!window.confirm("Suspend this team member's access?")) return;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/organizations/${organizationId}/members/${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (response?.ok) setMembers((rows) => rows.filter((row) => row.id !== id));
    else setError("Could not suspend this member. Check your access and try again.");
  }

  return <div className="team-admin-grid">
    <section className="panel team-members-panel"><div className="panel-heading"><div><span className="panel-kicker">PEOPLE & ACCESS</span><h2>Team members</h2></div><span className="history-total">{members.length} active</span></div>
      {members.length ? <div className="team-member-list">{members.map((member) => <div className="team-member-row" key={member.id}><span className="customer-avatar">{member.user.fullName.trim().slice(0,1).toUpperCase()}</span><div className="team-member-copy"><b>{member.user.fullName}</b><small>{member.user.email}</small></div><span className="role-pill">{member.role.replaceAll("_", " ").toLowerCase()}</span><span className="member-branch">{member.branch?.name ?? "All branches"}</span>{member.role !== "OWNER" && <button className="icon-action danger" onClick={() => void suspendMember(member.id)} aria-label={`Suspend ${member.user.fullName}`}><UserMinus size={15}/></button>}</div>)}</div> : <div className="empty-state compact"><b>No active team members</b><p>Send an invite to bring your team into the workspace.</p></div>}
    </section>
    <section className="panel invite-panel"><div className="panel-heading"><div><span className="panel-kicker">GROW YOUR TEAM</span><h2>Invite a teammate</h2></div><span className="invite-icon"><MailPlus size={17}/></span></div><p className="panel-description">Choose a role and branch. Invitations expire after seven days.</p>
      <form className="invite-form" onSubmit={createInvite}><label>Email address<input type="email" name="email" autoComplete="email" placeholder="teammate@example.com" required/></label><div className="form-row"><label>Role<select name="role" defaultValue="STAFF">{canInviteAdmin && <option value="ADMIN">Administrator</option>}<option value="MANAGER">Manager</option><option value="STAFF">Staff</option><option value="TECHNICIAN">Technician</option></select></label><label>Branch<select name="branchId" defaultValue=""><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label></div><button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <MailPlus size={15}/>} Create invitation</button></form>
      {error && <p className="form-message" role="alert">{error}</p>}{deliveryStatus && <div className="delivery-result"><b>{deliveryStatus}</b>{inviteUrl && <div className="copy-link-row"><input readOnly value={inviteUrl} aria-label="Invitation link"/><button className="button button-outline" type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)}><Copy size={14}/> Copy link</button></div>}</div>}
      <div className="pending-invites"><h3>Pending invitations <span>{invites.length}</span></h3>{invites.length ? invites.map((invite) => <div className="pending-invite-row" key={invite.id}><span><b>{invite.email}</b><small>{invite.role.toLowerCase()} · Expires {new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(invite.expiresAt))}</small></span><button className="icon-action" type="button" onClick={() => void revokeInvite(invite.id)} aria-label={`Revoke ${invite.email}'s invitation`}><X size={15}/></button></div>) : <p className="empty-line">No pending invites.</p>}</div>
    </section>
  </div>;
}
