'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { executeAutomations } from '@/lib/actions/automations'
import { shouldNotify } from '@/lib/notifPrefs'
import type { AppField } from '@/lib/types'

function formatActivityValue(value: unknown, field?: AppField): string {
  if (value === null || value === undefined || value === '') return '(empty)'
  if (field?.type === 'toggle') return value ? 'Yes' : 'No'
  if (field?.type === 'category') {
    const opt = field.options?.find(o => o.id === value)
    return opt?.label ?? String(value)
  }
  if (field?.type === 'multiselect') {
    const ids = Array.isArray(value) ? (value as string[]) : []
    const labels = ids.map(id => field.options?.find(o => o.id === id)?.label ?? id)
    return labels.length > 0 ? labels.join(', ') : '(none)'
  }
  if (field?.type === 'rating') return `${'★'.repeat(Number(value))} (${value}/5)`
  if (field?.type === 'progress') return `${value}%`
  if (field?.type === 'date') {
    try { return new Date(value as string).toLocaleDateString() } catch { return String(value) }
  }
  if (Array.isArray(value)) return `[${(value as unknown[]).join(', ')}]`
  return String(value).slice(0, 60)
}

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
  const fieldsJson = formData.get('fieldsJson') as string | null

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
      ...(fieldsJson ? { fieldsJson } : {}),
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

