"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export function AssetQr({ assetId, canManage = true }: { assetId: string; canManage?: boolean }) { const router = useRouter(); const [src, setSrc] = useState(""); const srcRef = useRef(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function load() { setBusy(true); setError(""); const response = await fetch(`${api}/assets/${assetId}/qr.svg`, { credentials: "include", cache: "no-store" }).catch(() => null); if (!response?.ok) { setError("QR code could not be loaded."); setBusy(false); return; } const blob = await response.blob(); const next = URL.createObjectURL(blob); if (srcRef.current) URL.revokeObjectURL(srcRef.current); srcRef.current = next; setSrc(next); setBusy(false); }
  useEffect(() => { void load(); return () => { if (srcRef.current) URL.revokeObjectURL(srcRef.current); }; }, []);
  async function rotate() { setBusy(true); const response = await fetch(`${api}/assets/${assetId}/qr/rotate`, { method: "POST", credentials: "include" }).catch(() => null); if (!response?.ok) setError("Could not replace this QR code."); else { await load(); router.refresh(); } setBusy(false); }
  return <section className="panel qr-panel"><div className="panel-heading"><div><span className="panel-kicker">HOME PASSPORT</span><h2>Asset QR code</h2></div></div><p className="panel-description">Scan after signing in to open this asset and its service history.</p>{busy && !src ? <div className="qr-placeholder"><LoaderCircle className="spin"/></div> : src ? <img className="asset-qr-image" src={src} alt="Private asset profile QR code"/> : <p className="form-message">{error}</p>}<div className="qr-actions">{src && <a className="button button-outline" href={src} download={`gharsync-asset-${assetId.slice(0, 8)}.svg`}><Download size={14}/> Download</a>}{canManage && <button className="button button-outline" onClick={() => void rotate()} disabled={busy}><RefreshCw size={14}/> Replace code</button>}</div>{error && src && <p className="form-message">{error}</p>}</section>;
}
