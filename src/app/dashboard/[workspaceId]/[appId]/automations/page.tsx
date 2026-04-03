import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import AutomationsPanel from '@/components/AutomationsPanel'
import AutomationsBreadcrumb from './AutomationsBreadcrumb'
import type { AppField } from '@/lib/types'

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; appId: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId, appId } = await params

  const [app, workspaceApps] = await Promise.all([
    prisma.app.findUnique({
      where: { id: appId },
      include: {
        workspace: { include: { members: true } },
        automations: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.app.findMany({
      where: { workspaceId },
      select: { id: true, name: true, iconEmoji: true, fieldsJson: true },
    }),
  ])

  if (!app || app.workspaceId !== workspaceId) notFound()

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const fields: AppField[] = JSON.parse(app.fieldsJson)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AutomationsBreadcrumb
        workspaceId={workspaceId}
        appId={appId}
        workspaceName={app.workspace.name}
        appEmoji={app.iconEmoji}
        appName={app.name}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        <AutomationsPanel
          appId={appId}
          workspaceId={workspaceId}
          automations={app.automations}
          fields={fields}
          workspaceApps={workspaceApps.map(a => ({
            id: a.id,
            name: a.name,
            iconEmoji: a.iconEmoji,
            fields: JSON.parse(a.fieldsJson) as AppField[],
          }))}
        />
      </div>
    </div>
  )
}
