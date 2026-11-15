"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

export function BranchForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    const phone = String(data.get("phone") ?? "").trim();
    const body = { name: String(data.get("name") ?? ""), city: String(data.get("city") ?? ""), address: String(data.get("address") ?? ""), ...(phone ? { phone } : {}) };
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/organizations/branches`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => ({}));
      const message = result?.message;
      setError(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Could not create this branch.");
      setBusy(false); return;
    }
    event.currentTarget.reset();
    router.refresh(); setBusy(false);
  }
  return <form className="branch-form" onSubmit={submit}><label>Branch name<input name="name" minLength={2} maxLength={160} placeholder="e.g. Gulberg branch" required/></label><label>City<input name="city" minLength={2} maxLength={100} placeholder="e.g. Lahore" required/></label><label>Address <span className="optional-label">Optional</span><input name="address" maxLength={500} placeholder="Street, area or landmark"/></label><label>Phone <span className="optional-label">Optional</span><input name="phone" type="tel" pattern="(\+92|0092|0)3[0-9]{9}" placeholder="03XXXXXXXXX"/></label>{error && <div className="form-message" role="alert">{error}</div>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>} Add branch</button></form>;
}
