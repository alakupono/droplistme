import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { ebayApiRequest, getValidEbayToken, refreshEbayToken } from "@/lib/ebay";

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

  const resp = await ebayApiRequest("/sell/account/v1/program/get_opted_in_programs", accessToken, {
    method: "GET",
  });

  const programs: any[] = resp?.programs || resp?.optedInPrograms || [];
  const hasBusinessPolicies = programs.some((p) => p?.programType === "SELLING_POLICY_MANAGEMENT");

  return NextResponse.json({ ok: true, hasBusinessPolicies, programs }, { status: 200 });
}


