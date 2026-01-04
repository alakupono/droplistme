import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { analyzeDropImages } from "@/lib/openai";
import { computePrice } from "@/lib/dropPricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDataUrl(s: string) {
  return s.startsWith("data:image/");
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
    if (!store) return NextResponse.json({ error: "No store connected" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const images: string[] = Array.isArray(body.images) ? body.images : [];
    if (images.length < 1 || images.length > 8) {
      return NextResponse.json({ error: "Upload between 1 and 8 photos" }, { status: 400 });
    }
    for (const img of images) {
      if (typeof img !== "string" || !isDataUrl(img)) {
        return NextResponse.json({ error: "Images must be data URLs (data:image/...)" }, { status: 400 });
      }
      // rough size guard (base64 bloat): keep under ~1.5MB each
      if (img.length > 2_000_000) {
        return NextResponse.json({ error: "One or more images are too large. Please upload smaller photos." }, { status: 400 });
      }
    }

    // Create placeholder row first
    const drop = await db.dropListing.create({
      data: {
        storeId: store.id,
        status: "processing",
        images,
        marketplaceId: store.marketplaceId || "EBAY_US",
        aiNotes: [],
      },
    });

    // Run AI analysis
    const draft = await analyzeDropImages(images);

    // Price: prefer computed price range if signals exist; otherwise keep AI price
    let recommendedPrice = draft.price;
    const sig: any = draft.pricingSignals || {};
    const tier = sig.tier === "A" || sig.tier === "B" || sig.tier === "C" ? sig.tier : "B";
    const uniqueness = sig.uniqueness === "Standout" ? "Standout" : "Standard";
    const color_saturation = sig.color_saturation === "Muted" ? "Muted" : "Vibrant";
    const surface_quality = sig.surface_quality === "Rough" ? "Rough" : "Polished";
    const shipping_cost_usd = typeof sig.shipping_cost_usd === "number" ? sig.shipping_cost_usd : null;

    const priced = computePrice({ tier, uniqueness, color_saturation, surface_quality, shipping_cost_usd });
    const mid = (priced.price_range_usd.min + priced.price_range_usd.max) / 2;
    if (Number.isFinite(mid) && mid > 0) {
      recommendedPrice = mid.toFixed(2);
    }

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
        sku: `drop-${Date.now()}`,
        specifics: draft.specifics as any,
        aiExtractedText: draft.extractedText || null,
        aiRaw: draft as any,
        aiNotes: draft.notes || [],
      },
    });

    return NextResponse.json({ ok: true, drop: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create drop listing" }, { status: 500 });
  }
}


