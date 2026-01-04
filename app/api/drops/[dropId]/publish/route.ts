import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import {
  getValidEbayToken,
  refreshEbayToken,
  createOrReplaceInventoryItem,
  createEbayOffer,
  publishEbayOffer,
  getEbayPolicies,
  getCategorySuggestions,
} from "@/lib/ebay";

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

function parseEbayErrorFromMessage(msg: string): { errorId?: number; message?: string } | null {
  if (!msg || typeof msg !== "string") return null;
  const idx = msg.indexOf(":");
  if (idx < 0) return null;
  const maybeJson = msg.slice(idx + 1).trim();
  try {
    const parsed = JSON.parse(maybeJson);
    const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
    return {
      errorId: typeof first?.errorId === "number" ? first.errorId : undefined,
      message: typeof first?.message === "string" ? first.message : undefined,
    };
  } catch {
    return null;
  }
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
    if (!store.merchantLocationKey) {
      return NextResponse.json(
        { error: "Missing merchantLocationKey", storeDefaults: { merchantLocationKey: store.merchantLocationKey } },
        { status: 400 }
      );
    }
    const marketplaceId = store.marketplaceId || drop.marketplaceId || "EBAY_US";

    const title = requireString(drop.title, "title");
    const categoryId = requireString(drop.categoryId, "categoryId");
    const sku = drop.sku && typeof drop.sku === "string" ? drop.sku : `drop-${Date.now()}`;
    const quantity = drop.quantity && drop.quantity > 0 ? drop.quantity : 1;
    const priceValue = requireString(drop.price ? String(drop.price) : null, "price");
    const description = drop.description || null;
    const condition = drop.condition || "USED_GOOD";
    const aspects = (drop.specifics && typeof drop.specifics === "object") ? (drop.specifics as any) : undefined;

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

    // Auto-bootstrap policy IDs if missing (removes manual step).
    let paymentPolicyId = store.paymentPolicyId;
    let fulfillmentPolicyId = store.fulfillmentPolicyId;
    let returnPolicyId = store.returnPolicyId;
    if (!paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
      const policies = await getEbayPolicies(accessToken, marketplaceId);
      paymentPolicyId = paymentPolicyId || policies.paymentPolicies?.[0]?.paymentPolicyId || null;
      fulfillmentPolicyId = fulfillmentPolicyId || policies.fulfillmentPolicies?.[0]?.fulfillmentPolicyId || null;
      returnPolicyId = returnPolicyId || policies.returnPolicies?.[0]?.returnPolicyId || null;

      // Persist if we found anything
      if (paymentPolicyId || fulfillmentPolicyId || returnPolicyId) {
        await db.store.update({
          where: { id: store.id },
          data: {
            marketplaceId,
            ...(paymentPolicyId ? { paymentPolicyId } : {}),
            ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
            ...(returnPolicyId ? { returnPolicyId } : {}),
          },
        });
      }
    }

    if (!paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
      return NextResponse.json(
        {
          error:
            "Missing eBay policy IDs (payment/fulfillment/return). Create policies in Seller Hub, or load them via /api/ebay/diagnostics.",
          policyCounts: {
            payment: store.paymentPolicyId ? 1 : 0,
            fulfillment: store.fulfillmentPolicyId ? 1 : 0,
            return: store.returnPolicyId ? 1 : 0,
          },
          storeDefaults: {
            paymentPolicyId,
            fulfillmentPolicyId,
            returnPolicyId,
            merchantLocationKey: store.merchantLocationKey,
            marketplaceId,
          },
        },
        { status: 400 }
      );
    }

    // 1) Inventory Item
    await createOrReplaceInventoryItem(accessToken, sku, {
      title,
      description,
      condition,
      imageUrls,
      quantity,
      aspects,
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
      paymentPolicyId,
      fulfillmentPolicyId,
      returnPolicyId,
    });

    const offerId = (offerResp as any)?.offerId as string | undefined;
    if (!offerId) throw new Error(`eBay did not return offerId. Response: ${JSON.stringify(offerResp)}`);

    // 3) Publish
    let finalOfferId = offerId;
    let publishResp: any;
    try {
      publishResp = await publishEbayOffer(accessToken, offerId);
    } catch (e: any) {
      const parsed = parseEbayErrorFromMessage(String(e?.message || ""));
      // 25005: invalid category ID / not valid for listing; pick a valid suggestion and retry with a new offer.
      if (parsed?.errorId === 25005) {
        let suggestions: Array<{ categoryId: string; categoryName: string }> = [];
        try {
          suggestions = await getCategorySuggestions(accessToken, marketplaceId, title);
        } catch (taxErr: any) {
          return NextResponse.json(
            {
              error:
                "eBay rejected the categoryId as invalid. To auto-fix, reconnect eBay with taxonomy scope and retry.",
              ebayError: parsed,
              hint:
                "Re-connect eBay from /stores/new (we now request commerce.taxonomy.readonly). Then retry Publish.",
            },
            { status: 400 }
          );
        }

        const suggestedCategoryId = suggestions?.[0]?.categoryId || null;
        if (!suggestedCategoryId || suggestedCategoryId === categoryId) {
          return NextResponse.json(
            {
              error:
                "eBay rejected the categoryId as invalid. Select another leaf category and try again.",
              ebayError: parsed,
              suggestions,
            },
            { status: 400 }
          );
        }

        // Persist the better category on the drop so future publishes use it.
        await db.dropListing.update({
          where: { id: drop.id },
          data: { categoryId: suggestedCategoryId },
        });

        const offerResp2 = await createEbayOffer(accessToken, {
          sku,
          marketplaceId,
          merchantLocationKey: store.merchantLocationKey,
          categoryId: suggestedCategoryId,
          title,
          description,
          priceValue,
          currency: "USD",
          quantity,
          paymentPolicyId,
          fulfillmentPolicyId,
          returnPolicyId,
        });
        const offerId2 = (offerResp2 as any)?.offerId as string | undefined;
        if (!offerId2) throw new Error(`eBay did not return offerId (retry). Response: ${JSON.stringify(offerResp2)}`);

        finalOfferId = offerId2;
        publishResp = await publishEbayOffer(accessToken, offerId2);
      } else {
        throw e;
      }
    }

    const ebayListingId = (publishResp as any)?.listingId || null;

    const now = new Date();
    const listing = await db.listing.upsert({
      where: { ebayOfferId: finalOfferId },
      create: {
        storeId: store.id,
        ebayOfferId: finalOfferId,
        ebayListingId,
        sku,
        title,
        description,
        price: priceValue as any,
        quantity,
        status: "active",
        marketplaceId,
        categoryId: (drop.categoryId as any) || categoryId,
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
        categoryId: (drop.categoryId as any) || categoryId,
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

    return NextResponse.json({ ok: true, listingId: listing.id, ebayOfferId: finalOfferId, ebayListingId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Publish failed" }, { status: 500 });
  }
}


