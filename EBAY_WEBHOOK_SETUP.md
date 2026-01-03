# eBay Webhook Setup Guide

This guide explains how to set up eBay webhooks for production, specifically for Marketplace Account Deletion notifications.

## Overview

eBay requires you to configure webhook endpoints to receive event notifications. The most important one for this application is the **Marketplace Account Deletion** event, which notifies you when a user deletes their eBay account.

## Step 1: Generate Verification Token

Generate a secure random token for webhook verification:

```bash
openssl rand -hex 32
```

This will output something like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Save this token** - you'll need it in two places:
1. Your `.env.local` file (and Vercel environment variables)
2. eBay Developer Dashboard

## Step 2: Add Token to Environment Variables

### Local Development (`.env.local`):
```bash
EBAY_VERIFICATION_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Production (Vercel):
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add `EBAY_VERIFICATION_TOKEN` with your generated token
4. Make sure it's set for **Production** environment

## Step 3: Configure in eBay Developer Dashboard

1. **Log in** to [eBay Developer Program](https://developer.ebay.com/)
2. Navigate to your application
3. Go to **Alerts & Notifications** tab
4. Under **Event Notification Delivery Method**:
   - Select **"Marketplace Account Deletion"** (radio button)
   - **Exempted from Marketplace Account Deletion**: Leave OFF (toggle to the left)
   - **Email to notify if endpoint is down**: Enter your email (e.g., `alakupono@gmail.com`)
   - **Marketplace account deletion notification endpoint**: 
     ```
     https://droplist.me/api/ebay/webhook
     ```
   - **Verification token**: Enter the token you generated in Step 1
5. Click **Save**

## Step 4: Test the Webhook

After saving, eBay will send a challenge request to verify your endpoint. The webhook handler will automatically respond to this challenge.

You can also manually test the endpoint:

```bash
curl https://droplist.me/api/ebay/webhook
```

This should return:
```json
{
  "message": "eBay webhook endpoint is active",
  "timestamp": "2024-01-03T...",
  "verificationToken": "Set"
}
```

## Step 5: Verify Webhook is Working

1. In eBay Developer Dashboard, click **"Send Test Notification"** (this button becomes enabled after saving)
2. Check your application logs to see if the webhook was received
3. Verify that the challenge was handled correctly

## Webhook Endpoint Details

**URL:** `https://droplist.me/api/ebay/webhook`

**Method:** `POST` (for events), `GET` (for testing)

**What it does:**
- Handles eBay challenge requests (verification)
- Processes Marketplace Account Deletion events
- Automatically disconnects stores when accounts are deleted
- Logs all events for debugging

## Troubleshooting

### Webhook not receiving events
- Verify the URL is correct and accessible (HTTPS required)
- Check that the verification token matches in both places
- Ensure your production domain is properly configured
- Check Vercel logs for any errors

### Challenge verification failing
- Ensure `EBAY_VERIFICATION_TOKEN` is set in Vercel environment variables
- Verify the token in eBay Dashboard matches exactly
- Check server logs for error messages

### Events not processing
- Check application logs for errors
- Verify database connection is working
- Ensure the webhook handler has proper error handling

## Security Notes

- **Never commit** your verification token to git
- Use different tokens for development and production
- The token should be at least 32 characters long
- Keep your token secure - it's used to verify webhook authenticity

## Production Checklist

- [ ] Generated verification token
- [ ] Added token to `.env.local` (development)
- [ ] Added token to Vercel environment variables (production)
- [ ] Configured webhook endpoint in eBay Developer Dashboard
- [ ] Set production domain URL (HTTPS required)
- [ ] Set email for downtime notifications
- [ ] Tested webhook endpoint
- [ ] Verified challenge response works
- [ ] Tested with "Send Test Notification" button

## Additional Resources

- [eBay Webhook Documentation](https://developer.ebay.com/api-docs/static/rest-webhooks.html)
- [eBay Marketplace Account Deletion Events](https://developer.ebay.com/api-docs/static/rest-webhooks-marketplace-account-deletion.html)

