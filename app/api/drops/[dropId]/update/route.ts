import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ dropId: string }> }) {
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

    const body = await req.json().catch(() => ({}));
    const data: any = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 80);
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId.trim();
    if (typeof body.condition === "string") data.condition = body.condition.trim();
    if (typeof body.price === "string" || typeof body.price === "number") data.price = String(body.price) as any;
    if (typeof body.quantity === "number") data.quantity = Math.max(1, Math.floor(body.quantity));
    if (typeof body.status === "string") data.status = body.status;
    if (body.specifics && typeof body.specifics === "object") data.specifics = body.specifics;

    const updated = await db.dropListing.update({ where: { id: drop.id }, data });
    return NextResponse.json({ ok: true, drop: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 });
  }
}


