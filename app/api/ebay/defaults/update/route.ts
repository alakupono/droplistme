import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optStr(v: any): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
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
    if (!store) return NextResponse.json({ error: "No store found" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const marketplaceId = optStr(body.marketplaceId);
    const paymentPolicyId = optStr(body.paymentPolicyId);
    const fulfillmentPolicyId = optStr(body.fulfillmentPolicyId);
    const returnPolicyId = optStr(body.returnPolicyId);

    const updated = await db.store.update({
      where: { id: store.id },
      data: {
        ...(marketplaceId ? { marketplaceId } : {}),
        ...(paymentPolicyId ? { paymentPolicyId } : {}),
        ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
        ...(returnPolicyId ? { returnPolicyId } : {}),
      },
    });

    return NextResponse.json({ ok: true, store: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update defaults" }, { status: 500 });
  }
}


