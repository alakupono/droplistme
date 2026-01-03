import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { ebayApiRequest, getValidEbayToken, refreshEbayToken } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
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

  // eBay Account API: optInToProgram
  // Docs show it can take up to 24 hours to process.
  await ebayApiRequest("/sell/account/v1/program/opt_in", accessToken, {
    method: "POST",
    body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
  });

  return NextResponse.json(
    {
      ok: true,
      message:
        "Opt-in request sent for SELLING_POLICY_MANAGEMENT. eBay may take up to 24 hours to process.",
    },
    { status: 200 }
  );
}


