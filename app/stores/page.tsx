import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

export default async function StoresPage() {
  const { userId } = await auth();
  
  if (!userId) {
    // Don't silently bounce to home (looks like the button does nothing).
    // Show a clear signed-out state and let the user sign in.
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Sign in required</h1>
          <p>You must be signed in to view your Stores dashboard.</p>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/" className="btn btn-primary">
              Go to Sign In
            </Link>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            Tip: make sure you’re using <strong>https://www.droplist.me</strong> (not the apex domain) so your session is consistent.
          </p>
        </div>
      </div>
    );
  }

  const user = await getOrCreateUser();

  if (!user) {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "NOT SET";
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Couldn’t load Stores</h1>
          <p>
            We couldn’t load your dashboard. This is usually a database or environment-variable issue.
          </p>
          {process.env.NODE_ENV === "production" && (
            <p style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
              Most common cause: your production database is missing tables. Ensure Vercel runs Prisma migrations
              (we now run <code>prisma migrate deploy</code> during builds).
            </p>
          )}
          <div style={{ marginTop: 16, padding: 16, background: "#f8f9fa", borderRadius: 8, fontSize: 14, color: "#666" }}>
            <p><strong>Debug info</strong></p>
            <p>Clerk userId: {userId}</p>
            <p>DATABASE_URL: {hasDbUrl ? "Set" : "NOT SET"}</p>
            <p>NEXT_PUBLIC_APP_URL: {appUrl}</p>
            <p>Environment: {process.env.NODE_ENV || "unknown"}</p>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/" className="btn btn-primary">
              Go Home
            </Link>
            <Link href="/profile" className="btn btn-secondary">
              Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get user's stores with listing counts
  const stores = await db.store.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { listings: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>My Dashboard</h1>
          <p>Manage your eBay stores and listings</p>
        </div>
        <div className="admin-actions">
          <Link href="/stores/new" className="btn btn-primary">
            + Add New Store
          </Link>
          <Link href="/profile" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Profile
          </Link>
        </div>
      </div>

      <div className="profile-content">
        {/* Dashboard Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <h3>Total Stores</h3>
            <p className="stat-number">{stores.length}</p>
          </div>
          <div className="stat-card">
            <h3>Total Listings</h3>
            <p className="stat-number">
              {stores.reduce((sum: number, store: typeof stores[0]) => sum + store._count.listings, 0)}
            </p>
          </div>
          <div className="stat-card">
            <h3>Connected Stores</h3>
            <p className="stat-number">
              {stores.filter((store: typeof stores[0]) => store.ebayAccessToken).length}
            </p>
          </div>
        </div>

        {/* eBay Store Management Section */}
        <div className="admin-card">
          <h2>eBay Store Management</h2>
          {stores.length === 0 ? (
            <div className="empty-state">
              <h3>No stores yet</h3>
              <p>Connect your first eBay store to start listing items</p>
              <Link href="/stores/new" className="btn btn-primary">
                Connect Your First Store
              </Link>
            </div>
          ) : (
            <>
              {/* Table View */}
              <div className="admin-card" style={{ marginBottom: '24px' }}>
                <h2>All Stores</h2>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Store Name</th>
                        <th>Status</th>
                        <th>Listings</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((store) => (
                        <tr key={store.id}>
                          <td>
                            <strong>{store.ebayStoreName || "Unnamed Store"}</strong>
                          </td>
                          <td>
                            <span className={`store-status ${store.ebayAccessToken ? "connected" : "disconnected"}`}>
                              {store.ebayAccessToken ? "Connected" : "Not Connected"}
                            </span>
                          </td>
                          <td>{store._count.listings}</td>
                          <td>{new Date(store.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {store.ebayAccessToken ? (
                                <>
                                  <Link href={`/stores/${store.id}/listings`} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                                    Listings
                                  </Link>
                                  <Link href={`/stores/${store.id}`} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                                    Settings
                                  </Link>
                                </>
                              ) : (
                                <Link href={`/stores/${store.id}/connect`} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                                  Connect
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grid View (Alternative) */}
              <div className="stores-grid">
                {stores.map((store) => (
                  <div key={store.id} className="store-card">
                    <div className="store-card-header">
                      <h3>{store.ebayStoreName || "Unnamed Store"}</h3>
                      <span className={`store-status ${store.ebayAccessToken ? "connected" : "disconnected"}`}>
                        {store.ebayAccessToken ? "Connected" : "Not Connected"}
                      </span>
                    </div>
                    <div className="store-card-body">
                      <div className="store-stat">
                        <span className="store-stat-label">Listings</span>
                        <span className="store-stat-value">{store._count.listings}</span>
                      </div>
                      <div className="store-stat">
                        <span className="store-stat-label">Created</span>
                        <span className="store-stat-value">
                          {new Date(store.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="store-card-actions">
                      {store.ebayAccessToken ? (
                        <>
                          <Link href={`/stores/${store.id}/listings`} className="btn btn-primary">
                            Manage Listings
                          </Link>
                          <Link href={`/stores/${store.id}`} className="btn btn-secondary">
                            Settings
                          </Link>
                        </>
                      ) : (
                        <Link href={`/stores/${store.id}/connect`} className="btn btn-primary" style={{ width: '100%' }}>
                          Connect to eBay
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

