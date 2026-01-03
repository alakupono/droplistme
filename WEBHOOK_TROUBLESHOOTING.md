# eBay Webhook Troubleshooting Guide

If you're getting a validation error when setting up the Marketplace Account Deletion webhook, follow these steps:

## Common Issues

### 1. Endpoint URL Mismatch

**Problem**: The endpoint URL used in the hash calculation doesn't match what's in the eBay Dashboard.

**Solution**: 
- The endpoint URL must be EXACTLY: `https://droplist.me/api/ebay/webhook`
- No trailing slash
- Must use `https://` (not `http://`)
- Must match the hostname exactly

**Check**: In your Vercel logs, look for "Endpoint URL for hash" - it should be exactly `https://droplist.me/api/ebay/webhook`

### 2. Verification Token Issues

**Problem**: Token doesn't match or has invalid characters.

**Requirements**:
- Must be between 32 and 80 characters
- Only alphanumeric characters, underscore (_), and hyphen (-) are allowed
- Must match EXACTLY in both:
  - Vercel environment variable `EBAY_VERIFICATION_TOKEN`
  - eBay Developer Dashboard verification token field

**Check**: 
- Verify token length: `echo $EBAY_VERIFICATION_TOKEN | wc -c` (should be 33-81 including newline)
- Verify no special characters except `_` and `-`

### 3. Hash Calculation Order

**Problem**: The hash is calculated in the wrong order.

**Solution**: The order MUST be:
1. challengeCode (from query parameter)
2. verificationToken (from environment variable)
3. endpoint (full URL: `https://droplist.me/api/ebay/webhook`)

**Check**: The code uses this exact order in `app/api/ebay/webhook/route.ts`

### 4. Response Format Issues

**Problem**: Response isn't valid JSON or has BOM (Byte Order Mark).

**Solution**:
- Must return: `{ "challengeResponse": "hash_value" }`
- Content-Type must be: `application/json`
- Use `NextResponse.json()` to ensure proper JSON encoding (no BOM)

**Check**: Response should be valid JSON without any BOM

### 5. Endpoint Not Accessible

**Problem**: eBay can't reach your endpoint.

**Solution**:
- Ensure the endpoint is deployed to production (Vercel)
- Verify HTTPS is working: `curl https://droplist.me/api/ebay/webhook`
- Check Vercel logs for any errors
- Ensure the endpoint responds to GET requests

## Debugging Steps

### Step 1: Test Endpoint Manually

```bash
# Test without challenge (should return status)
curl https://droplist.me/api/ebay/webhook

# Test with challenge (eBay will do this automatically)
curl "https://droplist.me/api/ebay/webhook?challenge_code=test123"
```

### Step 2: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Look for "eBay Challenge Verification" messages
3. Check the logged values:
   - Endpoint URL (should be `https://droplist.me/api/ebay/webhook`)
   - Verification token length (should be 32-80)
   - Response hash (should be 64 hex characters)

### Step 3: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, verify:
- `EBAY_VERIFICATION_TOKEN` is set
- `NEXT_PUBLIC_APP_URL=https://droplist.me` (optional but recommended)

### Step 4: Compare with eBay Dashboard

In eBay Developer Dashboard → Alerts & Notifications:
- Endpoint URL: `https://droplist.me/api/ebay/webhook` (exact match)
- Verification Token: Must match `EBAY_VERIFICATION_TOKEN` in Vercel exactly

## Manual Hash Verification

You can manually verify the hash calculation:

```javascript
const crypto = require('crypto');

const challengeCode = 'your_challenge_code_from_ebay';
const verificationToken = 'your_verification_token';
const endpoint = 'https://droplist.me/api/ebay/webhook';

const hash = crypto.createHash('sha256');
hash.update(challengeCode, 'utf8');
hash.update(verificationToken, 'utf8');
hash.update(endpoint, 'utf8');
const result = hash.digest('hex');

console.log('Expected challengeResponse:', result);
```

Compare this with what your endpoint returns.

## Still Not Working?

1. **Check Vercel deployment**: Ensure latest code is deployed
2. **Check DNS**: Verify `droplist.me` points to Vercel
3. **Check SSL**: Ensure HTTPS certificate is valid
4. **Review logs**: Check both Vercel function logs and eBay's error message
5. **Contact eBay Support**: If all else fails, contact Developer Technical Support

## Important Notes

- eBay sends the challenge immediately after you save the endpoint in the dashboard
- The endpoint must respond within a reasonable time (usually < 30 seconds)
- The response must be valid JSON with `Content-Type: application/json`
- The hash must be exactly 64 hexadecimal characters
- All three values (challengeCode, verificationToken, endpoint) must be strings

## Reference

- [eBay Marketplace Account Deletion Documentation](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#overview)

