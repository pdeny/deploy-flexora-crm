import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal'
import MobileBottomBar from '@/components/MobileBottomBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const [workspaceMembers, notifications, unreadCount] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ])

  return (
    <div className="app-shell">
      <Sidebar user={user} workspaces={workspaceMembers.map(m => m.workspace)} />
      <div className="main-content">
        <Topbar user={user} notifications={notifications} unreadCount={unreadCount} />
        {children}
        <KeyboardShortcutsModal />
      </div>
      <MobileBottomBar unreadCount={unreadCount} />
    </div>
  )
}
