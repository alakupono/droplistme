import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { ListingsClient } from "./ListingsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ListingsPage() {
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
        <div className="profile-header">
          <div>
            <h1>Listings</h1>
            <p>Connect your eBay account to view and manage listings.</p>
          </div>
        </div>
        <div className="profile-content">
          <div className="admin-card">
            <h2>eBay Connection</h2>
            <p style={{ color: "#666", marginTop: 12 }}>
              You haven’t connected an eBay account yet.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/stores/new" className="btn btn-primary">
                Connect eBay
              </Link>
              <Link href="/profile" className="btn btn-secondary">
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const listings = await db.listing.findMany({
    where: { storeId: store.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>Listings</h1>
          <p>
            Connected as <strong>{store.ebayUsername || store.ebayStoreName || "eBay account"}</strong>
          </p>
        </div>
        <div className="admin-actions">
          <Link href="/listings/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Create Listing
          </Link>
          <Link href="/drops" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Drop Listings
          </Link>
          <Link href="/profile" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Profile
          </Link>
        </div>
      </div>

      <div className="profile-content">
        <div className="admin-card">
          <h2>Sync</h2>
          <p style={{ color: "#666", marginTop: 8 }}>
            Pull your current eBay offers into Droplist.me so you can manage them here.
          </p>
          <ListingsClient storeId={store.id} />
        </div>

        <div className="admin-card">
          <h2>My Listings</h2>
          {listings.length === 0 ? (
            <p className="empty-message">No listings synced yet. Click “Sync from eBay”.</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/listings/${encodeURIComponent(l.id)}`} style={{ textDecoration: "none" }}>
                          <strong style={{ color: "#111" }}>{l.title}</strong>
                        </Link>
                        {l.sku && <div style={{ fontSize: 12, color: "#999" }}>SKU: {l.sku}</div>}
                      </td>
                      <td>{l.status}</td>
                      <td>{l.price ? String(l.price) : "-"}</td>
                      <td>{l.quantity}</td>
                      <td>{new Date(l.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


