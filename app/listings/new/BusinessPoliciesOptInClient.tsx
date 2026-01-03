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
      const text = await res.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
      if (!res.ok) throw new Error((json as any)?.error || text || `Status failed (${res.status})`);
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
      const text = await res.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
      if (!res.ok) throw new Error((json as any)?.error || text || `Opt-in failed (${res.status})`);
      setOkMsg((json as any)?.message || "Opt-in requested.");
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


