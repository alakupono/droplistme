import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { DropUploaderClient } from "./DropUploaderClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewDropPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await getOrCreateUser();
  if (!user) redirect("/");

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>New Drop Listing</h1>
          <p>Create a draft listing from photos, then review before publishing.</p>
        </div>
        <div className="admin-actions">
          <Link href="/drops" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Back
          </Link>
        </div>
      </div>
      <div className="profile-content">
        <div className="admin-card">
          <DropUploaderClient />
          <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            Note: Set <code>OPENAI_API_KEY</code> in your environment for AI draft generation.
          </p>
        </div>
      </div>
    </div>
  );
}


