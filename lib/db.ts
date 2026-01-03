import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  // Ensure connectionString is a string (handle cases where it might be parsed as object)
  if (typeof connectionString !== 'string') {
    // If it's an object, try to extract the string value
    if (connectionString && typeof connectionString === 'object') {
      connectionString = (connectionString as any).toString?.() || String(connectionString)
    } else {
      connectionString = String(connectionString)
    }
  }

  // Validate it's a valid connection string format
  const dbUrl = String(connectionString)
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    throw new Error(`DATABASE_URL must be a valid PostgreSQL connection string. Got: ${typeof connectionString}`)
  }

  try {
    // Pool constructor requires connectionString in an object
    // Ensure we're passing a clean string value
    const pool = new Pool({ connectionString: dbUrl })
    const adapter = new PrismaNeon(pool as any)

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    console.error('Connection string type:', typeof connectionString)
    console.error('Connection string preview:', connectionString?.substring(0, 50))
    throw error
  }
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

