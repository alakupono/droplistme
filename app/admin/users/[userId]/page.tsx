import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: currentUserId } = await auth();
  
  if (!currentUserId) {
    redirect("/");
  }

  // Check if user is admin
  if (!(await isAdmin())) {
    redirect("/");
  }

  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      stores: {
        include: {
          _count: {
            select: { listings: true },
          },
        },
      },
      _count: {
        select: {
          stores: true,
        },
      },
    },
  });

  if (!user) {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <h1>User Not Found</h1>
          <Link href="/admin" className="btn btn-primary">
            Back to Admin Panel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <Link href="/admin" className="btn-link">← Back to Admin</Link>
          <h1>User Details</h1>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-card">
          <h2>User Information</h2>
          <div className="profile-info">
            <div className="info-row">
              <span className="label">User ID:</span>
              <span className="value">{user.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Clerk User ID:</span>
              <span className="value">{user.clerkUserId}</span>
            </div>
            <div className="info-row">
              <span className="label">Email:</span>
              <span className="value">{user.email || "N/A"}</span>
            </div>
            <div className="info-row">
              <span className="label">Created:</span>
              <span className="value">
                {new Date(user.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Last Updated:</span>
              <span className="value">
                {new Date(user.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Stores</h3>
              <p className="stat-number">{user._count.stores}</p>
            </div>
            <div className="stat-card">
              <h3>Listings</h3>
              <p className="stat-number">
                {user.stores.reduce(
                  (sum, store) => sum + store._count.listings,
                  0
                )}
              </p>
            </div>
          </div>
        </div>

        {user.stores.length > 0 && (
          <div className="admin-card">
            <h2>Stores</h2>
            <div className="stores-list">
              {user.stores.map((store) => (
                <div key={store.id} className="store-item">
                  <div>
                    <h3>{store.ebayStoreName || "Unnamed Store"}</h3>
                    <p>{store._count.listings} listings</p>
                    <p className="store-meta">
                      Created: {new Date(store.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="store-status">
                    {store.ebayAccessToken ? "Connected" : "Not Connected"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

