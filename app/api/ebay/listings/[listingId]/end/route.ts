import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, withdrawEbayOffer } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ listingId: string }> }) {
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

  const resp = await withdrawEbayOffer(accessToken, listing.ebayOfferId);

  await db.listing.update({
    where: { id: listing.id },
    data: { status: "ended" },
  });

  return NextResponse.json({ ok: true, result: resp }, { status: 200 });
}


