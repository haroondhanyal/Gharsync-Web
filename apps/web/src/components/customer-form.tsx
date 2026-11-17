"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, LoaderCircle, Save, Trash2 } from "lucide-react";
import { CountryCityPhone, type LocationPhoneValue } from "@/components/country-city-phone";
import { phoneCountryDetails } from "@/lib/phone-country";

type CustomerDraft = { id: string; fullName: string; phone: string; email: string | null; notes: string | null; tags: string[]; countryCode: string; city: string | null; photoUrl: string | null; addresses: { address: string; city: string }[] };
const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

function readMessage(body: unknown) {
  const message = (body as { message?: unknown } | null)?.message;
  return Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Could not save this customer.";
}

export function CustomerForm({ initial }: { initial?: CustomerDraft }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState("");
  const [location, setLocation] = useState<LocationPhoneValue>(() => {
    const countryCode = initial?.countryCode ?? "PK";
    const callingCode = phoneCountryDetails(countryCode).callingCode;
    return { countryCode, city: initial?.city ?? initial?.addresses[0]?.city ?? "", phone: callingCode && initial?.phone.startsWith(callingCode) ? initial.phone.slice(callingCode.length) : initial?.phone ?? "" };
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!photo) { setPreview(""); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const currentPhoto = preview || (!removePhoto && initial?.photoUrl ? `${api}${initial.photoUrl}` : "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setDuplicate(null);
    const form = new FormData(event.currentTarget);
    const customerId = initial?.id ?? createdId;
    const body = {
      fullName: String(form.get("fullName") ?? ""), phone: String(form.get("phone") ?? ""), countryCode: location.countryCode, city: location.city,
      email: String(form.get("email") ?? ""), notes: String(form.get("notes") ?? ""),
      tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      address: String(form.get("address") ?? ""),
    };
    try {
      const response = await fetch(`${api}/customers${customerId ? `/${customerId}` : ""}`, { method: customerId ? "PATCH" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && result.existingCustomerId) setDuplicate(result.existingCustomerId);
        throw new Error(readMessage(result));
      }
      const savedId = result.id as string;
      if (!customerId) setCreatedId(savedId);
      if (photo) {
        const upload = new FormData(); upload.append("photo", photo);
        const photoResponse = await fetch(`${api}/customers/${savedId}/photo`, { method: "POST", credentials: "include", body: upload });
        if (!photoResponse.ok) { const photoResult = await photoResponse.json().catch(() => ({})); throw new Error(`Customer saved. Photo upload failed: ${readMessage(photoResult)}`); }
      } else if (removePhoto && initial?.photoUrl) {
        const photoResponse = await fetch(`${api}/customers/${savedId}/photo`, { method: "DELETE", credentials: "include" });
        if (!photoResponse.ok) throw new Error("Customer saved, but the photo could not be removed.");
      }
      router.replace(`/customers/${savedId}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "GharSync could not reach the API."); }
    finally { setBusy(false); }
  }

  return <form className="customer-form" onSubmit={submit}>
    <div className="customer-form-grid">
      <div className="customer-photo-editor"><span className="customer-photo-preview">{currentPhoto ? <img src={currentPhoto} alt="Customer profile preview"/> : <span>{initial?.fullName.slice(0, 1).toUpperCase() ?? "?"}</span>}</span><input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)) { setMessage("Choose a JPEG, PNG or WebP image up to 10 MB."); return; } setPhoto(file ?? null); setRemovePhoto(false); setMessage(""); }}/><div><b>Customer photo</b><small>JPEG, PNG or WebP · up to 10 MB</small><div className="customer-photo-actions"><button className="button button-outline button-small" type="button" onClick={() => picker.current?.click()}><Camera size={13}/>{currentPhoto ? "Change photo" : "Add photo"}</button>{initial?.photoUrl && <button className="icon-action" type="button" aria-label="Remove customer photo" onClick={() => { setPhoto(null); setRemovePhoto(true); if (picker.current) picker.current.value = ""; }}><Trash2 size={13}/></button>}</div></div></div>
      <label>Customer name<input name="fullName" autoComplete="name" defaultValue={initial?.fullName} placeholder="e.g. Ayesha Khan" minLength={2} maxLength={160} required /></label>
      <label>Email address <span className="optional-label">Optional</span><input name="email" type="email" autoComplete="email" defaultValue={initial?.email ?? ""} placeholder="customer@example.com" /></label>
      <CountryCityPhone value={location} onChange={setLocation}/>
      <label>Tags <span className="optional-label">Comma separated</span><input name="tags" defaultValue={initial?.tags.join(", ")} placeholder="VIP, repeat customer" /></label>
      <label className="customer-form-wide">Home address <span className="optional-label">Optional</span><input name="address" defaultValue={initial?.addresses[0]?.address} placeholder="Street, house or area" /></label>
      <label className="customer-form-wide">Notes <span className="optional-label">Private to your team</span><textarea name="notes" rows={4} defaultValue={initial?.notes ?? ""} placeholder="Helpful details for future service visits" maxLength={5000} /></label>
    </div>
    {message && <div className="form-message" role="alert">{message}{duplicate && <span> <Link href={`/customers/${duplicate}`}>Open the existing customer record.</Link></span>}</div>}
    <div className="customer-form-actions"><Link className="button button-outline" href={initial ? `/customers/${initial.id}` : "/customers"}><ArrowLeft size={15}/> Cancel</Link><button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Save size={15}/>} {initial || createdId ? "Save changes" : "Save customer"}</button></div>
  </form>;
}
