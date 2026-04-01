import { prisma } from '@/lib/db'
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export type AuthedKey = {
  workspaceId: string
  userId: string
  keyId: string
}

export async function withApiKey(
  req: NextRequest,
  handler: (authed: AuthedKey) => Promise<NextResponse>,
): Promise<NextResponse> {
  // Rate limit by IP: 120 requests per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`api:${ip}`, { limit: 120, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const auth = req.headers.get('authorization') ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!raw) {
    return NextResponse.json({ error: 'Missing Authorization header (Bearer <api_key>)' }, { status: 401 })
  }

  const keyHash = hashKey(raw)
  const record = await prisma.apiKey.findUnique({ where: { keyHash } })
  if (!record) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Update lastUsedAt non-blocking
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return handler({ workspaceId: record.workspaceId, userId: record.userId, keyId: record.id })
}
