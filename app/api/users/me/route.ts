import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";

/**
 * GET /api/users/me - Get current user profile
 */
export async function GET() {
  try {
    const user = await getOrCreateUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

