import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { DropDetailClient } from "./DropDetailClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ dropId: string }>;
}

export default async function DropDetailPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await getOrCreateUser();
  if (!user) redirect("/");

  const { dropId } = await params;
  const drop = await db.dropListing.findFirst({
    where: { id: dropId, store: { userId: user.id } },
    include: { store: true },
  });
  if (!drop) {
    return (
      <div className="profile-container glass-shell">
        <div className="admin-card">
          <h1>Drop not found</h1>
          <Link href="/drops" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
            Back to Drops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container glass-shell">
      <div className="profile-header">
        <div>
          <h1>Drop Listing</h1>
          <p>Status: <strong>{drop.status}</strong></p>
        </div>
        <div className="admin-actions">
          <Link href="/drops" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Back
          </Link>
        </div>
      </div>

      <div className="profile-content">
        <div className="admin-card">
          <h2>Photos</h2>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {drop.images.slice(0, 8).map((_, i) => {
              const url = `/api/drops/images/${encodeURIComponent(drop.id)}/${i}`;
              return (
                <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`drop-${i}`} style={{ width: "100%", height: 160, objectFit: "cover" }} />
                </div>
              );
            })}
          </div>
        </div>

        <DropDetailClient
          dropId={drop.id}
          initial={{
            status: drop.status,
            title: drop.title,
            description: drop.description,
            categoryId: drop.categoryId,
            condition: drop.condition,
            price: drop.price ? String(drop.price) : null,
            quantity: drop.quantity,
            imagesCount: drop.images.length,
            publishedListingId: drop.publishedListingId,
            specifics: (drop as any).specifics ?? null,
          }}
        />

        <div className="admin-card">
          <h2>eBay Publish Preview</h2>
          <div style={{ marginTop: 10, fontSize: 14, color: "#444" }}>
            <div><strong>merchantLocationKey:</strong> {drop.store.merchantLocationKey || "(missing)"}</div>
            <div><strong>paymentPolicyId:</strong> {drop.store.paymentPolicyId || "(missing)"}</div>
            <div><strong>fulfillmentPolicyId:</strong> {drop.store.fulfillmentPolicyId || "(missing)"}</div>
            <div><strong>returnPolicyId:</strong> {drop.store.returnPolicyId || "(missing)"}</div>
            <div><strong>categoryId:</strong> {drop.categoryId || "(missing)"}</div>
            <div><strong>condition:</strong> {drop.condition || "(missing)"}</div>
            <div><strong>sku:</strong> {drop.sku || "(auto)"} </div>
            <div><strong>images:</strong> {drop.images.length}</div>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Item specifics are sent to eBay as Inventory Item <code>product.aspects</code>.
          </p>
        </div>

        {drop.aiNotes?.length ? (
          <div className="admin-card">
            <h2>AI Notes</h2>
            <ul style={{ marginTop: 10 }}>
              {drop.aiNotes.map((n, idx) => (
                <li key={idx}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}


