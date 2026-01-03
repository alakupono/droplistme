import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * eBay Webhook Handler
 * 
 * Handles eBay event notifications, including:
 * - Marketplace Account Deletion
 * - Other eBay events
 * 
 * According to eBay documentation:
 * https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#overview
 * 
 * eBay sends a GET challenge request first to verify the endpoint.
 * Then sends actual event notifications via POST.
 */

/**
 * Handle GET request - eBay Challenge Verification
 * 
 * eBay sends: GET https://droplist.me/api/ebay/webhook?challenge_code=123
 * 
 * We must respond with SHA-256 hash of: challengeCode + verificationToken + endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeCode = searchParams.get('challenge_code');

    if (!challengeCode) {
      // No challenge code, return status endpoint info
      return NextResponse.json({
        message: 'eBay webhook endpoint is active',
        timestamp: new Date().toISOString(),
        verificationToken: process.env.EBAY_VERIFICATION_TOKEN ? 'Set' : 'Not set',
      });
    }

    // Get verification token and endpoint URL
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
    if (!verificationToken) {
      console.error('EBAY_VERIFICATION_TOKEN is not set');
      return NextResponse.json(
        { error: 'Verification token not configured' },
        { status: 500 }
      );
    }

    // Get the full endpoint URL (eBay expects the exact URL used in dashboard)
    // Important: Must match EXACTLY what's configured in eBay Dashboard
    // According to eBay docs: "the endpoint URL should use the 'https' protocol"
    // Remove query parameters and ensure no trailing slash
    const requestUrl = new URL(request.url);
    let endpoint = `${requestUrl.protocol}//${requestUrl.host}${requestUrl.pathname}`;
    
    // Remove trailing slash if present (eBay is strict about exact match)
    endpoint = endpoint.replace(/\/$/, '');
    
    // Log for debugging - this should match exactly what's in eBay Dashboard
    console.log('eBay Challenge - Endpoint URL for hash:', endpoint);
    console.log('eBay Challenge - Verification token length:', verificationToken.length);
    console.log('eBay Challenge - Challenge code:', challengeCode);

    // Compute SHA-256 hash: challengeCode + verificationToken + endpoint
    // Order is CRITICAL: challengeCode first, then verificationToken, then endpoint
    // According to eBay docs, all must be strings and concatenated in this exact order
    const hash = createHash('sha256');
    
    // Ensure all are strings (they should be, but be explicit)
    const challengeCodeStr = String(challengeCode);
    const verificationTokenStr = String(verificationToken);
    const endpointStr = String(endpoint);
    
    // Update hash in exact order specified by eBay
    hash.update(challengeCodeStr, 'utf8');
    hash.update(verificationTokenStr, 'utf8');
    hash.update(endpointStr, 'utf8');
    
    const challengeResponse = hash.digest('hex');

    // Log full details for debugging (be careful not to log full token in production)
    console.log('eBay Challenge Verification:', {
      challengeCode: challengeCode.substring(0, 10) + '...',
      endpoint: endpoint,
      verificationTokenLength: verificationToken.length,
      verificationTokenPrefix: verificationToken.substring(0, 10) + '...',
      responseHash: challengeResponse,
      responseHashLength: challengeResponse.length,
    });

    // Return challengeResponse in JSON format
    // Content-Type must be application/json
    return NextResponse.json(
      { challengeResponse },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error processing eBay challenge:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle POST request - eBay Event Notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    // Log incoming webhook for debugging
    console.log('eBay Webhook POST received:', {
      headers: {
        'x-ebay-signature': headers['x-ebay-signature'],
        'x-ebay-event-topic': headers['x-ebay-event-topic'],
        'content-type': headers['content-type'],
      },
      bodyLength: body.length,
    });

    // Handle actual event notifications
    const eventTopic = headers['x-ebay-event-topic'];
    const signature = headers['x-ebay-signature'];

    // Verify signature if provided (recommended for production)
    if (signature && process.env.EBAY_VERIFICATION_TOKEN) {
      // In production, you should verify the signature
      // This is a simplified version - eBay may provide signature verification details
      console.log('Signature verification:', signature);
    }

    let eventData;
    try {
      eventData = JSON.parse(body);
    } catch (e) {
      console.error('Failed to parse webhook body:', e);
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (eventTopic) {
      case 'MARKETPLACE_ACCOUNT_DELETION':
        await handleMarketplaceAccountDeletion(eventData);
        break;
      
      default:
        console.log('Unhandled event topic:', eventTopic);
        // Log unknown events but don't fail
    }

    // Always return 200 OK to acknowledge receipt
    // eBay accepts: 200 OK, 201 Created, 202 Accepted, or 204 No Content
    return NextResponse.json({ received: true }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error: any) {
    console.error('Error processing eBay webhook:', error);
    // Return 200 to acknowledge receipt (eBay will retry if needed)
    // Don't return 500 as it may cause issues with eBay's retry logic
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { 
        status: 200, // Acknowledge receipt even on error
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle Marketplace Account Deletion event
 * This occurs when an eBay user deletes their account
 * 
 * Event structure according to eBay docs:
 * {
 *   "metadata": {
 *     "topic": "MARKETPLACE_ACCOUNT_DELETION",
 *     "schemaVersion": "...",
 *     "deprecated": false
 *   },
 *   "notification": {
 *     "notificationId": "...",
 *     "eventDate": "...",
 *     "publishDate": "...",
 *     "publishAttemptCount": 1,
 *     "data": {
 *       "username": "...",
 *       "userId": "...",
 *       "eiasToken": "..."
 *     }
 *   }
 * }
 */
async function handleMarketplaceAccountDeletion(eventData: any) {
  console.log('Processing Marketplace Account Deletion:', JSON.stringify(eventData, null, 2));

  try {
    // Extract user information from the event
    // According to eBay docs, data is nested in notification.data
    const notificationData = eventData?.notification?.data || eventData?.data || eventData;
    const ebayUserId = notificationData?.userId;
    const username = notificationData?.username;
    const eiasToken = notificationData?.eiasToken;
    
    console.log('Account Deletion Details:', {
      userId: ebayUserId,
      username: username,
      eiasToken: eiasToken ? eiasToken.substring(0, 10) + '...' : null,
    });

    if (!ebayUserId && !eiasToken) {
      console.warn('No user ID or eiasToken found in deletion event');
      // Still acknowledge the notification
      return;
    }

    // Find stores associated with this eBay account
    // Note: We may need to match by eiasToken or userId
    // For now, we'll mark all stores as disconnected if we can't match specifically
    // In the future, you might want to store ebayUserId when connecting accounts
    
    const stores = await db.store.findMany({
      where: {
        ebayAccessToken: {
          not: null,
        },
      },
    });

    // Mark stores as disconnected
    // According to eBay: "Deletion should be done in a manner such that even 
    // the highest system privilege cannot reverse the deletion."
    for (const store of stores) {
      await db.store.update({
        where: { id: store.id },
        data: {
          ebayAccessToken: null,
          ebayRefreshToken: null,
          ebayTokenExpiry: null,
        },
      });

      console.log(`Disconnected store ${store.id} (${store.ebayStoreName}) due to account deletion`);
    }

    // Optionally, you could also delete the store records entirely:
    // await db.store.deleteMany({ where: { ... } });

  } catch (error) {
    console.error('Error handling account deletion:', error);
    // Don't throw - we still need to acknowledge the notification
    // Log the error for investigation
  }
}

