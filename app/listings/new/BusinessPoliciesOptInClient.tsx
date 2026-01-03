"use client";

import { useState } from "react";

export function BusinessPoliciesOptInClient() {
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function refreshStatus() {
    setError(null);
    setOkMsg(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/ebay/business-policies/status", { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Status failed (${res.status})`);
      setStatus(json);
      if (json?.hasBusinessPolicies) setOkMsg("Business Policies are enabled.");
    } catch (e: any) {
      setError(e?.message || "Status failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function optIn() {
    setError(null);
    setOkMsg(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/ebay/business-policies/opt-in", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Opt-in failed (${res.status})`);
      setOkMsg(json?.message || "Opt-in requested.");
      await refreshStatus();
    } catch (e: any) {
      setError(e?.message || "Opt-in failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={optIn} disabled={isWorking}>
          {isWorking ? "Working…" : "Enable Business Policies"}
        </button>
        <button className="btn btn-secondary" onClick={refreshStatus} disabled={isWorking}>
          Refresh Status
        </button>
      </div>

      {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}
      {okMsg && <p style={{ marginTop: 10, color: "#28a745" }}>{okMsg}</p>}
      {status && (
        <pre style={{ marginTop: 10, background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
    </div>
  );
}


