"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ListingsClient({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/ebay/sync?storeId=${encodeURIComponent(storeId)}`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Sync failed (${res.status})`);
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn btn-primary" onClick={sync} disabled={isSyncing}>
        {isSyncing ? "Syncing…" : "Sync from eBay"}
      </button>
      {error && (
        <p style={{ marginTop: 8, color: "#dc3545", fontSize: 14 }}>
          {error}
        </p>
      )}
    </div>
  );
}


