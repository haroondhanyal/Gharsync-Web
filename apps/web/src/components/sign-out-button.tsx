"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/auth/sign-out`, { method: "POST", credentials: "include" }).catch(() => null);
    router.replace("/");
    router.refresh();
  }
  return <button className="signout-button" type="button" onClick={() => void signOut()} disabled={busy} aria-label="Sign out">
    {busy ? <LoaderCircle size={15} className="spin" /> : <LogOut size={15} />}<span>Sign out</span>
  </button>;
}
