import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function StoresPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const user = await getOrCreateUser();

  if (!user) {
    redirect("/");
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
          <Link href="/profile" className="btn-link">← Back to Profile</Link>
          <h1>My Stores</h1>
          <p>Manage your eBay stores and listings</p>
        </div>
        <Link href="/stores/new" className="btn btn-primary">
          + Add New Store
        </Link>
      </div>

      <div className="profile-content">
        {stores.length === 0 ? (
          <div className="admin-card">
            <div className="empty-state">
              <h2>No stores yet</h2>
              <p>Create your first eBay store to start listing items</p>
              <Link href="/stores/new" className="btn btn-primary">
                Create Your First Store
              </Link>
            </div>
          </div>
        ) : (
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
                  <Link href={`/stores/${store.id}`} className="btn btn-secondary">
                    View Details
                  </Link>
                  <Link href={`/stores/${store.id}/listings`} className="btn btn-primary">
                    Manage Listings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

