"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Policy = { name?: string; paymentPolicyId?: string; fulfillmentPolicyId?: string; returnPolicyId?: string };
type Location = { merchantLocationKey?: string; name?: string; location?: any };

export function ManualListingClient(props: {
  storeId: string;
  marketplaceId: string;
  paymentPolicies: any[];
  fulfillmentPolicies: any[];
  returnPolicies: any[];
  locations: any[];
  defaults: {
    merchantLocationKey?: string | null;
    paymentPolicyId?: string | null;
    fulfillmentPolicyId?: string | null;
    returnPolicyId?: string | null;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState(() => `dl-${Date.now()}`);
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [currency, setCurrency] = useState("USD");
  const [condition, setCondition] = useState("NEW");
  const [imageUrlsText, setImageUrlsText] = useState("");

  const [merchantLocationKey, setMerchantLocationKey] = useState(props.defaults.merchantLocationKey || "");
  const [paymentPolicyId, setPaymentPolicyId] = useState(props.defaults.paymentPolicyId || "");
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState(props.defaults.fulfillmentPolicyId || "");
  const [returnPolicyId, setReturnPolicyId] = useState(props.defaults.returnPolicyId || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const imageUrls = useMemo(() => {
    return imageUrlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [imageUrlsText]);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ebay/listings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: props.storeId,
          marketplaceId: props.marketplaceId,
          merchantLocationKey,
          paymentPolicyId,
          fulfillmentPolicyId,
          returnPolicyId,
          title,
          description,
          sku,
          categoryId,
          price,
          currency,
          quantity,
          condition,
          imageUrls,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Create failed (${res.status})`);
      setResult(json);
      router.refresh();
      if (json?.listingId) router.push(`/listings/${encodeURIComponent(json.listingId)}`);
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="admin-card" style={{ marginTop: 0 }}>
        <h2>Manual Listing</h2>
        <p style={{ color: "#666", marginTop: 8 }}>
          This creates an inventory item + offer + publishes it on eBay. You must pick policies + a warehouse location.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Title *</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>SKU *</div>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Category ID *</div>
            <input className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="e.g. 9355" />
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
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Price *</div>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 19.99" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Quantity</div>
            <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Currency</div>
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Marketplace</div>
            <input className="input" value={props.marketplaceId} disabled />
          </label>
        </div>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Description</div>
          <textarea className="input" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Image URLs (one per line)</div>
          <textarea className="input" rows={4} value={imageUrlsText} onChange={(e) => setImageUrlsText(e.target.value)} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Warehouse (merchantLocationKey) *</div>
            <select className="input" value={merchantLocationKey} onChange={(e) => setMerchantLocationKey(e.target.value)}>
              <option value="">Select a location…</option>
              {props.locations.map((l: Location, idx: number) => (
                <option key={`${l.merchantLocationKey || idx}`} value={l.merchantLocationKey || ""}>
                  {l.merchantLocationKey || "Unknown"}{l.name ? ` — ${l.name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Payment Policy *</div>
            <select className="input" value={paymentPolicyId} onChange={(e) => setPaymentPolicyId(e.target.value)}>
              <option value="">Select…</option>
              {props.paymentPolicies.map((p: any, idx: number) => (
                <option key={p.paymentPolicyId || idx} value={p.paymentPolicyId || ""}>
                  {p.name || p.paymentPolicyId}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Fulfillment Policy *</div>
            <select className="input" value={fulfillmentPolicyId} onChange={(e) => setFulfillmentPolicyId(e.target.value)}>
              <option value="">Select…</option>
              {props.fulfillmentPolicies.map((p: any, idx: number) => (
                <option key={p.fulfillmentPolicyId || idx} value={p.fulfillmentPolicyId || ""}>
                  {p.name || p.fulfillmentPolicyId}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Return Policy *</div>
            <select className="input" value={returnPolicyId} onChange={(e) => setReturnPolicyId(e.target.value)}>
              <option value="">Select…</option>
              {props.returnPolicies.map((p: any, idx: number) => (
                <option key={p.returnPolicyId || idx} value={p.returnPolicyId || ""}>
                  {p.name || p.returnPolicyId}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Publishing…" : "Create & Publish on eBay"}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/listings")} disabled={isSubmitting}>
            Back
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 10, color: "#dc3545", fontSize: 14 }}>
            {error}
          </p>
        )}

        {result && (
          <pre style={{ marginTop: 10, background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}


