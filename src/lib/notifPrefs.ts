import { prisma } from './db'

/**
 * Returns true if the user has notifications enabled for the given workspace.
 * Falls back to true if no membership record is found (safe default).
 */
export async function shouldNotify(userId: string, workspaceId: string): Promise<boolean> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { notificationsEnabled: true },
  })
  return member?.notificationsEnabled ?? true
}

/**
 * Batch variant — returns the set of userIds that have notifications enabled
 * in the given workspace, filtered from the provided list.
 */
export async function filterNotifiable(userIds: string[], workspaceId: string): Promise<string[]> {
  if (userIds.length === 0) return []
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: userIds }, notificationsEnabled: true },
    select: { userId: true },
  })
  return members.map(m => m.userId)
}
