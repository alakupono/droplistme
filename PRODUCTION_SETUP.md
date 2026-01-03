# Production Setup for droplist.me

## eBay Webhook Configuration

Use these exact values when configuring your eBay webhook in the Developer Dashboard:

### Endpoint URL
```
https://droplist.me/api/ebay/webhook
```

### Verification Token
```
e1cb974db66888e6b9de5465bda705364e4c9de6150c2f3688089e1f90460231
```

### Email for Downtime Notifications
```
alakupono@gmail.com
```

## Steps to Configure in eBay Developer Dashboard

1. Go to [eBay Developer Program](https://developer.ebay.com/)
2. Navigate to your application
3. Click on **"Alerts & Notifications"** tab
4. Under **"Event Notification Delivery Method"**:
   - ✅ Select **"Marketplace Account Deletion"** (radio button)
   - ⚪ **Exempted from Marketplace Account Deletion**: Leave OFF (toggle to the left)
   - 📧 **Email to notify if endpoint is down**: `alakupono@gmail.com`
   - 🔗 **Marketplace account deletion notification endpoint**: 
     ```
     https://droplist.me/api/ebay/webhook
     ```
   - 🔑 **Verification token**: 
     ```
     e1cb974db66888e6b9de5465bda705364e4c9de6150c2f3688089e1f90460231
     ```
5. Click **"Save"** button

## Vercel Environment Variables

Make sure these are set in your Vercel project (Settings → Environment Variables):

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_production_key
CLERK_SECRET_KEY=your_production_secret

# Database
DATABASE_URL=your_production_database_url

# eBay API (Production)
EBAY_CLIENT_ID=your_production_client_id
EBAY_CLIENT_SECRET=your_production_client_secret
EBAY_DEV_ID=your_dev_id
EBAY_ENVIRONMENT=production
EBAY_VERIFICATION_TOKEN=e1cb974db66888e6b9de5465bda705364e4c9de6150c2f3688089e1f90460231

# App URL
NEXT_PUBLIC_APP_URL=https://www.droplist.me

# eBay OAuth redirect (must EXACTLY match "Login redirect URI" configured in eBay app settings)
EBAY_OAUTH_REDIRECT_URI=https://www.droplist.me/stores/connect/callback
```

## Testing the Webhook

After saving in eBay Dashboard:

1. **eBay Challenge Verification (Automatic)**:
   - eBay will automatically send a GET request with `challenge_code` query parameter
   - The endpoint will compute SHA-256 hash and respond with `challengeResponse`
   - This happens immediately after you save the endpoint in eBay Dashboard
   - Check Vercel logs for: "eBay Challenge Verification"

2. **Test Notification**:
   - After successful challenge verification, click **"Send Test Notification"** button
   - This sends a test POST request to verify the endpoint works

3. **Check Vercel Logs**:
   ```bash
   # In Vercel Dashboard → Your Project → Logs
   # Look for: "eBay Challenge Verification" or "eBay Webhook POST received"
   ```

4. **Manual Endpoint Test**:
   ```bash
   # Test GET endpoint (without challenge)
   curl https://droplist.me/api/ebay/webhook
   ```
   
   Should return:
   ```json
   {
     "message": "eBay webhook endpoint is active",
     "timestamp": "2024-01-03T...",
     "verificationToken": "Set"
   }
   ```

## Challenge Verification Process

According to [eBay's documentation](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion#overview):

1. eBay sends: `GET https://droplist.me/api/ebay/webhook?challenge_code=123`
2. Our endpoint computes: `SHA-256(challengeCode + verificationToken + endpoint)`
3. Returns: `{ "challengeResponse": "hash_value" }`
4. eBay verifies the hash and activates the webhook subscription

**Important**: The hash must be computed in this exact order:
- challengeCode (from query parameter)
- verificationToken (from environment variable)
- endpoint (full URL: `https://droplist.me/api/ebay/webhook`)

## Verification Checklist

- [ ] Endpoint URL configured: `https://droplist.me/api/ebay/webhook`
- [ ] Verification token set: `e1cb974db66888e6b9de5465bda705364e4c9de6150c2f3688089e1f90460231`
- [ ] Email set: `alakupono@gmail.com`
- [ ] "Marketplace Account Deletion" selected
- [ ] Exemption toggle is OFF
- [ ] Saved in eBay Dashboard
- [ ] All environment variables set in Vercel
- [ ] Test notification sent successfully
- [ ] Webhook endpoint responding correctly

## Troubleshooting

If the webhook isn't working:

1. **Verify HTTPS**: Make sure `droplist.me` is using HTTPS (Vercel provides this automatically)
2. **Check Token Match**: Ensure the token in eBay Dashboard exactly matches `EBAY_VERIFICATION_TOKEN` in Vercel
3. **Check Logs**: Review Vercel function logs for any errors
4. **Test Endpoint**: Use `curl` to verify the endpoint is accessible
5. **DNS**: Ensure `droplist.me` DNS is pointing to Vercel

## Security Notes

- The verification token is used to verify webhook authenticity
- Keep it secret and never commit it to git
- Use the same token in both eBay Dashboard and Vercel environment variables
- The token should be at least 32 characters (ours is 64 hex characters)

