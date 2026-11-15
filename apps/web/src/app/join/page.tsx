import Link from "next/link";
import { redirect } from "next/navigation";
import { serverApi } from "../../lib/server-api";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  if (!token) return <main className="invite-landing"><h1>Invitation link is incomplete</h1><p>Ask your workspace administrator to share a fresh invitation link.</p><Link className="button button-dark" href="/login">Sign in</Link></main>;
  const me = await serverApi<{ email: string; phoneVerifiedAt: string | null }>("/auth/me").catch(() => null);
  if (!me) redirect(`/signup?inviteToken=${encodeURIComponent(token)}`);
  if (!me.phoneVerifiedAt) redirect(`/verify-phone?token=${encodeURIComponent(token)}`);
  const result = await serverApi<{ organizationId: string }>("/organizations/invites/accept", { method: "POST", body: JSON.stringify({ token }) }).catch(() => null);
  if (!result) return <main className="invite-landing"><h1>Invitation needs attention</h1><p>This invite may have expired or belong to another email address. Sign in with the invited account, then try again.</p><Link className="button button-dark" href="/login">Sign in</Link></main>;
  await serverApi(`/auth/organizations/${result.organizationId}/select`, { method: "POST" }).catch(() => null);
  redirect("/dashboard");
}
