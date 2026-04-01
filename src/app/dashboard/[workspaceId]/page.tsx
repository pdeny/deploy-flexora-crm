import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
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

  const isMember = workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const [recentItems, taskStats] = await Promise.all([
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
  ])

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
        role: m.role,
        userName: m.user.name ?? '',
        userEmail: m.user.email,
      }))}
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
    />
  )
}

