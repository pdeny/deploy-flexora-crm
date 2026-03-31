'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createWorkspace(formData: FormData) {
  const user = await requireUser()
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string
  const iconEmoji = formData.get('iconEmoji') as string

  if (!name?.trim()) return { error: 'Name is required' }

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      color: color || '#6366f1',
      iconEmoji: iconEmoji || '🏢',
      members: { create: { userId: user.id, role: 'owner' } },
    },
  })

  revalidatePath('/dashboard')
  return { workspace }
}

export async function createApp(formData: FormData) {
  const user = await requireUser()
  const workspaceId = formData.get('workspaceId') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const iconEmoji = formData.get('iconEmoji') as string
  const color = formData.get('color') as string

  if (!workspaceId || !name?.trim()) return { error: 'Workspace and name are required' }

  // Verify membership
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) return { error: 'Not a member of this workspace' }

  const app = await prisma.app.create({
    data: {
      workspaceId,
      name: name.trim(),
      description: description?.trim() || null,
      iconEmoji: iconEmoji || '📋',
      color: color || '#6366f1',
    },
  })

  revalidatePath(`/dashboard/${workspaceId}`)
  return { app }
}

export async function updateAppFields(appId: string, fieldsJson: string) {
  const user = await requireUser()

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { fieldsJson } })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { success: true }
}

export async function createItem(formData: FormData) {
  const user = await requireUser()
  const appId = formData.get('appId') as string
  const title = formData.get('title') as string
  const dataJson = formData.get('dataJson') as string

  if (!appId || !title?.trim()) return { error: 'App and title are required' }

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const item = await prisma.item.create({
    data: {
      appId,
      title: title.trim(),
      dataJson: dataJson || '{}',
      creatorId: user.id,
    },
    include: { creator: true },
  })

  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { item }
}

export async function updateItem(itemId: string, data: { title?: string; dataJson?: string }) {
  const user = await requireUser()

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const updated = await prisma.item.update({ where: { id: itemId }, data })
  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}`)
  return { item: updated }
}

export async function deleteItem(itemId: string) {
  const user = await requireUser()

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  await prisma.item.delete({ where: { id: itemId } })
  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}`)
  return { success: true }
}

export async function addComment(formData: FormData) {
  const user = await requireUser()
  const itemId = formData.get('itemId') as string
  const content = formData.get('content') as string

  if (!itemId || !content?.trim()) return { error: 'Content is required' }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const comment = await prisma.comment.create({
    data: { itemId, authorId: user.id, content: content.trim() },
    include: { author: true },
  })

  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${itemId}`)
  return { comment }
}

export async function createTask(formData: FormData) {
  const user = await requireUser()
  const itemId   = formData.get('itemId') as string
  const title    = formData.get('title') as string
  const priority = (formData.get('priority') as string) || 'medium'
  const dueDate  = formData.get('dueDate') as string

  if (!itemId || !title?.trim()) return { error: 'Title is required' }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const task = await prisma.task.create({
    data: {
      itemId,
      title: title.trim(),
      priority,
      creatorId: user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: { creator: true, assignee: true },
  })

  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${itemId}`)
  return { task }
}

export async function updateTaskStatus(taskId: string, status: string) {
  const user = await requireUser()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { item: { include: { app: { include: { workspace: { include: { members: true } } } } } } },
  })
  if (!task) return { error: 'Task not found' }

  const isMember = task.item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  await prisma.task.update({ where: { id: taskId }, data: { status } })
  revalidatePath(`/dashboard/${task.item.app.workspaceId}/${task.item.appId}/${task.itemId}`)
  return { success: true }
}
