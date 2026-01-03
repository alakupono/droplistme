import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default async function AdminPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  // Check if user is admin
  if (!(await isAdmin())) {
    redirect("/");
  }

  // Get all users with stats
  const users = await db.user.findMany({
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
    orderBy: {
      createdAt: "desc",
    },
  });

  // Get overall stats
  const totalUsers = users.length;
  const totalStores = await db.store.count();
  const totalListings = await db.listing.count();

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Admin Panel</h1>
          <p>User Management Dashboard</p>
        </div>
        <div className="admin-actions">
          <Link href="/profile" className="btn btn-secondary">
            My Profile
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-number">{totalUsers}</p>
        </div>
        <div className="stat-card">
          <h3>Total Stores</h3>
          <p className="stat-number">{totalStores}</p>
        </div>
        <div className="stat-card">
          <h3>Total Listings</h3>
          <p className="stat-number">{totalListings}</p>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-card">
          <h2>All Users</h2>
          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>Stores</th>
                  <th>Listings</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const totalListings = user.stores.reduce(
                    (sum, store) => sum + store._count.listings,
                    0
                  );
                  return (
                    <tr key={user.id}>
                      <td>{user.email || "N/A"}</td>
                      <td className="user-id">{user.id.slice(0, 8)}...</td>
                      <td>{user._count.stores}</td>
                      <td>{totalListings}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td>
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="btn-link"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

