/**
 * eBay API Integration
 * 
 * This module handles eBay API authentication and operations.
 * Uses eBay's OAuth 2.0 for authentication and RESTful API for operations.
 */

// eBay API Configuration
export const EBAY_CONFIG = {
  // Sandbox URLs
  sandbox: {
    authUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    apiUrl: 'https://api.sandbox.ebay.com',
  },
  // Production URLs
  production: {
    authUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    apiUrl: 'https://api.ebay.com',
  },
}

// Get eBay API configuration based on environment
export function getEbayConfig() {
  const useSandbox = process.env.EBAY_ENVIRONMENT === 'sandbox' || !process.env.EBAY_ENVIRONMENT
  return useSandbox ? EBAY_CONFIG.sandbox : EBAY_CONFIG.production
}

/**
 * Generate eBay OAuth authorization URL
 */
export function getEbayAuthUrl(redirectUri: string, state?: string): string {
  const config = getEbayConfig()
  const clientId = process.env.EBAY_CLIENT_ID
  
  if (!clientId) {
    throw new Error('EBAY_CLIENT_ID is not set in environment variables')
  }

  // eBay is strict: redirect_uri must be a *registered redirect URI*.
  // For eBay OAuth, redirect_uri is typically the RuName ("eBay Redirect URL name") configured in
  // eBay Developer Portal → "Your eBay Sign-in Settings" (not the raw callback URL).
  // If this mismatches you get invalid_request / unauthorized_client.

  // Request scopes needed for listing items and managing inventory
  // Based on eBay API documentation and enabled scopes
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory', // View and manage inventory/offers
    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly', // View marketing activities
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly', // View account settings
    'https://api.ebay.com/oauth/api_scope/sell.account', // Manage seller account settings (required by some account endpoints)
    'https://api.ebay.com/oauth/api_scope/sell.stores.readonly', // View eBay stores
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly', // View user info
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
  })

  if (state) {
    params.append('state', state)
  }

  return `${config.authUrl}?${params.toString()}`
}

/**
 * Centralized redirect identifier used for BOTH:
 * - Authorization request (redirect_uri param)
 * - Token exchange request (redirect_uri param)
 *
 * IMPORTANT for eBay OAuth:
 * `redirect_uri` should be the **RuName** ("eBay Redirect URL name"), not a raw URL.
 * Set `EBAY_RU_NAME` in your environment to this value.
 *
 * Fallback behavior:
 * If `EBAY_RU_NAME` is not set, we fall back to `EBAY_OAUTH_REDIRECT_URI` (raw URL) for
 * non-standard setups / local testing, but production should use RuName.
 */
export function getEbayRedirectUriParam(): string {
  const ruName = process.env.EBAY_RU_NAME
  if (ruName && typeof ruName === 'string' && ruName.trim().length > 0) {
    return ruName.trim()
  }

  const explicitUrl = process.env.EBAY_OAUTH_REDIRECT_URI
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim().length > 0) {
    return explicitUrl.trim()
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && typeof appUrl === 'string' && appUrl.trim().length > 0) {
    const base = appUrl.trim().replace(/\/$/, '')
    return `${base}/stores/connect/callback`
  }

  // Last resort for local dev only.
  return 'http://localhost:3000/stores/connect/callback'
}

/**
 * Generate a signed OAuth state so we can complete the callback even if the user loses their Clerk session.
 * Format: base64url(userDbId).timestamp.hex(hmac)
 */
export function generateEbayState(userDbId: string): string {
  const secret = process.env.EBAY_STATE_SECRET
  if (!secret) {
    // Dev fallback: still works but not tamper-proof. Set EBAY_STATE_SECRET in production.
    return userDbId
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac } = require('crypto') as typeof import('crypto')
  const ts = Date.now().toString()
  const payload = `${userDbId}.${ts}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  const b64 = Buffer.from(userDbId, 'utf8').toString('base64url')
  return `${b64}.${ts}.${sig}`
}

export function parseEbayState(state: string | null | undefined): { userDbId: string } | null {
  if (!state) return null
  const secret = process.env.EBAY_STATE_SECRET

  // Dev fallback (unsigned)
  if (!secret && state.includes('.') === false) {
    return { userDbId: state }
  }
  if (!secret) return null

  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [b64, ts, sig] = parts
  const userDbId = Buffer.from(b64, 'base64url').toString('utf8')
  if (!userDbId) return null

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto')
  const payload = `${userDbId}.${ts}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(sig, 'utf8')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return { userDbId }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeEbayCode(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}> {
  const config = getEbayConfig()
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    const env = process.env.EBAY_ENVIRONMENT || 'sandbox(default)'
    const clientIdPreview = `${clientId.slice(0, 12)}…${clientId.slice(-6)}`
    const secretLen = clientSecret.length
    throw new Error(
      `Failed to exchange code for token: ${error}\n` +
        `Debug: EBAY_ENVIRONMENT=${env}, tokenUrl=${config.tokenUrl}, ` +
        `clientId=${clientIdPreview}, clientSecretLen=${secretLen}, redirect_uri=${redirectUri}`
    )
  }

  return await response.json()
}

/**
 * Refresh eBay access token
 */
export async function refreshEbayToken(
  refreshToken: string
): Promise<{
  access_token: string
  expires_in: number
  token_type: string
}> {
  const config = getEbayConfig()
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing.readonly https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.stores.readonly https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return await response.json()
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidEbayToken(
  accessToken: string | null,
  refreshToken: string | null,
  tokenExpiry: Date | null
): Promise<string> {
  // If token is expired or will expire in the next 5 minutes, refresh it
  if (!accessToken || !refreshToken || !tokenExpiry || new Date() >= new Date(tokenExpiry.getTime() - 5 * 60 * 1000)) {
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }
    const newToken = await refreshEbayToken(refreshToken)
    return newToken.access_token
  }

  return accessToken
}

