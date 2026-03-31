import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <div className="app-shell">
      <Sidebar user={user} workspaces={workspaces.map(m => m.workspace)} />
      <div className="main-content">
        <Topbar user={user} />
        {children}
      </div>
    </div>
  )
}
