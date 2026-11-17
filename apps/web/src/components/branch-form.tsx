"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Plus, X } from "lucide-react";
import { CountryCityPhone, type LocationPhoneValue } from "@/components/country-city-phone";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export function BranchForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<LocationPhoneValue>({ countryCode: "PK", city: "", phone: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!photo) { setPreview(""); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    const phone = String(data.get("phone") ?? "").trim();
    const body = { name: String(data.get("name") ?? ""), countryCode: location.countryCode, city: location.city, address: String(data.get("address") ?? ""), ...(phone ? { phone } : {}) };
    try {
      const response = await fetch(`${api}/organizations/branches`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Could not create this branch.");
      if (photo) {
        const upload = new FormData(); upload.append("photo", photo);
        const photoResponse = await fetch(`${api}/organizations/branches/${result.id}/photo`, { method: "POST", credentials: "include", body: upload });
        if (!photoResponse.ok) setError("Branch created, but the photo upload failed. Use Add photo on the branch card to try again.");
      }
      event.currentTarget.reset(); setPhoto(null); setLocation({ countryCode: "PK", city: "", phone: "" }); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create this branch."); }
    finally { setBusy(false); }
  }
  return <form className="branch-form" onSubmit={submit}><label>Branch name<input name="name" minLength={2} maxLength={160} placeholder="e.g. Gulberg branch" required/></label><CountryCityPhone value={location} onChange={setLocation} phoneRequired={false}/><label>Address <span className="optional-label">Optional</span><input name="address" maxLength={500} placeholder="Street, area or landmark"/></label><div className="branch-photo-upload"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)) { setError("Choose a JPEG, PNG or WebP image up to 10 MB."); return; } setPhoto(file ?? null); setError(""); }}/>{preview ? <div className="branch-photo-preview"><img src={preview} alt="Branch photo preview"/><button type="button" aria-label="Remove selected photo" onClick={() => setPhoto(null)}><X size={14}/></button></div> : <button type="button" className="button button-outline button-small" onClick={() => input.current?.click()}><Camera size={14}/> Add branch photo <small>(up to 10 MB)</small></button>}</div>{error && <div className="form-message" role="alert">{error}</div>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>} Add branch</button></form>;
}
