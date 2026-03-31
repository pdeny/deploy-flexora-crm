'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { randomBytes, createHash } from 'crypto'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function listApiKeys(workspaceId: string) {
  const user = await requireUser()
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) return { error: 'Unauthorized' }

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  })
  return { keys }
}

export async function createApiKey(workspaceId: string, name: string): Promise<{ key: string; prefix: string; id: string } | { error: string }> {
  const user = await requireUser()
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) return { error: 'Unauthorized' }
  if (!name.trim()) return { error: 'Name is required' }

  const raw = 'flx_' + randomBytes(24).toString('base64url')
  const prefix = raw.slice(0, 12)
  const keyHash = hashKey(raw)

  const record = await prisma.apiKey.create({
    data: { workspaceId, userId: user.id, name: name.trim(), keyHash, prefix },
  })
  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return { key: raw, prefix, id: record.id }
}

export async function deleteApiKey(keyId: string): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } })
  if (!key) return { error: 'Not found' }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: key.workspaceId, userId: user.id } },
  })
  if (!member) return { error: 'Unauthorized' }

  await prisma.apiKey.delete({ where: { id: keyId } })
  revalidatePath(`/dashboard/${key.workspaceId}/settings`)
  return { success: true }
}

/** Used by API route handlers to authenticate requests */
export async function authenticateApiKey(rawKey: string) {
  const keyHash = hashKey(rawKey)
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: { include: { members: true } } },
  })
  if (!record) return null
  // Update lastUsedAt (non-blocking)
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return record
}
