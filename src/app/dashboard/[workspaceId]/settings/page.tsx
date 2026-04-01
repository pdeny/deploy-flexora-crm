import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import WorkspaceSettings from '@/components/WorkspaceSettings'
import ApiKeysPanel from '@/components/ApiKeysPanel'
import SettingsPageHeader from './SettingsPageHeader'

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
        <SettingsPageHeader
          workspaceId={workspaceId}
          workspaceEmoji={workspace.iconEmoji}
          workspaceName={workspace.name}
        />
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
