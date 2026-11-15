"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, LoaderCircle } from "lucide-react";

export function ArchiveCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function archive() {
    if (!window.confirm("Archive this customer? They will leave the active directory.")) return;
    setBusy(true);
    setError("");
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/customers/${customerId}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (response?.ok) {
      router.replace("/customers");
      router.refresh();
    } else {
      setError("Could not archive this customer. Check your access and try again.");
      setBusy(false);
    }
  }
  return <div className="archive-action"><button className="button button-outline button-danger" type="button" disabled={busy} onClick={() => void archive()}>{busy ? <LoaderCircle size={15} className="spin"/> : <Archive size={15}/>} Archive</button>{error && <small role="alert">{error}</small>}</div>;
}
