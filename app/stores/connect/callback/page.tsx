import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { exchangeEbayCode, getEbayOAuthRedirectUri } from "@/lib/ebay";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ code?: string; error?: string; state?: string }>;
}

export default async function ConnectCallbackPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const user = await getOrCreateUser();

  if (!user) {
    redirect("/");
  }

  const params = await searchParams;
  const { code, error, state } = params;

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
    const redirectUri = getEbayOAuthRedirectUri();
    const tokenResponse = await exchangeEbayCode(code, redirectUri);

    // Get eBay account info and identity
    const ebayLib = await import('@/lib/ebay');
    const [accountInfo, identityInfo] = await Promise.all([
      ebayLib.getEbayAccount(tokenResponse.access_token).catch(() => null),
      ebayLib.getEbayIdentity(tokenResponse.access_token).catch(() => null),
    ]);

    // Determine store name from available info
    const storeName = 
      identityInfo?.username || 
      accountInfo?.username || 
      accountInfo?.accountId || 
      'eBay Store';

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Create store record
    const store = await db.store.create({
      data: {
        userId: user.id,
        ebayStoreName: storeName,
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
            <Link href="/stores" className="btn btn-primary">
              Go to Stores
            </Link>
          </div>
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

