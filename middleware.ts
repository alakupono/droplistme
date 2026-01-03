import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware((auth, req) => {
  // Allow public access to eBay webhook endpoint (no authentication required)
  if (req.nextUrl.pathname === '/api/ebay/webhook') {
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

