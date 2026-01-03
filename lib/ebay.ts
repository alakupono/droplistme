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

  // eBay is strict: redirect_uri must EXACTLY match a Login redirect URI
  // configured in the eBay developer portal, otherwise you get:
  // {"error_id":"invalid_request","error_description":"Input request parameters are invalid.","http_status_code":400}
  // In production, also avoid apex->www redirects by using your canonical domain.

  // Request scopes needed for listing items and managing inventory
  // Based on eBay API documentation and enabled scopes
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory', // View and manage inventory/offers
    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly', // View marketing activities
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly', // View account settings
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
 * Centralized redirect URI used for BOTH:
 * - Authorization request (redirect_uri param)
 * - Token exchange request (redirect_uri param)
 *
 * This MUST exactly match a "Login redirect URI" configured in the eBay app settings.
 */
export function getEbayOAuthRedirectUri(): string {
  const explicit = process.env.EBAY_OAUTH_REDIRECT_URI
  if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim()
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
    throw new Error(`Failed to exchange code for token: ${error}`)
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
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing.readonly https://api.ebay.com/oauth/api_scope/sell.account.readonly https://api.ebay.com/oauth/api_scope/sell.stores.readonly https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
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
    const error = await response.text()
    throw new Error(`eBay API request failed: ${error}`)
  }

  return await response.json()
}

/**
 * Get user's eBay account information
 * Returns account details including username, account ID, etc.
 */
export async function getEbayAccount(accessToken: string) {
  try {
    const account = await ebayApiRequest('/sell/account/v1/account', accessToken)
    return account
  } catch (error) {
    console.error('Error fetching eBay account:', error)
    // Return a basic structure if account endpoint fails
    return { accountId: null, username: null }
  }
}

/**
 * Get user's eBay identity (username, email, etc.)
 */
export async function getEbayIdentity(accessToken: string) {
  try {
    const identity = await ebayApiRequest('/commerce/identity/v1/user', accessToken)
    return identity
  } catch (error) {
    console.error('Error fetching eBay identity:', error)
    return null
  }
}

/**
 * Get user's eBay stores
 */
export async function getEbayStores(accessToken: string) {
  try {
    const stores = await ebayApiRequest('/sell/account/v1/store', accessToken)
    return stores
  } catch (error) {
    console.error('Error fetching eBay stores:', error)
    return null
  }
}

