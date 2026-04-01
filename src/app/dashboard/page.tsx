import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import DashboardContent from './DashboardContent'

export default async function DashboardPage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const [memberships, recentItems] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: { include: { apps: { include: { _count: { select: { items: true } } } }, members: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.item.findMany({
      where: { app: { workspace: { members: { some: { userId: user.id } } } } },
      include: { app: { include: { workspace: true } }, creator: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ])

  const totalApps  = memberships.reduce((s, m) => s + m.workspace.apps.length, 0)
  const totalItems = memberships.reduce((s, m) => s + m.workspace.apps.reduce((ss, a) => ss + a._count.items, 0), 0)

  return (
    <DashboardContent
      userName={user.name?.split(' ')[0] ?? 'there'}
      memberships={memberships.map(m => ({ workspace: m.workspace, role: m.role }))}
      recentItems={recentItems}
      totalApps={totalApps}
      totalItems={totalItems}
    />
  )
}
