# User System Documentation

Complete guide for the Droplist.me user system with Clerk authentication, profiles, and admin panel.

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [User Features](#user-features)
4. [Admin Panel](#admin-panel)
5. [API Endpoints](#api-endpoints)
6. [Setting Up Admin Users](#setting-up-admin-users)
7. [Usage Examples](#usage-examples)

## Overview

The user system integrates Clerk for authentication with a PostgreSQL database (Neon) for user data storage. It includes:

- **User Authentication**: Clerk handles all authentication
- **User Profiles**: Personal profile pages with stats
- **Admin Panel**: Full user management dashboard
- **Role-Based Access**: Admin-only routes and features
- **Auto User Creation**: Users are automatically created in database on first login

## Setup Instructions

### 1. Clerk Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **API Keys** section
3. Copy your `Publishable Key` and `Secret Key`
4. Add them to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
```

### 2. Database Setup

The database is already configured with Prisma. Users are automatically created when they first sign in.

### 3. Run the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## User Features

### Profile Page (`/profile`)

**Access**: Available to all authenticated users

**Features**:
- View account information (name, email, user ID)
- See account creation date
- View statistics (stores, listings)
- See all connected stores
- Admin badge (if user is admin)
- Link to admin panel (if admin)

**How to Access**:
1. Sign in to the application
2. Click "My Profile" button on homepage
3. Or navigate to `/profile`

### User Statistics

The profile page displays:
- **Stores**: Number of eBay stores connected
- **Listings**: Total number of listings created

## Admin Panel

### Admin Dashboard (`/admin`)

**Access**: Admin users only (redirects to homepage if not admin)

**Features**:
- View all users in the system
- See overall statistics (total users, stores, listings)
- View individual user details
- User management table with:
  - Email addresses
  - User IDs
  - Store counts
  - Listing counts
  - Join dates

### User Detail Page (`/admin/users/[userId]`)

**Access**: Admin users only

**Features**:
- Complete user information
- User statistics
- All stores associated with the user
- Store connection status

## API Endpoints

### Get Current User

```typescript
GET /api/users/me
```

**Response**:
```json
{
  "user": {
    "id": "uuid",
    "clerkUserId": "user_xxx",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00Z",
    "stores": [...]
  }
}
```

### Get All Users (Admin Only)

```typescript
GET /api/users
```

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "_count": {
        "stores": 2,
        "listings": 10
      }
    }
  ]
}
```

### Get User by ID (Admin Only)

```typescript
GET /api/users/[userId]
```

### Delete User (Admin Only)

```typescript
DELETE /api/users/[userId]
```

## Setting Up Admin Users

### Method 1: Clerk Dashboard (Recommended)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Users** section
3. Find the user you want to make admin
4. Click on the user to open their profile
5. Scroll to **Public Metadata** section
6. Add the following JSON:

```json
{
  "role": "admin"
}
```

7. Save the changes

### Method 2: Programmatically

You can also set admin role via Clerk's API or in your code:

```typescript
import { clerkClient } from "@clerk/nextjs/server";

await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: "admin"
  }
});
```

### Verify Admin Status

After setting the admin role:
1. Sign out and sign back in (to refresh session)
2. Visit `/admin` - you should see the admin panel
3. Your profile page should show an "Admin" badge

## Usage Examples

### Check if User is Admin (Server Component)

```typescript
import { isAdmin } from "@/lib/auth";

export default async function MyPage() {
  const admin = await isAdmin();
  
  if (admin) {
    // Show admin content
  }
}
```

### Get Current User (Server Component)

```typescript
import { getOrCreateUser } from "@/lib/auth";

export default async function MyPage() {
  const user = await getOrCreateUser();
  
  if (!user) {
    redirect("/");
  }
  
  // Use user data
}
```

### Protect API Route (Admin Only)

```typescript
import { isAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  
  // Admin-only logic
}
```

### Protect Page (Admin Only)

```typescript
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect("/");
  }
  
  // Admin page content
}
```

### Get User in API Route

```typescript
import { getOrCreateUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getOrCreateUser();
  
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  return NextResponse.json({ user });
}
```

## Database Schema

### User Model

```prisma
model User {
  id           String   @id @default(uuid())
  clerkUserId  String   @unique
  email        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  stores       Store[]
}
```

### Auto-Creation

Users are automatically created in the database when they:
1. Sign in for the first time
2. Access any page that calls `getOrCreateUser()`

The system:
- Checks if user exists by `clerkUserId`
- Creates user if doesn't exist
- Links Clerk user data (email, etc.)

## Security Features

1. **Authentication**: All routes require Clerk authentication
2. **Role-Based Access**: Admin routes check `publicMetadata.role === "admin"`
3. **Auto User Creation**: Secure user creation on first access
4. **Database Relations**: Cascade deletes (deleting user deletes stores/listings)
5. **API Protection**: All API routes check authentication and roles

## Troubleshooting

### Admin Panel Not Accessible

1. Verify admin role in Clerk Dashboard (Public Metadata)
2. Sign out and sign back in
3. Check browser console for errors
4. Verify `isAdmin()` function returns true

### User Not Created in Database

1. Check database connection in `.env.local`
2. Verify Prisma client is generated: `npx prisma generate`
3. Check server logs for errors
4. Ensure `getOrCreateUser()` is being called

### API Routes Returning 401/403

1. Verify user is signed in (check Clerk session)
2. For admin routes, verify admin role is set
3. Check API route authentication logic
4. Verify environment variables are set

## Next Steps

- Connect eBay API for store management
- Add listing creation functionality
- Implement store connection flow
- Add more admin features (user editing, etc.)

