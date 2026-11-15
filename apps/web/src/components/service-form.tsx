"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
type Branch = { id: string; name: string };
type Service = { id: string; name: string; category: string; description: string | null; basePrice: string | null; minPrice: string | null; maxPrice: string | null; durationMins: number | null; requiredSkills: string[]; serviceAreas: string[]; isActive: boolean; branchLinks: { branchId: string }[] };
export function ServiceForm({ branches, initial }: { branches: Branch[]; initial?: Service }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const value = (key: string) => String(form.get(key) ?? "").trim();
    const body = { name: value("name"), category: value("category"), description: value("description"), basePrice: value("basePrice") ? Number(value("basePrice")) : undefined, minPrice: value("minPrice") ? Number(value("minPrice")) : undefined, maxPrice: value("maxPrice") ? Number(value("maxPrice")) : undefined, durationMins: value("durationMins") ? Number(value("durationMins")) : undefined, requiredSkills: value("requiredSkills").split(",").map((skill) => skill.trim()).filter(Boolean), serviceAreas: value("serviceAreas").split(",").map((area) => area.trim()).filter(Boolean), branchIds: form.getAll("branchIds").map(String), isActive: form.get("isActive") === "on" };
    try {
      const response = await fetch(`${api}/services${initial ? `/${initial.id}` : ""}`, { method: initial ? "PATCH" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Could not save this service."); router.push("/services"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this service."); } finally { setBusy(false); }
  }
  return <form className="customer-form" onSubmit={submit}><div className="customer-form-grid">
    <label>Service name<input name="name" defaultValue={initial?.name} placeholder="AC maintenance" required minLength={2} maxLength={160}/></label>
    <label>Category<input name="category" defaultValue={initial?.category} placeholder="HVAC" required minLength={2} maxLength={80}/></label>
    <label>Description<textarea name="description" defaultValue={initial?.description ?? ""} rows={4} maxLength={5000}/></label>
    <label>Required skills <span className="optional-label">Comma separated</span><input name="requiredSkills" defaultValue={initial?.requiredSkills.join(", ")} placeholder="HVAC, refrigerant handling"/></label>
    <label>Service areas <span className="optional-label">Cities, comma separated</span><input name="serviceAreas" defaultValue={initial?.serviceAreas.join(", ")} placeholder="Lahore, Sheikhupura" maxLength={2000}/></label>
    <label>Base price · PKR<input type="number" min="0" step="0.01" name="basePrice" defaultValue={initial?.basePrice ?? ""}/></label>
    <label>Estimated duration · minutes<input type="number" min="5" max="1440" step="5" name="durationMins" defaultValue={initial?.durationMins ?? ""}/></label>
    <label>Price range minimum<input type="number" min="0" step="0.01" name="minPrice" defaultValue={initial?.minPrice ?? ""}/></label>
    <label>Price range maximum<input type="number" min="0" step="0.01" name="maxPrice" defaultValue={initial?.maxPrice ?? ""}/></label>
    <fieldset className="branch-picker customer-form-wide"><legend>Available at branches <span className="optional-label">No selection means all branches</span></legend>{branches.length ? branches.map((branch) => <label className="consent" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={initial?.branchLinks.some((link) => link.branchId === branch.id)}/><span>{branch.name}</span></label>) : <small>There are no branches to limit this service to.</small>}</fieldset>
    <label className="consent customer-form-wide"><input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true}/><span>Service is available for new bookings</span></label>
  </div>{error && <p className="form-message" role="alert">{error}</p>}<div className="customer-form-actions"><button className="button button-dark" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Save service</button></div></form>;
}
