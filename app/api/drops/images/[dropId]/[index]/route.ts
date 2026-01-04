import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Uint8Array } {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!m) throw new Error("Invalid data URL");
  const contentType = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64, "base64");
  return { contentType, bytes: new Uint8Array(buf) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ dropId: string; index: string }> }) {
  try {
    const { dropId, index } = await params;
    const idx = parseInt(index, 10);
    if (!Number.isFinite(idx) || idx < 0) return new Response("Not found", { status: 404 });

    const drop = await db.dropListing.findUnique({
      where: { id: dropId },
      select: { images: true },
    });
    if (!drop) return new Response("Not found", { status: 404 });
    if (!drop.images || idx >= drop.images.length) return new Response("Not found", { status: 404 });

    const { contentType, bytes } = decodeDataUrl(drop.images[idx]);
    // Force a real ArrayBuffer (not SharedArrayBuffer) for TS/DOM compatibility.
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: contentType });
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow caching; images won't change for a given drop in MVP.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}


