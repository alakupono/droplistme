import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, publishEbayOffer } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ listingId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { listingId } = await params;
    const listing = await db.listing.findFirst({
      where: { id: listingId, store: { userId: user.id } },
      include: { store: true },
    });

    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    if (!listing.ebayOfferId) return NextResponse.json({ error: "Listing has no ebayOfferId" }, { status: 400 });
    if (!listing.store.ebayAccessToken) return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });

    // Ensure token is valid; refresh and persist if needed
    let accessToken = listing.store.ebayAccessToken;
    try {
      accessToken = await getValidEbayToken(
        listing.store.ebayAccessToken,
        listing.store.ebayRefreshToken,
        listing.store.ebayTokenExpiry
      );
      if (accessToken !== listing.store.ebayAccessToken) {
        const refreshed = await refreshEbayToken(listing.store.ebayRefreshToken!);
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expires_in);
        accessToken = refreshed.access_token;
        await db.store.update({
          where: { id: listing.store.id },
          data: { ebayAccessToken: refreshed.access_token, ebayTokenExpiry: expiresAt },
        });
      }
    } catch {
      // continue
    }

    const resp = await publishEbayOffer(accessToken, listing.ebayOfferId);
    const ebayListingId = (resp as any)?.listingId || null;

    const updated = await db.listing.update({
      where: { id: listing.id },
      data: {
        ebayListingId,
        status: "active",
        listedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, listing: updated, result: resp }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to publish offer" }, { status: 500 });
  }
}


