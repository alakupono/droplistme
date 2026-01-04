"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WarehouseLocationClient(props: { defaultKey: string }) {
  const router = useRouter();
  const [merchantLocationKey, setMerchantLocationKey] = useState(props.defaultKey);
  const [country, setCountry] = useState("US");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function create() {
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/ebay/inventory/locations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantLocationKey, country, postalCode, phone }),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!res.ok) throw new Error(json?.error || text || `Create failed (${res.status})`);
      setOkMsg(`Created location: ${merchantLocationKey}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>merchantLocationKey</div>
          <input className="input" value={merchantLocationKey} onChange={(e) => setMerchantLocationKey(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Country</div>
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Postal Code</div>
          <input className="input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Phone</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={create} disabled={isWorking}>
          {isWorking ? "Creating…" : "Create Warehouse Location"}
        </button>
      </div>

      {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}
      {okMsg && <p style={{ marginTop: 10, color: "#28a745" }}>{okMsg}</p>}
    </div>
  );
}


