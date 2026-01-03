import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, getEbayPolicies, getEbayInventoryLocations } from "@/lib/ebay";
import { ManualListingClient } from "./ManualListingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewListingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await getOrCreateUser();
  if (!user) redirect("/");

  const store = await db.store.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!store || !store.ebayAccessToken) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Create Listing</h1>
          <p style={{ color: "#666", marginTop: 8 }}>
            Connect your eBay account first.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/stores/new" className="btn btn-primary">
              Connect eBay
            </Link>
            <Link href="/listings" className="btn btn-secondary">
              Back to Listings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ensure token is valid; refresh and persist if needed (so server-side policy fetch works reliably)
  let accessToken = store.ebayAccessToken;
  try {
    accessToken = await getValidEbayToken(store.ebayAccessToken, store.ebayRefreshToken, store.ebayTokenExpiry);
    if (accessToken !== store.ebayAccessToken) {
      const refreshed = await refreshEbayToken(store.ebayRefreshToken!);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expires_in);
      accessToken = refreshed.access_token;
      await db.store.update({
        where: { id: store.id },
        data: { ebayAccessToken: refreshed.access_token, ebayTokenExpiry: expiresAt },
      });
    }
  } catch {
    // continue; fetch will surface issues
  }

  const marketplaceId = store.marketplaceId || "EBAY_US";

  const [policies, locationsResp] = await Promise.all([
    getEbayPolicies(accessToken, marketplaceId),
    getEbayInventoryLocations(accessToken),
  ]);

  const locations = (locationsResp as any)?.locations || (locationsResp as any)?.locationSummaries || [];
  const policyEligibilityError =
    (policies as any)?.raw?.payment?.error ||
    (policies as any)?.raw?.fulfillment?.error ||
    (policies as any)?.raw?.return?.error ||
    null;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>Create Listing</h1>
          <p>
            Create and publish a fixed-price listing on eBay.
          </p>
        </div>
        <div className="admin-actions">
          <Link href="/listings" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Back
          </Link>
        </div>
      </div>

      <div className="profile-content">
        <div className="admin-card">
          <h2>Connection Requirements</h2>
          <p style={{ color: "#666", marginTop: 8 }}>
            If the dropdowns below are empty, you likely need to create business policies and/or an inventory location in your eBay account (sandbox/production).
          </p>
          {policyEligibilityError && String(policyEligibilityError).includes("not eligible for Business Policy") && (
            <p style={{ marginTop: 12, color: "#dc3545" }}>
              <strong>Blocked:</strong> eBay says this account is <strong>not eligible for Business Policies</strong> (error 20403).
              Without policy IDs, eBay will not allow publishing offers via the Sell Inventory flow.
            </p>
          )}
          <div style={{ marginTop: 12, fontSize: 14, color: "#444" }}>
            <div><strong>Marketplace:</strong> {marketplaceId}</div>
            <div><strong>Payment policies:</strong> {policies.paymentPolicies.length}</div>
            <div><strong>Fulfillment policies:</strong> {policies.fulfillmentPolicies.length}</div>
            <div><strong>Return policies:</strong> {policies.returnPolicies.length}</div>
            <div><strong>Inventory locations:</strong> {locations.length}</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/api/ebay/diagnostics" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              View raw diagnostics JSON
            </Link>
          </div>
        </div>

        <ManualListingClient
          storeId={store.id}
          marketplaceId={marketplaceId}
          paymentPolicies={policies.paymentPolicies}
          fulfillmentPolicies={policies.fulfillmentPolicies}
          returnPolicies={policies.returnPolicies}
          locations={locations}
          defaults={{
            merchantLocationKey: store.merchantLocationKey,
            paymentPolicyId: store.paymentPolicyId,
            fulfillmentPolicyId: store.fulfillmentPolicyId,
            returnPolicyId: store.returnPolicyId,
          }}
        />
      </div>
    </div>
  );
}


