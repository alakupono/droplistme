import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DropsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await getOrCreateUser();
  if (!user) redirect("/");

  const store = await db.store.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!store) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Drop Listings</h1>
          <p style={{ color: "#666", marginTop: 8 }}>Connect eBay first.</p>
          <div style={{ marginTop: 16 }}>
            <Link href="/stores/new" className="btn btn-primary">Connect eBay</Link>
          </div>
        </div>
      </div>
    );
  }

  const drops = await db.dropListing.findMany({
    where: { storeId: store.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>Drop Listings</h1>
          <p>Create listings from photos, review, then publish to eBay.</p>
        </div>
        <div className="admin-actions">
          <Link href="/drops/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
            New Drop Listing
          </Link>
          <Link href="/listings" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Listings
          </Link>
        </div>
      </div>

      <div className="profile-content">
        <div className="admin-card">
          <h2>Queue</h2>
          {drops.length === 0 ? (
            <p className="empty-message">No drop listings yet. Click “New Drop Listing”.</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Title</th>
                    <th>Price</th>
                    <th>Photos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {drops.map((d) => (
                    <tr key={d.id}>
                      <td>{new Date(d.createdAt).toLocaleString()}</td>
                      <td>{d.status}</td>
                      <td>{d.title || "(drafting…)"}</td>
                      <td>{d.price ? String(d.price) : "-"}</td>
                      <td>{d.images?.length || 0}</td>
                      <td>
                        <Link href={`/drops/${encodeURIComponent(d.id)}`} style={{ textDecoration: "none" }}>
                          Open →
                        </Link>
                      </td>
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


