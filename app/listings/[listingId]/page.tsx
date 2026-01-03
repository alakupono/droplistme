import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { ListingActionsClient } from "./ListingActionsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ listingId: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await getOrCreateUser();
  if (!user) redirect("/");

  const { listingId } = await params;
  const listing = await db.listing.findFirst({
    where: { id: listingId, store: { userId: user.id } },
    include: { store: true },
  });

  if (!listing) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Listing not found</h1>
          <Link href="/listings" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>{listing.title}</h1>
          <p style={{ color: "#666" }}>
            Status: <strong>{listing.status}</strong>
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
          <h2>Identifiers</h2>
          <div style={{ marginTop: 10, fontSize: 14, color: "#444" }}>
            <div><strong>Offer ID:</strong> {listing.ebayOfferId || "-"}</div>
            <div><strong>Listing ID:</strong> {listing.ebayListingId || "-"}</div>
            <div><strong>SKU:</strong> {listing.sku || "-"}</div>
            <div><strong>Marketplace:</strong> {listing.marketplaceId || "-"}</div>
            <div><strong>Category ID:</strong> {listing.categoryId || "-"}</div>
          </div>
        </div>

        <div className="admin-card">
          <h2>Details</h2>
          <div style={{ marginTop: 10, fontSize: 14, color: "#444" }}>
            <div><strong>Price:</strong> {listing.price ? String(listing.price) : "-"}</div>
            <div><strong>Quantity:</strong> {listing.quantity}</div>
            <div><strong>Condition:</strong> {listing.condition || "-"}</div>
            <div><strong>Listed At:</strong> {listing.listedAt ? new Date(listing.listedAt).toLocaleString() : "-"}</div>
            <div><strong>Updated:</strong> {new Date(listing.updatedAt).toLocaleString()}</div>
          </div>

          <ListingActionsClient
            listingId={listing.id}
            currentPrice={listing.price ? String(listing.price) : undefined}
            currentQty={listing.quantity}
          />

          {listing.description && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Description</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{listing.description}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


