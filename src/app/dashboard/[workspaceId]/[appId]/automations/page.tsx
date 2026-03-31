import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import AutomationsPanel from '@/components/AutomationsPanel'
import type { AppField } from '@/lib/types'

export default async function AutomationsPage({
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
      automations: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!app || app.workspaceId !== workspaceId) notFound()

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const fields: AppField[] = JSON.parse(app.fieldsJson)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Breadcrumb bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px',
        borderBottom: '1px solid var(--border-subtle)', fontSize: 13,
        color: 'var(--text-tertiary)', flexShrink: 0,
      }}>
        <Link href={`/dashboard/${workspaceId}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          {app.workspace.name}
        </Link>
        <span>/</span>
        <Link href={`/dashboard/${workspaceId}/${appId}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          {app.iconEmoji} {app.name}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>Automations</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <AutomationsPanel
          appId={appId}
          workspaceId={workspaceId}
          automations={app.automations}
          fields={fields}
        />
      </div>
    </div>
  )
}
