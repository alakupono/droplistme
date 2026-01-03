import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

/**
 * Get or create user in database from Clerk
 */
export async function getOrCreateUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    return null;
  }

  try {
    // Check if user exists in database
    let user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: { stores: true },
    });

    // Create user if doesn't exist
    if (!user) {
      try {
        user = await db.user.create({
          data: {
            clerkUserId: userId,
            email: clerkUser.emailAddresses[0]?.emailAddress || null,
          },
          include: { stores: true },
        });
      } catch (createError: any) {
        // If create fails (e.g., race condition), try to fetch again
        console.error('Error creating user, trying to fetch:', createError);
        user = await db.user.findUnique({
          where: { clerkUserId: userId },
          include: { stores: true },
        });
        
        if (!user) {
          console.error('Failed to create or fetch user after error:', createError);
          // Re-throw to be handled by caller
          throw createError;
        }
      }
    }

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // Return null so caller can handle gracefully
    return null;
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin() {
  const { userId } = await auth();
  
  if (!userId) {
    return false;
  }

  const clerkUser = await currentUser();
  
  // Check if user has admin role in Clerk metadata
  return clerkUser?.publicMetadata?.role === "admin";
}

/**
 * Get current user with auth check
 */
export async function getCurrentUser() {
  const user = await getOrCreateUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

