import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, createOrReplaceInventoryItem, createEbayOffer, publishEbayOffer } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireString(v: any, name: string): string {
  if (typeof v !== "string" || v.trim().length === 0) throw new Error(`${name} is required`);
  return v.trim();
}

function baseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && typeof appUrl === "string" && appUrl.trim()) return appUrl.trim().replace(/\/$/, "");
  // production fallback
  return "https://www.droplist.me";
}

export async function POST(_req: Request, { params }: { params: Promise<{ dropId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { dropId } = await params;
    const drop = await db.dropListing.findFirst({
      where: { id: dropId, store: { userId: user.id } },
      include: { store: true },
    });
    if (!drop) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const store = drop.store;
    if (!store.ebayAccessToken) return NextResponse.json({ error: "eBay not connected" }, { status: 400 });
    if (!store.merchantLocationKey) return NextResponse.json({ error: "Missing merchantLocationKey" }, { status: 400 });
    if (!store.paymentPolicyId || !store.fulfillmentPolicyId || !store.returnPolicyId) {
      return NextResponse.json({ error: "Missing eBay policy IDs (payment/fulfillment/return)" }, { status: 400 });
    }

    const title = requireString(drop.title, "title");
    const categoryId = requireString(drop.categoryId, "categoryId");
    const sku = drop.sku && typeof drop.sku === "string" ? drop.sku : `drop-${Date.now()}`;
    const marketplaceId = store.marketplaceId || drop.marketplaceId || "EBAY_US";
    const quantity = drop.quantity && drop.quantity > 0 ? drop.quantity : 1;
    const priceValue = requireString(drop.price ? String(drop.price) : null, "price");
    const description = drop.description || null;
    const condition = drop.condition || "USED_GOOD";

    // Build public image URLs that eBay can fetch
    const imageUrls = (drop.images || []).slice(0, 8).map((_, i) => {
      return `${baseUrl()}/api/drops/images/${encodeURIComponent(drop.id)}/${i}`;
    });

    // Ensure token is valid; refresh and persist if needed
    let accessToken = store.ebayAccessToken;
    try {
      accessToken = await getValidEbayToken(store.ebayAccessToken, store.ebayRefreshToken, store.ebayTokenExpiry);
      if (accessToken !== store.ebayAccessToken) {
        const refreshed = await refreshEbayToken(store.ebayRefreshToken!);
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expires_in);
        accessToken = refreshed.access_token;
        await db.store.update({
          where: { id: store.id },
          data: { ebayAccessToken: refreshed.access_token, ebayTokenExpiry: expiresAt },
        });
      }
    } catch {
      // continue
    }

    // 1) Inventory Item
    await createOrReplaceInventoryItem(accessToken, sku, {
      title,
      description,
      condition,
      imageUrls,
      quantity,
    });

    // 2) Offer
    const offerResp = await createEbayOffer(accessToken, {
      sku,
      marketplaceId,
      merchantLocationKey: store.merchantLocationKey,
      categoryId,
      title,
      description,
      priceValue,
      currency: "USD",
      quantity,
      paymentPolicyId: store.paymentPolicyId,
      fulfillmentPolicyId: store.fulfillmentPolicyId,
      returnPolicyId: store.returnPolicyId,
    });

    const offerId = (offerResp as any)?.offerId as string | undefined;
    if (!offerId) throw new Error(`eBay did not return offerId. Response: ${JSON.stringify(offerResp)}`);

    // 3) Publish
    const publishResp = await publishEbayOffer(accessToken, offerId);
    const ebayListingId = (publishResp as any)?.listingId || null;

    const now = new Date();
    const listing = await db.listing.upsert({
      where: { ebayOfferId: offerId },
      create: {
        storeId: store.id,
        ebayOfferId: offerId,
        ebayListingId,
        sku,
        title,
        description,
        price: priceValue as any,
        quantity,
        status: "active",
        marketplaceId,
        categoryId,
        condition,
        images: imageUrls,
        listedAt: now,
      },
      update: {
        ebayListingId,
        sku,
        title,
        description,
        price: priceValue as any,
        quantity,
        status: "active",
        marketplaceId,
        categoryId,
        condition,
        images: imageUrls,
        listedAt: now,
      },
    });

    await db.dropListing.update({
      where: { id: drop.id },
      data: {
        status: "published",
        publishedListingId: listing.id,
      },
    });

    return NextResponse.json({ ok: true, listingId: listing.id, ebayOfferId: offerId, ebayListingId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Publish failed" }, { status: 500 });
  }
}


