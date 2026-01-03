import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import {
  getValidEbayToken,
  refreshEbayToken,
  createOrReplaceInventoryItem,
  createEbayOffer,
  publishEbayOffer,
} from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requiredString(val: unknown, name: string): string {
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return val.trim();
}

function asInt(val: unknown, name: string, def: number): number {
  const n = typeof val === "number" ? val : typeof val === "string" ? parseInt(val, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return def;
}

function asPriceString(val: unknown): string {
  if (typeof val === "number") return val.toFixed(2);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) throw new Error("price is required");
    // basic normalization
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) throw new Error("price must be a positive number");
    return n.toFixed(2);
  }
  throw new Error("price is required");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const store = await db.store.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!store || !store.ebayAccessToken) {
      return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
    }

    const body = await req.json();

    const title = requiredString(body.title, "title");
    const description = typeof body.description === "string" ? body.description : null;
    const sku = requiredString(body.sku, "sku");
    const categoryId = requiredString(body.categoryId, "categoryId");
    const marketplaceId = (typeof body.marketplaceId === "string" && body.marketplaceId.trim()) || store.marketplaceId || "EBAY_US";
    const merchantLocationKey =
      (typeof body.merchantLocationKey === "string" && body.merchantLocationKey.trim()) || store.merchantLocationKey;
    const paymentPolicyId =
      (typeof body.paymentPolicyId === "string" && body.paymentPolicyId.trim()) || store.paymentPolicyId;
    const fulfillmentPolicyId =
      (typeof body.fulfillmentPolicyId === "string" && body.fulfillmentPolicyId.trim()) || store.fulfillmentPolicyId;
    const returnPolicyId =
      (typeof body.returnPolicyId === "string" && body.returnPolicyId.trim()) || store.returnPolicyId;

    if (!merchantLocationKey) throw new Error("merchantLocationKey is required (inventory location / warehouse)");
    if (!paymentPolicyId) throw new Error("paymentPolicyId is required");
    if (!fulfillmentPolicyId) throw new Error("fulfillmentPolicyId is required");
    if (!returnPolicyId) throw new Error("returnPolicyId is required");

    const quantity = asInt(body.quantity, "quantity", 1);
    const priceValue = asPriceString(body.price);
    const currency = (typeof body.currency === "string" && body.currency.trim()) || "USD";
    const condition = typeof body.condition === "string" ? body.condition : null;
    const imageUrls: string[] =
      Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: any) => typeof u === "string" && u.trim()).map((u: string) => u.trim()) : [];

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
      // continue; we'll fail with a clear error if token is invalid
    }

    // Persist user defaults for next time
    await db.store.update({
      where: { id: store.id },
      data: {
        marketplaceId,
        merchantLocationKey,
        paymentPolicyId,
        fulfillmentPolicyId,
        returnPolicyId,
      },
    });

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
      merchantLocationKey,
      categoryId,
      title,
      description,
      priceValue,
      currency,
      quantity,
      paymentPolicyId,
      fulfillmentPolicyId,
      returnPolicyId,
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

    return NextResponse.json(
      {
        ok: true,
        listingId: listing.id,
        ebayOfferId: offerId,
        ebayListingId,
        publish: publishResp,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create listing" }, { status: 500 });
  }
}


