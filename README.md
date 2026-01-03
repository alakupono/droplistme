# Droplist.me

A simple tool for listing items on eBay

## Getting Started

First, install the dependencies:

```bash
npm install
```

## Clerk Authentication Setup

1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Create a new application in the Clerk Dashboard
3. Get your API keys from [Clerk Dashboard → API Keys](https://dashboard.clerk.com/last-active?path=api-keys)
4. Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
CLERK_SECRET_KEY=your_secret_key_here
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- ✅ User authentication with Clerk
- ✅ Sign up and sign in buttons on homepage
- ✅ Secure user management
- ✅ eBay store connection and management
- ✅ eBay API integration (sandbox and production)

## eBay API Setup

1. **Create an eBay Developer Account:**
   - Go to [eBay Developers Program](https://developer.ebay.com/)
   - Sign up or log in to your developer account
   - Create a new application

2. **Get Your API Credentials:**
   - Go to your eBay Developer Dashboard
   - Navigate to your application settings
   - Copy your **Client ID** and **Client Secret**

3. **Configure Event Notifications (from screenshot):**
   - In your eBay Developer Dashboard, go to **Event Notification Delivery Method**
   - Select **Marketplace Account Deletion** notification method
   - Set your notification endpoint: `https://droplist.me/api/ebay/webhook`
   - Set your verification token (save this for later)
   - Add your email for endpoint downtime notifications

4. **Add to `.env.local`:**
   ```bash
   # eBay API Configuration (Sandbox)
   EBAY_CLIENT_ID=your_ebay_client_id
   EBAY_CLIENT_SECRET=your_ebay_client_secret
   EBAY_DEV_ID=your_dev_id
   EBAY_ENVIRONMENT=sandbox  # or 'production' for live
   NEXT_PUBLIC_APP_URL=http://localhost:3000  # Your app URL
   EBAY_VERIFICATION_TOKEN=your_verification_token  # For webhooks
   EBAY_OAUTH_REDIRECT_URI=https://yourdomain.com/stores/connect/callback  # Must match eBay "Login redirect URI"
   ```
   
   **Example (Sandbox credentials):**
   ```bash
   EBAY_CLIENT_ID=your_sandbox_client_id_here
   EBAY_CLIENT_SECRET=your_sandbox_client_secret_here
   EBAY_DEV_ID=your_dev_id_here
   EBAY_ENVIRONMENT=sandbox
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   EBAY_VERIFICATION_TOKEN=generate_a_random_token_here
   ```

5. **Configure eBay Webhooks (Production Required):**
   
   eBay requires you to set up webhook endpoints for event notifications, particularly for Marketplace Account Deletion events.
   
   **In your eBay Developer Dashboard:**
   1. Go to **Alerts & Notifications** section
   2. Select **"Marketplace Account Deletion"** notification method
   3. Set your webhook endpoint URL:
      ```
      https://yourdomain.com/api/ebay/webhook
      ```
   4. Set your verification token (use the same value as `EBAY_VERIFICATION_TOKEN` in your `.env.local`)
   5. Set your email for downtime notifications
   6. Click **Save**
   
   **Generate a verification token:**
   ```bash
   openssl rand -hex 32
   ```
   
   Copy the generated token and use it for both:
   - `EBAY_VERIFICATION_TOKEN` in your `.env.local` (and Vercel environment variables)
   - The verification token field in eBay Developer Dashboard

6. **For Production:**
   - Update `EBAY_ENVIRONMENT=production`
   - Update `NEXT_PUBLIC_APP_URL` to your production domain (e.g., `https://droplist.me`)
   - Use production eBay API credentials
   - Set up the webhook endpoint in eBay Developer Dashboard with your production URL
   - Ensure `EBAY_VERIFICATION_TOKEN` is set in Vercel environment variables

## Vercel Deployment

### Required Environment Variables

Make sure to set these in your Vercel project settings:

1. **Clerk Keys:**
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
   - `CLERK_SECRET_KEY` - Your Clerk secret key

2. **Database:**
   - `DATABASE_URL` - Your Neon database connection string

3. **eBay API:**
   - `EBAY_CLIENT_ID` - Your eBay App ID (Client ID)
   - `EBAY_CLIENT_SECRET` - Your eBay Cert ID (Client Secret)
   - `EBAY_DEV_ID` - Your eBay Dev ID
   - `EBAY_ENVIRONMENT` - Set to `production` for live
   - `EBAY_VERIFICATION_TOKEN` - Webhook verification token (generate with `openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_URL` - Your production domain: `https://droplist.me`

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with the appropriate value
4. Redeploy your application

**Important:** Use your **production** database URL for the `DATABASE_URL` variable in Vercel.
