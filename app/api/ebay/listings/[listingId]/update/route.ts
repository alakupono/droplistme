import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, updateEbayOfferPriceQuantity } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asOptionalPriceString(val: any): string | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "number") return val.toFixed(2);
  if (typeof val === "string") {
    const n = Number(val.trim());
    if (!Number.isFinite(n) || n <= 0) throw new Error("price must be a positive number");
    return n.toFixed(2);
  }
  return undefined;
}

function asOptionalInt(val: any): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const n = typeof val === "number" ? val : typeof val === "string" ? parseInt(val, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new Error("quantity must be a positive integer");
  return n;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
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

    const body = await req.json();
    const priceValue = asOptionalPriceString(body.price);
    const quantity = asOptionalInt(body.quantity);
    const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : "USD";
    if (!priceValue && typeof quantity !== "number") {
      return NextResponse.json({ error: "Provide price and/or quantity" }, { status: 400 });
    }

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

    const resp = await updateEbayOfferPriceQuantity(accessToken, listing.ebayOfferId, {
      priceValue,
      currency,
      quantity,
    });

    const updated = await db.listing.update({
      where: { id: listing.id },
      data: {
        ...(priceValue ? { price: priceValue as any } : {}),
        ...(typeof quantity === "number" ? { quantity } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, listing: updated, result: resp }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update listing" }, { status: 500 });
  }
}


