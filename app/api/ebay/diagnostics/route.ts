import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import {
  getValidEbayToken,
  refreshEbayToken,
  getEbayIdentity,
  getEbayAccount,
  getEbayPolicies,
  getEbayInventoryLocations,
} from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!store) return NextResponse.json({ error: "No connected eBay account" }, { status: 400 });
  if (!store.ebayAccessToken) return NextResponse.json({ error: "Store not connected" }, { status: 400 });

  const marketplaceId = store.marketplaceId || "EBAY_US";

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
    // We'll still try; diagnostics will surface failures.
  }

  const [identity, account, policies, locations] = await Promise.all([
    getEbayIdentity(accessToken).catch((e) => ({ error: String(e?.message || e) })),
    getEbayAccount(accessToken).catch((e) => ({ error: String(e?.message || e) })),
    getEbayPolicies(accessToken, marketplaceId).catch((e) => ({ error: String(e?.message || e) })),
    getEbayInventoryLocations(accessToken).catch((e) => ({ error: String(e?.message || e) })),
  ]);

  return NextResponse.json(
    {
      ok: true,
      marketplaceId,
      connectedAs: store.ebayUsername || store.ebayStoreName || null,
      storedDefaults: {
        merchantLocationKey: store.merchantLocationKey,
        paymentPolicyId: store.paymentPolicyId,
        fulfillmentPolicyId: store.fulfillmentPolicyId,
        returnPolicyId: store.returnPolicyId,
      },
      identity,
      account,
      policies,
      locations,
      nextRequirements: {
        needsMerchantLocationKey: !store.merchantLocationKey,
        needsPaymentPolicyId: !store.paymentPolicyId,
        needsFulfillmentPolicyId: !store.fulfillmentPolicyId,
        needsReturnPolicyId: !store.returnPolicyId,
      },
    },
    { status: 200 }
  );
}


