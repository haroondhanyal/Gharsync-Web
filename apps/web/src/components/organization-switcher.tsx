"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";

type Organization = { id: string; name: string };

export function OrganizationSwitcher({ organizations, selectedId }: { organizations: Organization[]; selectedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const selected = organizations.find((item) => item.id === selectedId);
  if (organizations.length < 2) return <span className="org-switch-static">{selected?.name ?? "Your organization"}</span>;

  async function change(organizationId: string) {
    setBusy(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/auth/organizations/${organizationId}/select`, {
      method: "POST", credentials: "include",
    }).catch(() => null);
    if (response?.ok) router.refresh();
    else setBusy(false);
  }

  return <label className="org-switch"><span className="sr-only">Current organization</span>
    {busy ? <LoaderCircle className="spin" size={15} /> : <ChevronDown size={14} />}
    <select aria-label="Switch organization" value={selectedId} disabled={busy} onChange={(event) => void change(event.target.value)}>
      {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>;
}
