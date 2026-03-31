'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'

async function requireOwner(workspaceId: string) {
  const user = await requireUser()
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) throw new Error('Not a member')
  return { user, member }
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; description?: string; iconEmoji?: string; color?: string },
) {
  const { member } = await requireOwner(workspaceId)
  if (member.role !== 'owner') return { error: 'Only owners can edit workspace settings' }

  if (data.name !== undefined && !data.name.trim()) return { error: 'Name is required' }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.iconEmoji ? { iconEmoji: data.iconEmoji } : {}),
      ...(data.color ? { color: data.color } : {}),
    },
  })

  revalidatePath(`/dashboard/${workspaceId}`, 'layout')
  return { success: true }
}

export async function inviteMember(workspaceId: string, email: string) {
  const { member } = await requireOwner(workspaceId)
  if (member.role !== 'owner' && member.role !== 'admin') return { error: 'Only owners can invite members' }

  const invitee = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!invitee) return { error: 'No user found with that email address' }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
  })
  if (existing) return { error: 'User is already a member of this workspace' }

  await prisma.workspaceMember.create({
    data: { workspaceId, userId: invitee.id, role: 'member' },
  })

  // Notify the invited user
  await prisma.notification.create({
    data: {
      userId: invitee.id,
      title: 'You were added to a workspace',
      body: `You now have access to the workspace.`,
      link: `/dashboard/${workspaceId}`,
    },
  })

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return { success: true }
}

export async function removeMember(workspaceId: string, targetUserId: string) {
  const { user, member } = await requireOwner(workspaceId)
  if (member.role !== 'owner') return { error: 'Only owners can remove members' }
  if (targetUserId === user.id) return { error: 'You cannot remove yourself' }

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })
  if (!target) return { error: 'Member not found' }
  if (target.role === 'owner') return { error: 'Cannot remove the workspace owner' }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return { success: true }
}

export async function updateMemberRole(workspaceId: string, targetUserId: string, role: string) {
  const { user, member } = await requireOwner(workspaceId)
  if (member.role !== 'owner') return { error: 'Only owners can change roles' }
  if (targetUserId === user.id) return { error: 'You cannot change your own role' }

  if (!['member', 'admin'].includes(role)) return { error: 'Invalid role' }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role },
  })

  revalidatePath(`/dashboard/${workspaceId}/settings`)
  return { success: true }
}

export async function deleteWorkspace(workspaceId: string) {
  const { member } = await requireOwner(workspaceId)
  if (member.role !== 'owner') return { error: 'Only owners can delete the workspace' }

  await prisma.workspace.delete({ where: { id: workspaceId } })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function generateShareLink(appId: string): Promise<{ token: string } | { error: string }> {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  const token = randomBytes(12).toString('base64url')
  await prisma.app.update({ where: { id: appId }, data: { shareToken: token } })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { token }
}

export async function revokeShareLink(appId: string): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { shareToken: null } })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { success: true }
}

// ── Form link ──────────────────────────────────────────────────────────────

export type FormConfig = {
  title: string
  description: string
  fieldIds: string[]
  submitLabel: string
}

export async function saveFormConfig(
  appId: string,
  config: FormConfig,
): Promise<{ token: string } | { error: string }> {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  const token = app.formToken ?? randomBytes(12).toString('base64url')
  await prisma.app.update({
    where: { id: appId },
    data: { formToken: token, formFieldsJson: JSON.stringify(config) },
  })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { token }
}

export async function revokeFormLink(appId: string): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { formToken: null, formFieldsJson: '{}' } })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { success: true }
}

export async function submitFormEntry(
  token: string,
  title: string,
  dataJson: string,
): Promise<{ success: boolean } | { error: string }> {
  const app = await prisma.app.findUnique({ where: { formToken: token } })
  if (!app) return { error: 'Form not found' }

  // Use a sentinel creator id — find any workspace member to be the "system" creator
  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: app.workspaceId } })
  if (!member) return { error: 'Workspace has no members' }

  await prisma.item.create({
    data: {
      appId: app.id,
      title: title.trim() || 'Untitled',
      dataJson,
      creatorId: member.userId,
    },
  })
  revalidatePath(`/dashboard/${app.workspaceId}/${app.id}`)
  return { success: true }
}