/**
 * Make authenticated eBay API request
 */
export async function ebayApiRequest(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<any> {
  const config = getEbayConfig()
  const url = `${config.apiUrl}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `eBay API request failed (HTTP ${response.status}) ${endpoint}: ${errorText}`
    )
  }

  return await response.json()
}

/**
 * Get user's eBay account information
 * Returns account details including username, account ID, etc.
 */
export async function getEbayAccount(accessToken: string) {
  return ebayApiRequest('/sell/account/v1/account', accessToken, { method: 'GET' })
}

/**
 * Get user's eBay identity (username, email, etc.)
 */
export async function getEbayIdentity(accessToken: string) {
  return ebayApiRequest('/commerce/identity/v1/user', accessToken, { method: 'GET' })
}

/**
 * Get user's eBay stores
 */
export async function getEbayStores(accessToken: string) {
  return ebayApiRequest('/sell/account/v1/store', accessToken, { method: 'GET' })
}

/**
 * Get eBay business policies needed to publish offers.
 * These come from the Sell Account API and are marketplace-specific.
 */
export async function getEbayPolicies(accessToken: string, marketplaceId: string) {
  const qs = `?marketplace_id=${encodeURIComponent(marketplaceId)}`
  const [payment, fulfillment, ret] = await Promise.all([
    ebayApiRequest(`/sell/account/v1/payment_policy${qs}`, accessToken, { method: 'GET' }).catch((e) => ({
      error: String(e?.message || e),
    })),
    ebayApiRequest(`/sell/account/v1/fulfillment_policy${qs}`, accessToken, { method: 'GET' }).catch((e) => ({
      error: String(e?.message || e),
    })),
    ebayApiRequest(`/sell/account/v1/return_policy${qs}`, accessToken, { method: 'GET' }).catch((e) => ({
      error: String(e?.message || e),
    })),
  ])

  return {
    paymentPolicies: (payment as any)?.paymentPolicies || [],
    fulfillmentPolicies: (fulfillment as any)?.fulfillmentPolicies || [],
    returnPolicies: (ret as any)?.returnPolicies || [],
    raw: { payment, fulfillment, return: ret },
  }
}

/**
 * Inventory locations (warehouse / ship-from). Offers require merchantLocationKey.
 */
export async function getEbayInventoryLocations(accessToken: string) {
  // Inventory API - locations
  return ebayApiRequest('/sell/inventory/v1/location?limit=100', accessToken, { method: 'GET' })
}

/**
 * Create or replace an inventory item (identified by SKU).
 * This is step 1 of: inventory item -> offer -> publish.
 */
export async function createOrReplaceInventoryItem(
  accessToken: string,
  sku: string,
  payload: {
    title: string
    description?: string | null
    condition?: string | null
    imageUrls?: string[]
    quantity: number
  }
) {
  const body: any = {
    product: {
      title: payload.title,
    },
    availability: {
      shipToLocationAvailability: {
        quantity: payload.quantity,
      },
    },
  }

  if (payload.description) body.product.description = payload.description
  if (payload.condition) body.condition = payload.condition
  if (payload.imageUrls && payload.imageUrls.length > 0) body.product.imageUrls = payload.imageUrls

  return ebayApiRequest(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Create an offer for an inventory item.
 */
export async function createEbayOffer(
  accessToken: string,
  payload: {
    sku: string
    marketplaceId: string
    merchantLocationKey: string
    categoryId: string
    title: string
    description?: string | null
    priceValue: string
    currency: string
    quantity: number
    paymentPolicyId: string
    fulfillmentPolicyId: string
    returnPolicyId: string
  }
) {
  const body: any = {
    sku: payload.sku,
    marketplaceId: payload.marketplaceId,
    format: 'FIXED_PRICE',
    availableQuantity: payload.quantity,
    categoryId: payload.categoryId,
    merchantLocationKey: payload.merchantLocationKey,
    listingPolicies: {
      paymentPolicyId: payload.paymentPolicyId,
      fulfillmentPolicyId: payload.fulfillmentPolicyId,
      returnPolicyId: payload.returnPolicyId,
    },
    pricingSummary: {
      price: {
        value: payload.priceValue,
        currency: payload.currency,
      },
    },
    listingDescription: {
      title: payload.title,
    },
  }

  if (payload.description) body.listingDescription.description = payload.description

  return ebayApiRequest('/sell/inventory/v1/offer', accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Publish an offer (makes the listing live).
 * Returns listingId on success.
 */
export async function publishEbayOffer(accessToken: string, offerId: string) {
  return ebayApiRequest(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, accessToken, {
    method: 'POST',
  })
}

/**
 * Update an offer's price and/or available quantity.
 * Note: eBay may validate other required offer fields; this is a "best effort" minimal update.
 */
export async function updateEbayOfferPriceQuantity(
  accessToken: string,
  offerId: string,
  payload: { priceValue?: string; currency?: string; quantity?: number }
) {
  const body: any = {}
  if (typeof payload.quantity === 'number') body.availableQuantity = payload.quantity
  if (payload.priceValue) {
    body.pricingSummary = {
      price: { value: payload.priceValue, currency: payload.currency || 'USD' },
    }
  }
  return ebayApiRequest(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Withdraw an offer (end listing).
 */
export async function withdrawEbayOffer(accessToken: string, offerId: string) {
  return ebayApiRequest(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, accessToken, {
    method: 'POST',
  })
}

