import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  if (typeof connectionString !== 'string') {
    connectionString = String(connectionString)
  }

  // Validate it's a plausible PostgreSQL URL (helps avoid silent fallbacks)
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string (postgresql://...)')
  }

  /**
   * Prisma v7 + driver adapters:
   * PrismaClient requires an adapter when the generated client uses engine type "client".
   *
   * We use the standard `pg` Pool. Neon is Postgres, so this works with Neon URLs.
   * This avoids edge/websocket quirks from `@neondatabase/serverless` during local dev.
   */
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

