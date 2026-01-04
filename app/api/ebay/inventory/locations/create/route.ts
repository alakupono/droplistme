import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { ebayApiRequest, getValidEbayToken, refreshEbayToken } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requiredString(val: unknown, name: string): string {
  if (typeof val !== "string" || val.trim().length === 0) throw new Error(`${name} is required`);
  return val.trim();
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

    const body = await req.json().catch(() => ({}));
    const merchantLocationKey = requiredString(body.merchantLocationKey, "merchantLocationKey");
    const country = requiredString(body.country, "country");
    const postalCode = requiredString(body.postalCode, "postalCode");
    const phone = requiredString(body.phone, "phone");

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

    // Inventory API: createInventoryLocation
    // Endpoint documented as POST /location/{merchantLocationKey}
    // Minimal warehouse requirement: location.address.country + location.address.postalCode and phone.
    const resp = await ebayApiRequest(
      `/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          location: {
            address: {
              country,
              postalCode,
            },
          },
          phone,
        }),
      }
    );

    await db.store.update({
      where: { id: store.id },
      data: { merchantLocationKey },
    });

    return NextResponse.json({ ok: true, merchantLocationKey, result: resp }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create location" }, { status: 500 });
  }
}


