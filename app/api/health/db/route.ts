import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Dev-only DB health check.
 * - Returns 200 if Prisma can run a trivial query.
 * - Returns 404 in production to avoid exposing DB health publicly.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Minimal query that works across Postgres versions.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = await db.$queryRaw`SELECT 1 as ok`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "DB check failed",
      },
      { status: 500 }
    );
  }
}


