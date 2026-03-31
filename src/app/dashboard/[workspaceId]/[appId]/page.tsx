import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import ItemsTable from '@/components/ItemsTable'
import type { AppField } from '@/lib/types'

export default async function AppPage({
  params,
}: {
  params: Promise<{ workspaceId: string; appId: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId, appId } = await params

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      workspace: { include: { members: true } },
      items: {
        include: { creator: true, _count: { select: { comments: true, tasks: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!app || app.workspaceId !== workspaceId) notFound()

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const fields: AppField[] = JSON.parse(app.fieldsJson)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AppHeader app={app} workspaceId={workspaceId} fields={fields} userId={user.id} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ItemsTable app={app} items={app.items} fields={fields} workspaceId={workspaceId} userId={user.id} />
      </div>
    </div>
  )
}
