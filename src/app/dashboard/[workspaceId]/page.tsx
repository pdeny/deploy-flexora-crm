import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { getWorkspacePermissions, toPermissionMap } from '@/lib/permissions'
import WorkspaceContent from './WorkspaceContent'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId } = await params

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      apps: { include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'asc' } },
      members: { include: { user: true } },
    },
  })
  if (!workspace) notFound()

  let wsPerms
  try { wsPerms = await getWorkspacePermissions(user.id, workspaceId) } catch { redirect('/dashboard') }
  const can = toPermissionMap(wsPerms)

  const memberUserIds = workspace.members.map(m => m.userId)

  const [recentItems, taskStats, activeSessions] = await Promise.all([
    prisma.item.findMany({
      where: { app: { workspaceId } },
      include: { app: true, creator: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { item: { app: { workspaceId } } },
      _count: true,
    }),
    prisma.session.findMany({
      where: {
        userId: { in: memberUserIds },
        expiresAt: { gt: new Date() },
      },
      select: { userId: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
      distinct: ['userId'],
    }),
  ])

  // Build a map of userId → lastActiveAt (most recent session)
  const memberActivity: Record<string, string> = {}
  for (const s of activeSessions) {
    memberActivity[s.userId] = s.lastActiveAt.toISOString()
  }
  // Keep onlineUserIds for backward compat (active in last 5 min)
  const FIVE_MIN = 5 * 60 * 1000
  const onlineUserIds = activeSessions
    .filter(s => Date.now() - s.lastActiveAt.getTime() < FIVE_MIN)
    .map(s => s.userId)

  const totalTasks = taskStats.reduce((s, t) => s + t._count, 0)
  const doneTasks = taskStats.find(t => t.status === 'done')?._count ?? 0
  const taskCompletionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null

  return (
    <WorkspaceContent
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      workspaceEmoji={workspace.iconEmoji}
      workspaceDescription={workspace.description}
      apps={workspace.apps.map(a => ({
        id: a.id,
        name: a.name,
        iconEmoji: a.iconEmoji,
        color: a.color,
        description: a.description,
        itemCount: a._count.items,
      }))}
      members={workspace.members.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        userName: m.user.name ?? '',
        userEmail: m.user.email,
        avatarUrl: m.user.avatarUrl,
      }))}
      onlineUserIds={onlineUserIds}
      memberActivity={memberActivity}
      recentItems={recentItems.map(item => ({
        id: item.id,
        title: item.title,
        appId: item.appId,
        appName: item.app.name,
        appEmoji: item.app.iconEmoji,
        appColor: item.app.color,
        updatedAt: item.updatedAt,
      }))}
      doneTasks={doneTasks}
      totalTasks={totalTasks}
      taskCompletionPct={taskCompletionPct}
      can={can}
    />
  )
}

