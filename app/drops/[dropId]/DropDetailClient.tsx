"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DropDetailClient(props: {
  dropId: string;
  initial: {
    status: string;
    title: string | null;
    description: string | null;
    categoryId: string | null;
    condition: string | null;
    price: string | null;
    quantity: number;
    imagesCount: number;
    publishedListingId: string | null;
    specifics?: Record<string, any> | null;
    storeDefaults?: {
      marketplaceId?: string | null;
      merchantLocationKey?: string | null;
      paymentPolicyId?: string | null;
      fulfillmentPolicyId?: string | null;
      returnPolicyId?: string | null;
    };
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initial.title || "");
  const [description, setDescription] = useState(props.initial.description || "");
  const [categoryId, setCategoryId] = useState(props.initial.categoryId || "8822");
  const [condition, setCondition] = useState(props.initial.condition || "USED_GOOD");
  const [price, setPrice] = useState(props.initial.price || "");
  const [quantity, setQuantity] = useState(String(props.initial.quantity || 1));
  const [status, setStatus] = useState(props.initial.status);
  const [specifics, setSpecifics] = useState<Record<string, string>>(() => {
    const raw = props.initial.specifics || {};
    const out: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const key = String(k).trim();
        if (!key) continue;
        out[key] = Array.isArray(v) ? String(v[0] ?? "").trim() : String(v ?? "").trim();
      }
    }
    return out;
  });

  const [marketplaceId, setMarketplaceId] = useState(props.initial.storeDefaults?.marketplaceId || "EBAY_US");
  const [paymentPolicyId, setPaymentPolicyId] = useState(props.initial.storeDefaults?.paymentPolicyId || "");
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState(props.initial.storeDefaults?.fulfillmentPolicyId || "");
  const [returnPolicyId, setReturnPolicyId] = useState(props.initial.storeDefaults?.returnPolicyId || "");
  const merchantLocationKey = props.initial.storeDefaults?.merchantLocationKey || "";

  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function save() {
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(props.dropId)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId,
          condition,
          price,
          quantity: parseInt(quantity, 10),
          status,
          specifics,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);
      setOkMsg("Saved.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function regenerate() {
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(props.dropId)}/regenerate`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Regenerate failed (${res.status})`);
      setOkMsg("Regenerated.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Regenerate failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function publish() {
    if (!confirm("Publish this listing to eBay now?")) return;
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(props.dropId)}/publish`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Publish failed (${res.status})`);
      setOkMsg("Published to eBay.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Publish failed");
    } finally {
      setIsWorking(false);
    }
  }

  const missingDefaults =
    !merchantLocationKey || !paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId;

  async function saveDefaults() {
    setIsWorking(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/ebay/defaults/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplaceId,
          paymentPolicyId,
          fulfillmentPolicyId,
          returnPolicyId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save defaults failed (${res.status})`);
      setOkMsg("Saved eBay defaults.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Save defaults failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>Draft</h2>

      {missingDefaults && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
          <h3 style={{ marginTop: 0 }}>eBay Defaults (required to publish)</h3>
          <p style={{ color: "#666", marginTop: 6 }}>
            Your eBay account has policies, but Droplist needs the 3 policy IDs saved to your Store once.
            Paste them from <code>/api/ebay/diagnostics</code>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Marketplace</div>
              <input className="input" value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>merchantLocationKey</div>
              <input className="input" value={merchantLocationKey || "(missing)"} disabled />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>paymentPolicyId</div>
              <input className="input" value={paymentPolicyId} onChange={(e) => setPaymentPolicyId(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>fulfillmentPolicyId</div>
              <input className="input" value={fulfillmentPolicyId} onChange={(e) => setFulfillmentPolicyId(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>returnPolicyId</div>
              <input className="input" value={returnPolicyId} onChange={(e) => setReturnPolicyId(e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={saveDefaults} disabled={isWorking}>
              {isWorking ? "Saving…" : "Save eBay Defaults"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Status</div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="processing">processing</option>
            <option value="needs_review">needs_review</option>
            <option value="ready_to_publish">ready_to_publish</option>
            <option value="published">published</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Category ID</div>
          <input className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Condition</div>
          <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="NEW">NEW</option>
            <option value="USED_EXCELLENT">USED_EXCELLENT</option>
            <option value="USED_VERY_GOOD">USED_VERY_GOOD</option>
            <option value="USED_GOOD">USED_GOOD</option>
            <option value="USED_ACCEPTABLE">USED_ACCEPTABLE</option>
          </select>
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Price</div>
          <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Quantity</div>
          <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <div />
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Title</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Description</div>
        <textarea className="input" rows={10} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Item Specifics</h3>
        <p style={{ color: "#666", marginTop: 6 }}>
          These are sent to eBay as <strong>Inventory Item product.aspects</strong>. Add as many as you can (Mineral, Color, Shape, Weight, Size, Finish, etc.).
        </p>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          {Object.entries(specifics).map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <input
                className="input"
                value={k}
                onChange={(e) => {
                  const nk = e.target.value;
                  setSpecifics((prev) => {
                    const next = { ...prev };
                    const val = next[k];
                    delete next[k];
                    if (nk.trim()) next[nk.trim()] = val;
                    return next;
                  });
                }}
              />
              <input
                className="input"
                value={v}
                onChange={(e) => setSpecifics((prev) => ({ ...prev, [k]: e.target.value }))}
              />
              <button
                className="btn btn-secondary"
                onClick={() => setSpecifics((prev) => {
                  const next = { ...prev };
                  delete next[k];
                  return next;
                })}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setSpecifics((prev) => ({ ...prev, "Mineral": prev["Mineral"] || "" }))}
          >
            + Add Specific
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={save} disabled={isWorking}>
          {isWorking ? "Working…" : "Save"}
        </button>
        <button className="btn btn-secondary" onClick={regenerate} disabled={isWorking}>
          Regenerate from photos
        </button>
        <button className="btn btn-secondary" onClick={publish} disabled={isWorking}>
          Publish to eBay
        </button>
      </div>

      {props.initial.publishedListingId && (
        <p style={{ marginTop: 10, color: "#28a745" }}>
          Published. Listing ID: {props.initial.publishedListingId}
        </p>
      )}

      {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}
      {okMsg && <p style={{ marginTop: 10, color: "#28a745" }}>{okMsg}</p>}

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Photos served publicly at <code>/api/drops/images/{props.dropId}/0</code> … <code>/{Math.max(0, props.initial.imagesCount - 1)}</code>
      </p>
    </div>
  );
}


