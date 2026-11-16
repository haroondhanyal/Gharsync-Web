"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, LoaderCircle, Trash2 } from "lucide-react";

type Document = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string };
type Target = { customerId?: string; propertyId?: string; assetId?: string; bookingId?: string };
const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export function DocumentPanel({ target, initial, canManage = true }: { target: Target; initial: Document[]; canManage?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    void Promise.all(rows.filter((row) => row.mimeType.startsWith("image/")).map(async (row) => {
      try {
        const response = await fetch(`${api}/documents/${row.id}/preview`, { credentials: "include" });
        if (!response.ok) return;
        const url = URL.createObjectURL(await response.blob());
        objectUrls.push(url);
        if (active) setPreviews((current) => ({ ...current, [row.id]: url }));
        else URL.revokeObjectURL(url);
      } catch { /* Keep the attachment available through the download action. */ }
    }));
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [rows]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file") as File | null;
    if (!file) return;
    setBusy(true); setError("");
    const body = new FormData();
    body.set("file", file);
    Object.entries(target).forEach(([key, value]) => { if (value) body.set(key, value); });
    try {
      const response = await fetch(`${api}/documents`, { method: "POST", credentials: "include", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Could not upload the file.");
      setRows((list) => [result, ...list]);
      event.currentTarget.reset();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the file.");
    } finally { setBusy(false); }
  }

  async function download(id: string, name: string) {
    const response = await fetch(`${api}/documents/${id}`, { credentials: "include" });
    if (!response.ok) { setError("Could not download this document."); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function remove(id: string) {
    const response = await fetch(`${api}/documents/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { setError("Could not remove this document."); return; }
    setRows((list) => list.filter((item) => item.id !== id));
    router.refresh();
  }

  return <section className="panel document-panel">
    <div className="panel-heading"><div><span className="panel-kicker">PRIVATE FILES</span><h2>Documents & photos</h2></div><span className="history-total">PDF · JPEG · PNG · WebP · 10 MB max</span></div>
    {canManage && <form className="document-upload" onSubmit={upload}><label className="document-picker"><FilePlus2 size={16}/><span>Choose a file<input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required/></span></label><button className="button button-outline" disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <FilePlus2 size={14}/>} Upload</button></form>}
    {error && <p className="form-message" role="alert">{error}</p>}
    {rows.length ? <div className="document-list">{rows.map((row) => <div className="document-row" key={row.id}>
      {previews[row.id] ? <img className="document-thumbnail" src={previews[row.id]} alt={row.fileName}/> : <span className="document-file-icon">{row.mimeType === "application/pdf" ? "PDF" : "IMG"}</span>}
      <span className="document-copy"><b>{row.fileName}</b><small>{(row.sizeBytes / 1024).toFixed(0)} KB · {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(row.createdAt))}</small></span>
      <button className="icon-action" onClick={() => void download(row.id, row.fileName)} aria-label={`Download ${row.fileName}`}><Download size={15}/></button>
      {canManage && <button className="icon-action danger" onClick={() => void remove(row.id)} aria-label={`Remove ${row.fileName}`}><Trash2 size={14}/></button>}
    </div>)}</div> : <p className="empty-line">No documents attached yet.</p>}
  </section>;
}
