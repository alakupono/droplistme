import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { analyzeDropImages } from "@/lib/openai";
import { computePrice } from "@/lib/dropPricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    await db.dropListing.update({ where: { id: drop.id }, data: { status: "processing", error: null } });

    const draft = await analyzeDropImages(drop.images);
    let recommendedPrice = draft.price;
    const sig: any = draft.pricingSignals || {};
    const tier = sig.tier === "A" || sig.tier === "B" || sig.tier === "C" ? sig.tier : "B";
    const uniqueness = sig.uniqueness === "Standout" ? "Standout" : "Standard";
    const color_saturation = sig.color_saturation === "Muted" ? "Muted" : "Vibrant";
    const surface_quality = sig.surface_quality === "Rough" ? "Rough" : "Polished";
    const shipping_cost_usd = typeof sig.shipping_cost_usd === "number" ? sig.shipping_cost_usd : null;
    const priced = computePrice({ tier, uniqueness, color_saturation, surface_quality, shipping_cost_usd });
    const mid = (priced.price_range_usd.min + priced.price_range_usd.max) / 2;
    if (Number.isFinite(mid) && mid > 0) recommendedPrice = mid.toFixed(2);

    const updated = await db.dropListing.update({
      where: { id: drop.id },
      data: {
        status: "needs_review",
        title: draft.title.slice(0, 80),
        description: draft.description,
        categoryId: draft.categoryId,
        condition: draft.condition,
        price: recommendedPrice as any,
        quantity: draft.quantity || 1,
        aiExtractedText: draft.extractedText || null,
        aiRaw: draft as any,
        aiNotes: draft.notes || [],
      },
    });

    return NextResponse.json({ ok: true, drop: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Regenerate failed" }, { status: 500 });
  }
}


