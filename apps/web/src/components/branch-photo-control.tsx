"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export function BranchPhotoControl({ branchId, photoUrl }: { branchId: string; photoUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image up to 10 MB."); return; }
    setBusy(true); setError("");
    const form = new FormData(); form.append("photo", file);
    try { const response = await fetch(`${api}/organizations/branches/${branchId}/photo`, { method: "POST", credentials: "include", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Could not upload branch photo."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload branch photo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function remove() {
    setBusy(true); setError("");
    try { const response = await fetch(`${api}/organizations/branches/${branchId}/photo`, { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error("Could not remove branch photo."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove branch photo."); }
    finally { setBusy(false); }
  }
  return <div className="branch-photo-control"><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])}/><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? <LoaderCircle className="spin" size={13}/> : <Camera size={13}/>} {photoUrl ? "Change photo" : "Add photo"}</button>{photoUrl && <button className="icon-action" type="button" disabled={busy} aria-label="Remove branch photo" onClick={remove}><Trash2 size={13}/></button>}{error && <small className="form-message">{error}</small>}</div>;
}
