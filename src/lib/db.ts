import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma v7 always needs an adapter. The DATABASE_URL may be a
 * prisma+postgres:// proxy URL — extract the raw postgres:// URL
 * embedded in the base64 API key, then use it with PrismaPg.
 */
function resolvePostgresUrl(): string {
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('prisma+postgres://') || url.startsWith('prisma://')) {
    const match = url.match(/[?&]api_key=([^&]+)/)
    if (match) {
      try {
        const decoded = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
        if (decoded.databaseUrl) return decoded.databaseUrl
      } catch { /* fall through */ }
    }
  }
  return url
}

function createPrismaClient() {
  const connStr = resolvePostgresUrl()
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('sslmode=disable') ? false : { rejectUnauthorized: true },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