export async function saveColorRules(appId: string, colorRulesJson: string) {
  const user = await requireUser()

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }

  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { colorRulesJson } })
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

  // Validate required fields
  const fields: AppField[] = JSON.parse(app.fieldsJson)
  let itemData: Record<string, unknown> = {}
  try { itemData = JSON.parse(dataJson || '{}') } catch { /* ignore */ }
  for (const field of fields) {
    if (!field.required) continue
    const val = itemData[field.id]
    const isEmpty =
      val === null || val === undefined || val === '' ||
      (Array.isArray(val) && val.length === 0)
    if (isEmpty) return { error: `"${field.name}" is required` }
  }

  const item = await prisma.item.create({
    data: {
      appId,
      title: title.trim(),
      dataJson: dataJson || '{}',
      creatorId: user.id,
    },
    include: { creator: true },
  })

  // Fire item_created automations (non-blocking)
  executeAutomations(appId, 'item_created', {
    itemId: item.id,
    itemTitle: item.title,
    userId: user.id,
    workspaceId: app.workspaceId,
  }).catch(() => {})

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

  // Build activity log entries
  const fields: AppField[] = JSON.parse(item.app.fieldsJson)
  const logEntries: Array<{ action: string; metaJson: string }> = []

  if (data.title !== undefined && data.title !== item.title) {
    logEntries.push({
      action: 'title_updated',
      metaJson: JSON.stringify({ oldValue: item.title.slice(0, 80), newValue: data.title.slice(0, 80) }),
    })
  }
  if (data.dataJson) {
    let oldData: Record<string, unknown> = {}
    let newData: Record<string, unknown> = {}
    try { oldData = JSON.parse(item.dataJson) } catch { /* ignore */ }
    try { newData = JSON.parse(data.dataJson) } catch { /* ignore */ }
    for (const [key, newVal] of Object.entries(newData)) {
      if (key.startsWith('__')) continue // skip internal keys like __description__
      const oldVal = oldData[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        const field = fields.find(f => f.id === key)
        logEntries.push({
          action: 'field_updated',
          metaJson: JSON.stringify({
            fieldName: field?.name ?? key,
            oldValue: formatActivityValue(oldVal, field),
            newValue: formatActivityValue(newVal, field),
          }),
        })
      }
    }
  }

  const updated = await prisma.item.update({ where: { id: itemId }, data })

  if (logEntries.length > 0) {
    await prisma.activityLog.createMany({
      data: logEntries.map(l => ({ itemId, userId: user.id, action: l.action, metaJson: l.metaJson })),
    })
  }

  // Fire item_updated automations (non-blocking)
  executeAutomations(item.appId, 'item_updated', {
    itemId,
    itemTitle: updated.title,
    userId: user.id,
    workspaceId: item.app.workspaceId,
  }).catch(() => {})

  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}`)
  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${itemId}`)
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
    include: { app: { include: { workspace: { include: { members: { include: { user: true } } } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const comment = await prisma.comment.create({
    data: { itemId, authorId: user.id, content: content.trim() },
    include: { author: true },
  })

  const notifyLink = `/dashboard/${item.app.workspaceId}/${item.appId}/${itemId}`

  // Notify item creator if different from commenter
  if (item.creatorId !== user.id) {
    if (await shouldNotify(item.creatorId, item.app.workspaceId)) {
      await prisma.notification.create({
        data: {
          userId: item.creatorId,
          title: `New comment on "${item.title}"`,
          body: content.trim().slice(0, 120),
          link: notifyLink,
        },
      })
    }
  }

  // Notify @mentioned workspace members
  const mentionRegex = /@([\w.-]+)/g
  const mentionTokens = [...content.matchAll(mentionRegex)].map(m => m[1].toLowerCase())
  if (mentionTokens.length > 0) {
    const notifiedIds = new Set<string>([user.id, item.creatorId]) // avoid double-notifying
    for (const member of item.app.workspace.members) {
      const u = member.user
      const nameSlug = (u.name ?? u.email).toLowerCase().replace(/\s+/g, '.')
      const emailSlug = u.email.toLowerCase().split('@')[0]
      if (mentionTokens.some(t => nameSlug.startsWith(t) || emailSlug.startsWith(t))) {
        if (!notifiedIds.has(u.id) && member.notificationsEnabled) {
          notifiedIds.add(u.id)
          await prisma.notification.create({
            data: {
              userId: u.id,
              title: `You were mentioned in "${item.title}"`,
              body: content.trim().slice(0, 120),
              link: notifyLink,
            },
          })
        }
      }
    }
  }

  // Fire comment_added automations (non-blocking)
  executeAutomations(item.appId, 'comment_added', {
    itemId,
    itemTitle: item.title,
    userId: user.id,
    workspaceId: item.app.workspaceId,
  }).catch(() => {})

  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${itemId}`)
  return { comment }
}

export async function bulkDeleteItems(itemIds: string[]) {
  const user = await requireUser()
  if (!itemIds.length) return { error: 'No items specified' }

  // Verify all items belong to workspaces the user is a member of
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  const unauthorized = items.some(item =>
    !item.app.workspace.members.some(m => m.userId === user.id)
  )
  if (unauthorized) return { error: 'Unauthorized' }

  await prisma.item.deleteMany({ where: { id: { in: itemIds } } })

  // Revalidate all affected app paths
  const appPaths = [...new Set(items.map(i => `/dashboard/${i.app.workspaceId}/${i.appId}`))]
  for (const path of appPaths) revalidatePath(path)
  return { success: true, count: itemIds.length }
}

export async function reorderItems(appId: string, orderedIds: string[]) {
  const user = await requireUser()
  if (!orderedIds.length) return { error: 'No items' }
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.item.update({ where: { id }, data: { position: (i + 1) * 1000 } }))
  )
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  return { success: true }
}

export async function bulkUpdateField(
  itemIds: string[],
  fieldId: string,
  value: unknown,
) {
  const user = await requireUser()
  if (!itemIds.length) return { error: 'No items specified' }

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  const unauthorized = items.some(item =>
    !item.app.workspace.members.some(m => m.userId === user.id)
  )
  if (unauthorized) return { error: 'Unauthorized' }

  // Update each item's dataJson
  for (const item of items) {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
    data[fieldId] = value
    await prisma.item.update({ where: { id: item.id }, data: { dataJson: JSON.stringify(data) } })
  }

  const appPaths = [...new Set(items.map(i => `/dashboard/${i.app.workspaceId}/${i.appId}`))]
  for (const path of appPaths) revalidatePath(path)
  return { success: true }
}

export async function updateApp(
  appId: string,
  data: { name?: string; description?: string; iconEmoji?: string; color?: string },
) {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  const isMember = app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }
  if (data.name !== undefined && !data.name.trim()) return { error: 'Name is required' }

  await prisma.app.update({
    where: { id: appId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.iconEmoji ? { iconEmoji: data.iconEmoji } : {}),
      ...(data.color ? { color: data.color } : {}),
    },
  })
  revalidatePath(`/dashboard/${app.workspaceId}/${appId}`)
  revalidatePath(`/dashboard/${app.workspaceId}`)
  return { success: true }
}

export async function deleteApp(appId: string) {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }

  const member = app.workspace.members.find(m => m.userId === user.id)
  if (!member) return { error: 'Unauthorized' }
  if (member.role !== 'owner' && member.role !== 'admin') return { error: 'Only owners and admins can delete apps' }

  await prisma.app.delete({ where: { id: appId } })
  revalidatePath(`/dashboard/${app.workspaceId}`)
  return { success: true, workspaceId: app.workspaceId }
}

export async function searchItems(query: string) {
  const user = await requireUser()
  if (!query.trim()) return { results: [] }

  // Get all workspaces the user is a member of
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    select: { workspaceId: true },
  })
  const workspaceIds = memberships.map(m => m.workspaceId)

  // Get all apps in those workspaces
  const apps = await prisma.app.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: { id: true, name: true, iconEmoji: true, color: true, workspaceId: true },
  })
  const appIds = apps.map(a => a.id)
  const appMap = Object.fromEntries(apps.map(a => [a.id, a]))

  // Search items by title (case-insensitive)
  const q = query.trim().toLowerCase()
  const items = await prisma.item.findMany({
    where: {
      appId: { in: appIds },
      title: { contains: query.trim(), mode: 'insensitive' },
    },
    select: {
      id: true, title: true, appId: true, createdAt: true, updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  // Also search apps by name
  const matchingApps = apps.filter(a => a.name.toLowerCase().includes(q)).slice(0, 5)

  return {
    results: {
      items: items.map(item => ({
        ...item,
        app: appMap[item.appId],
      })),
      apps: matchingApps,
    },
  }
}

export async function duplicateItem(itemId: string) {
  const user = await requireUser()

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }

  const isMember = item.app.workspace.members.some(m => m.userId === user.id)
  if (!isMember) return { error: 'Unauthorized' }

  const copy = await prisma.item.create({
    data: {
      appId: item.appId,
      title: `Copy of ${item.title}`,
      dataJson: item.dataJson,
      creatorId: user.id,
    },
  })

  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}`)
  return { item: copy }
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

// ── Linked Records (Item Relations) ───────────────────────────────────────

export async function addRelation(
  fieldId: string,
  fromItemId: string,
  toItemId: string,
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const item = await prisma.item.findUnique({
    where: { id: fromItemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }
  if (!item.app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  await prisma.itemRelation.upsert({
    where: { fieldId_fromItemId_toItemId: { fieldId, fromItemId, toItemId } },
    update: {},
    create: { fieldId, fromItemId, toItemId },
  })
  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${fromItemId}`)
  return { success: true }
}

export async function removeRelation(
  fieldId: string,
  fromItemId: string,
  toItemId: string,
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const item = await prisma.item.findUnique({
    where: { id: fromItemId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!item) return { error: 'Item not found' }
  if (!item.app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

  await prisma.itemRelation.deleteMany({ where: { fieldId, fromItemId, toItemId } })
  revalidatePath(`/dashboard/${item.app.workspaceId}/${item.appId}/${fromItemId}`)
  return { success: true }
}

export async function getRelatedItems(
  fieldId: string,
  fromItemId: string,
): Promise<{ items: { id: string; title: string }[] }> {
  const relations = await prisma.itemRelation.findMany({
    where: { fieldId, fromItemId },
    include: { toItem: { select: { id: true, title: true } } },
  })
  return { items: relations.map(r => r.toItem) }
}

export async function searchItemsForRelation(
  relatedAppId: string,
  query: string,
): Promise<{ items: { id: string; title: string }[] }> {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: relatedAppId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app || !app.workspace.members.some(m => m.userId === user.id)) return { items: [] }

  const items = await prisma.item.findMany({
    where: {
      appId: relatedAppId,
      ...(query.trim() ? { title: { contains: query.trim(), mode: 'insensitive' } } : {}),
    },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
    take: 20,
  })
  return { items }
}
