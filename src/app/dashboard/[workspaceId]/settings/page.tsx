import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import WorkspaceSettings from '@/components/WorkspaceSettings'
import ApiKeysPanel from '@/components/ApiKeysPanel'

export default async function SettingsPage({
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
      members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
      apiKeys: { orderBy: { createdAt: 'desc' }, select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true } },
    },
  })
  if (!workspace) notFound()

  const currentMember = workspace.members.find(m => m.userId === user.id)
  if (!currentMember) redirect('/dashboard')

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link
              href={`/dashboard/${workspaceId}`}
              style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {workspace.iconEmoji} {workspace.name}
            </Link>
            <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Settings</span>
          </div>
          <h1 className="page-title">Workspace Settings</h1>
        </div>
      </div>

      <WorkspaceSettings
        workspace={{
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          iconEmoji: workspace.iconEmoji,
          color: workspace.color,
        }}
        members={workspace.members.map(m => ({
          id: m.id,
          role: m.role,
          user: { id: m.user.id, name: m.user.name, email: m.user.email },
        }))}
        currentUserId={user.id}
        currentUserRole={currentMember.role}
      />

      <div style={{ maxWidth: 680, marginTop: 32 }}>
        <ApiKeysPanel workspaceId={workspaceId} initialKeys={workspace.apiKeys} />
      </div>
    </div>
  )
}
