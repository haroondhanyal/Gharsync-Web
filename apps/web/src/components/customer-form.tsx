"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";

type CustomerDraft = { id: string; fullName: string; phone: string; email: string | null; notes: string | null; tags: string[]; addresses: { address: string; city: string }[] };

function readMessage(body: any) {
  const message = body?.message;
  return Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Could not save this customer.";
}

export function CustomerForm({ initial }: { initial?: CustomerDraft }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setDuplicate(null);
    const form = new FormData(event.currentTarget);
    const tags = String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const body = {
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      notes: String(form.get("notes") ?? ""),
      tags,
      address: String(form.get("address") ?? ""),
      city: String(form.get("city") ?? ""),
    };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/customers${initial ? `/${initial.id}` : ""}`, {
        method: initial ? "PATCH" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && result.existingCustomerId) setDuplicate(result.existingCustomerId);
        throw new Error(readMessage(result));
      }
      router.replace(`/customers/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GharSync could not reach the API.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="customer-form" onSubmit={submit}>
    <div className="customer-form-grid">
      <label>Customer name<input name="fullName" autoComplete="name" defaultValue={initial?.fullName} placeholder="e.g. Ayesha Khan" minLength={2} maxLength={160} required /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={initial?.phone} placeholder="03XXXXXXXXX" pattern="(\+92|0092|0)3[0-9]{9}" title="Enter a Pakistan mobile number, such as 03XXXXXXXXX" required /></label>
      <label>Email address <span className="optional-label">Optional</span><input name="email" type="email" autoComplete="email" defaultValue={initial?.email ?? ""} placeholder="customer@example.com" /></label>
      <label>Tags <span className="optional-label">Comma separated</span><input name="tags" defaultValue={initial?.tags.join(", ")} placeholder="VIP, repeat customer" /></label>
      <label className="customer-form-wide">Home address <span className="optional-label">Optional</span><input name="address" defaultValue={initial?.addresses[0]?.address} placeholder="Street, house or area" /></label>
      <label>City <span className="optional-label">Required with address</span><input name="city" defaultValue={initial?.addresses[0]?.city} placeholder="e.g. Lahore" /></label>
      <label className="customer-form-wide">Notes <span className="optional-label">Private to your team</span><textarea name="notes" rows={4} defaultValue={initial?.notes ?? ""} placeholder="Helpful details for future service visits" maxLength={5000} /></label>
    </div>
    {message && <div className="form-message" role="alert">{message}{duplicate && <span> <Link href={`/customers/${duplicate}`}>Open the existing customer record.</Link></span>}</div>}
    <div className="customer-form-actions"><Link className="button button-outline" href={initial ? `/customers/${initial.id}` : "/customers"}><ArrowLeft size={15}/> Cancel</Link><button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Save size={15}/>} {initial ? "Save changes" : "Save customer"}</button></div>
  </form>;
}
