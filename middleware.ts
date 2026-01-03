import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  // Force a single canonical domain in production to avoid Clerk session/cookie mismatch.
  // If the user logs in on one hostname and navigates on another, auth() can appear "signed out".
  const host = req.headers.get("host");
  if (host === "droplist.me") {
    const url = req.nextUrl.clone();
    url.host = "www.droplist.me";
    return NextResponse.redirect(url, 308);
  }

  // Allow public access to eBay webhook endpoint (no authentication required)
  if (req.nextUrl.pathname === "/api/ebay/webhook") {
    return;
  }
  // All other routes require authentication
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

