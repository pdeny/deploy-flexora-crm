import { cookies } from 'next/headers'
import { prisma } from './db'

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('flexora_session')?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  // Update lastActiveAt if stale (>1 min) — fire-and-forget to avoid blocking
  const ONE_MINUTE = 60_000
  if (Date.now() - session.lastActiveAt.getTime() > ONE_MINUTE) {
    prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {})
  }

  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
