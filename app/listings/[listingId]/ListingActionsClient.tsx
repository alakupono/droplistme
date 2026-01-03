"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ListingActionsClient(props: { listingId: string; currentPrice?: string; currentQty: number }) {
  const router = useRouter();
  const [price, setPrice] = useState(props.currentPrice || "");
  const [quantity, setQuantity] = useState(String(props.currentQty || 1));
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function update() {
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/ebay/listings/${encodeURIComponent(props.listingId)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, quantity }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Update failed (${res.status})`);
      setOkMsg("Updated on eBay.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function endListing() {
    if (!confirm("End this listing on eBay?")) return;
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/ebay/listings/${encodeURIComponent(props.listingId)}/end`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `End failed (${res.status})`);
      setOkMsg("Listing ended.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "End failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Price</div>
          <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Quantity</div>
          <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={update} disabled={isWorking}>
          {isWorking ? "Working…" : "Update on eBay"}
        </button>
        <button className="btn btn-secondary" onClick={endListing} disabled={isWorking}>
          End Listing
        </button>
      </div>

      {error && <p style={{ marginTop: 8, color: "#dc3545", fontSize: 14 }}>{error}</p>}
      {okMsg && <p style={{ marginTop: 8, color: "#28a745", fontSize: 14 }}>{okMsg}</p>}
    </div>
  );
}


