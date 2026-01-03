import { redirect } from "next/navigation";
import { exchangeEbayCode, getEbayRedirectUriParam, parseEbayState } from "@/lib/ebay";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface PageProps {
  searchParams: Promise<{ code?: string; error?: string; state?: string }>;
}

export default async function ConnectCallbackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { code, error, state } = params;

  const parsed = parseEbayState(state);
  if (!parsed) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Connection Failed</h1>
          <p style={{ color: "#dc3545", marginBottom: "20px" }}>
            Missing or invalid OAuth state. Please start the connection flow again from Droplist.me.
          </p>
          <Link href="/listings" className="btn btn-primary">
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  const user = await db.user.findUnique({ where: { id: parsed.userDbId } });
  if (!user) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Connection Failed</h1>
          <p style={{ color: "#dc3545", marginBottom: "20px" }}>
            Could not find your Droplist user record. Please sign in and retry.
          </p>
          <Link href="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle OAuth errors
  if (error) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Connection Failed</h1>
          <p style={{ color: '#dc3545', marginBottom: '20px' }}>
            There was an error connecting your eBay account: {error}
          </p>
          <Link href="/stores/new" className="btn btn-primary">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  // Handle missing authorization code
  if (!code) {
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Connection Failed</h1>
          <p style={{ color: '#dc3545', marginBottom: '20px' }}>
            No authorization code received from eBay.
          </p>
          <Link href="/stores/new" className="btn btn-primary">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  try {
    // Exchange code for tokens
    // IMPORTANT: must be the exact same redirect_uri used during the authorize step
    const redirectUri = getEbayRedirectUriParam();
    const tokenResponse = await exchangeEbayCode(code, redirectUri);

    // Get eBay account info and identity
    const ebayLib = await import('@/lib/ebay');
    const [accountInfo, identityInfo] = await Promise.all([
      ebayLib.getEbayAccount(tokenResponse.access_token).catch(() => null),
      ebayLib.getEbayIdentity(tokenResponse.access_token).catch(() => null),
    ]);

    // Determine store name + identity
    const ebayUsername = identityInfo?.username || accountInfo?.username || null;
    const ebayUserId = identityInfo?.userId || null;
    const storeName =
      ebayUsername ||
      accountInfo?.accountId ||
      "eBay Store";

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Single account per app user: update existing record if present, otherwise create.
    const existing = await db.store.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const store = existing
      ? await db.store.update({
          where: { id: existing.id },
          data: {
            ebayStoreName: storeName,
            ebayUsername,
            ebayUserId,
            ebayAccessToken: tokenResponse.access_token,
            ebayRefreshToken: tokenResponse.refresh_token,
            ebayTokenExpiry: expiresAt,
          },
        })
      : await db.store.create({
          data: {
            userId: user.id,
            ebayStoreName: storeName,
            ebayUsername,
            ebayUserId,
            ebayAccessToken: tokenResponse.access_token,
            ebayRefreshToken: tokenResponse.refresh_token,
            ebayTokenExpiry: expiresAt,
          },
        });

    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Successfully Connected!</h1>
          <p style={{ color: '#28a745', marginBottom: '20px' }}>
            Your eBay account has been successfully connected.
          </p>
          <div style={{ marginTop: '24px' }}>
            <Link href="/listings" className="btn btn-primary">
              Go to Listings
            </Link>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            You can close this tab now and return to Droplist.me.
          </p>
        </div>
      </div>
    );
  } catch (error: any) {
    console.error('Error connecting eBay account:', error);
    return (
      <div className="profile-container">
        <div className="admin-card">
          <h1>Connection Failed</h1>
          <p style={{ color: '#dc3545', marginBottom: '20px' }}>
            {error?.message || 'An error occurred while connecting your eBay account.'}
          </p>
          <Link href="/stores/new" className="btn btn-primary">
            Try Again
          </Link>
        </div>
      </div>
    );
  }
}

