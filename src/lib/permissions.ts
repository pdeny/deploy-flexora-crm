import { prisma } from '@/lib/db'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export type Permission =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:inviteMembers'
  | 'workspace:removeMembers'
  | 'workspace:manageRoles'
  | 'workspace:manageApiKeys'
  | 'app:read'
  | 'app:create'
  | 'app:update'
  | 'app:delete'
  | 'app:duplicate'
  | 'app:manageShare'
  | 'app:manageAutomations'
  | 'item:read'
  | 'item:create'
  | 'item:update'
  | 'item:delete'
  | 'item:comment'
  | 'item:manageTasks'

const ALL_PERMISSIONS: Permission[] = [
  'workspace:read', 'workspace:update', 'workspace:delete',
  'workspace:inviteMembers', 'workspace:removeMembers', 'workspace:manageRoles',
  'workspace:manageApiKeys',
  'app:read', 'app:create', 'app:update', 'app:delete', 'app:duplicate',
  'app:manageShare', 'app:manageAutomations',
  'item:read', 'item:create', 'item:update', 'item:delete', 'item:comment',
  'item:manageTasks',
]

const VIEWER_PERMS: Set<Permission> = new Set([
  'workspace:read', 'app:read', 'item:read',
])

const MEMBER_PERMS: Set<Permission> = new Set([
  ...VIEWER_PERMS,
  'item:create', 'item:update', 'item:delete', 'item:comment', 'item:manageTasks',
])

const ADMIN_PERMS: Set<Permission> = new Set([
  ...MEMBER_PERMS,
  'workspace:inviteMembers', 'workspace:removeMembers', 'workspace:manageApiKeys',
  'app:create', 'app:update', 'app:delete', 'app:duplicate',
  'app:manageShare', 'app:manageAutomations',
])

const OWNER_PERMS: Set<Permission> = new Set([
  ...ADMIN_PERMS,
  'workspace:update', 'workspace:delete', 'workspace:manageRoles',
])

const ROLE_GRANTS: Record<WorkspaceRole, Set<Permission>> = {
  viewer: VIEWER_PERMS,
  member: MEMBER_PERMS,
  admin: ADMIN_PERMS,
  owner: OWNER_PERMS,
}

export interface ResolvedPermissions {
  workspaceRole: WorkspaceRole
  effectiveRole: WorkspaceRole
  can: (permission: Permission) => boolean
}

function resolvePermissions(wsRole: WorkspaceRole, effectiveRole: WorkspaceRole): ResolvedPermissions {
  const grants = ROLE_GRANTS[effectiveRole]
  return {
    workspaceRole: wsRole,
    effectiveRole,
    can: (p: Permission) => grants.has(p),
  }
}

export async function getWorkspacePermissions(
  userId: string,
  workspaceId: string,
): Promise<ResolvedPermissions> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!member) throw new Error('Not a member')
  const role = member.role as WorkspaceRole
  return resolvePermissions(role, role)
}

export async function getAppPermissions(
  userId: string,
  appId: string,
): Promise<ResolvedPermissions & { workspaceId: string }> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: {
      workspaceId: true,
      workspace: {
        select: { members: { where: { userId }, select: { role: true } } },
      },
      appMembers: { where: { userId }, select: { role: true } },
    },
  })
  if (!app) throw new Error('App not found')

  const wsMember = app.workspace.members[0]
  if (!wsMember) throw new Error('Not a member')

  const wsRole = wsMember.role as WorkspaceRole
  const appOverride = app.appMembers[0]?.role as WorkspaceRole | undefined

  // Owners can never be demoted at app level
  const effectiveRole = wsRole === 'owner' ? 'owner' : (appOverride ?? wsRole)

  return { ...resolvePermissions(wsRole, effectiveRole), workspaceId: app.workspaceId }
}

// Serializable permission map for passing to client components
export type PermissionMap = Partial<Record<Permission, boolean>>

export function toPermissionMap(resolved: ResolvedPermissions): PermissionMap {
  const map: PermissionMap = {}
  for (const p of ALL_PERMISSIONS) {
    map[p] = resolved.can(p)
  }
  return map
}

export function isValidRole(role: string): role is WorkspaceRole {
  return ['owner', 'admin', 'member', 'viewer'].includes(role)
}
