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
