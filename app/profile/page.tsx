import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ProfilePage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const clerkUser = await currentUser();
  const user = await getOrCreateUser();

  if (!user || !clerkUser) {
    redirect("/");
  }

  // Get user stats
  const stats = await db.user.findUnique({
    where: { id: user.id },
    include: {
      _count: {
        select: {
          stores: true,
          listings: true,
        },
      },
      stores: {
        include: {
          _count: {
            select: { listings: true },
          },
        },
      },
    },
  });

  const isAdmin = clerkUser.publicMetadata?.role === "admin";

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        {isAdmin && (
          <Link href="/admin" className="btn btn-admin">
            Admin Panel
          </Link>
        )}
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <h2>Account Information</h2>
          <div className="profile-info">
            <div className="info-row">
              <span className="label">Name:</span>
              <span className="value">
                {clerkUser.firstName} {clerkUser.lastName}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Email:</span>
              <span className="value">
                {clerkUser.emailAddresses[0]?.emailAddress || "N/A"}
              </span>
            </div>
            <div className="info-row">
              <span className="label">User ID:</span>
              <span className="value">{user.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Member Since:</span>
              <span className="value">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
            {isAdmin && (
              <div className="info-row">
                <span className="label">Role:</span>
                <span className="value badge-admin">Admin</span>
              </div>
            )}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Stores</h3>
            <p className="stat-number">{stats?._count.stores || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Listings</h3>
            <p className="stat-number">{stats?._count.listings || 0}</p>
          </div>
        </div>

        {stats?.stores && stats.stores.length > 0 && (
          <div className="profile-card">
            <h2>My Stores</h2>
            <div className="stores-list">
              {stats.stores.map((store) => (
                <div key={store.id} className="store-item">
                  <div>
                    <h3>{store.ebayStoreName || "Unnamed Store"}</h3>
                    <p>{store._count.listings} listings</p>
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

