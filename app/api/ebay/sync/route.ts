import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { getValidEbayToken, refreshEbayToken, ebayApiRequest } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asNumberString(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val;
  if (typeof val === "object" && typeof val.value !== "undefined") return String(val.value);
  return String(val);
}

async function fetchOffers(accessToken: string) {
  // Sell Inventory API - offers
  // We only need a basic sync to get visible listings in Droplist.me.
  // Pagination can be added later.
  return ebayApiRequest("/sell/inventory/v1/offer?limit=200", accessToken, { method: "GET" });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, userId: user.id } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  if (!store.ebayAccessToken) return NextResponse.json({ error: "Store not connected" }, { status: 400 });

  // Ensure token is valid; refresh and persist if needed
  let accessToken = store.ebayAccessToken;
  try {
    accessToken = await getValidEbayToken(store.ebayAccessToken, store.ebayRefreshToken, store.ebayTokenExpiry);
    if (accessToken !== store.ebayAccessToken) {
      // We refreshed; persist a new expiry estimate (eBay returns expires_in on refresh, but helper doesn't)
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
    // fall through; we'll try with current token and refresh on 401
  }

  let offers: any;
  try {
    offers = await fetchOffers(accessToken);
  } catch (e: any) {
    const msg = e?.message || "";
    // If unauthorized, refresh once and retry
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      if (!store.ebayRefreshToken) {
        return NextResponse.json({ error: "Token expired; reconnect eBay" }, { status: 401 });
      }
      const refreshed = await refreshEbayToken(store.ebayRefreshToken);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expires_in);
      await db.store.update({
        where: { id: store.id },
        data: { ebayAccessToken: refreshed.access_token, ebayTokenExpiry: expiresAt },
      });
      offers = await fetchOffers(refreshed.access_token);
    } else {
      return NextResponse.json({ error: e?.message || "Failed to fetch offers" }, { status: 500 });
    }
  }

  const offerList: any[] = offers?.offers || offers?.offerSummaries || [];
  let upserted = 0;

  for (const o of offerList) {
    const ebayOfferId = o.offerId || o.offer?.offerId || null;
    if (!ebayOfferId) continue;

    const sku = o.sku || o.inventoryItemGroupKey || null;
    const title = o.listingDescription?.title || o.listingDescription?.description || o.title || "Untitled";
    const description = o.listingDescription?.description || null;
    const marketplaceId = o.marketplaceId || null;
    const quantity = typeof o.availableQuantity === "number" ? o.availableQuantity : 1;
    const status = (o.status || o.offerStatus || "active").toString().toLowerCase();
    const priceStr =
      asNumberString(o.pricingSummary?.price?.value) ||
      asNumberString(o.pricingSummary?.price) ||
      asNumberString(o.pricingSummary?.pricingSummary?.price?.value) ||
      null;

    await db.listing.upsert({
      where: { ebayOfferId },
      create: {
        storeId: store.id,
        ebayOfferId,
        sku,
        ebayItemId: null,
        title,
        description,
        price: priceStr ? (priceStr as any) : null,
        quantity,
        status,
        marketplaceId,
        images: [],
      },
      update: {
        sku,
        title,
        description,
        price: priceStr ? (priceStr as any) : null,
        quantity,
        status,
        marketplaceId,
      },
    });

    upserted++;
  }

  return NextResponse.json({ ok: true, upserted }, { status: 200 });
}


