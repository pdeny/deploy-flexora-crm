import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { getWorkspacePermissions, toPermissionMap } from '@/lib/permissions'
import WorkspaceSettings from '@/components/WorkspaceSettings'
import ApiKeysPanel from '@/components/ApiKeysPanel'
import SettingsPageHeader from './SettingsPageHeader'

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId } = await params
  const { tab } = await searchParams
  const initialTab = (tab === 'members' || tab === 'danger') ? tab : 'general'

  const [workspace, pendingInvites] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
        apiKeys: { orderBy: { createdAt: 'desc' }, select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true } },
      },
    }),
    prisma.workspaceInvite.findMany({
      where: { workspaceId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { name: true, email: true } } },
    }),
  ])
  if (!workspace) notFound()

  const currentMember = workspace.members.find(m => m.userId === user.id)
  if (!currentMember) redirect('/dashboard')

  let wsPerms
  try { wsPerms = await getWorkspacePermissions(user.id, workspaceId) } catch { redirect('/dashboard') }
  const can = toPermissionMap(wsPerms)

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
          user: { id: m.user.id, name: m.user.name, email: m.user.email, avatarUrl: m.user.avatarUrl },
        }))}
        currentUserId={user.id}
        currentUserRole={currentMember.role}
        currentUserNotificationsEnabled={currentMember.notificationsEnabled}
        initialTab={initialTab}
        pendingInvites={pendingInvites.map(i => ({
          id: i.id,
          email: i.email,
          token: i.token,
          role: i.role,
          expiresAt: i.expiresAt,
          invitedByName: i.invitedBy.name ?? i.invitedBy.email,
        }))}
        can={can}
      />

      <div style={{ maxWidth: 680, marginTop: 32 }}>
        <ApiKeysPanel workspaceId={workspaceId} initialKeys={workspace.apiKeys} />
      </div>
    </div>
  )
}
