import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getEbayAuthUrl, getEbayRedirectUriParam } from "@/lib/ebay";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function NewStorePage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const user = await getOrCreateUser();

  if (!user) {
    redirect("/");
  }

  // Generate OAuth URL for eBay
  // IMPORTANT (eBay): redirect_uri is typically the RuName ("eBay Redirect URL name")
  const redirectUri = getEbayRedirectUriParam();
  const authUrl = getEbayAuthUrl(redirectUri, user.id);

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <Link href="/stores" className="btn-link">← Back to Stores</Link>
          <h1>Connect eBay Store</h1>
          <p>Connect your eBay account to start listing items</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="admin-card">
          <h2>eBay Account Connection</h2>
          <div style={{ marginTop: '24px' }}>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              To connect your eBay store, you'll need to authorize Droplist.me to access your eBay account.
              This allows us to create and manage listings on your behalf.
            </p>
            
            <div style={{ 
              background: '#f8f9fa', 
              padding: '20px', 
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>What you'll authorize:</h3>
              <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: '#666' }}>
                <li>Create and manage inventory listings</li>
                <li>View your marketing information</li>
                <li>Access your store information</li>
              </ul>
            </div>

            <a 
              href={authUrl}
              className="btn btn-primary"
              style={{ 
                display: 'inline-block',
                textDecoration: 'none',
                marginTop: '16px'
              }}
            >
              Connect to eBay
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

