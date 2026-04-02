'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { executeAutomations } from '@/lib/actions/automations'
import { shouldNotify } from '@/lib/notifPrefs'
import { getWorkspacePermissions, getAppPermissions } from '@/lib/permissions'
import type { AppField, FieldType, CategoryOption } from '@/lib/types'

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

  const perms = await getWorkspacePermissions(user.id, workspaceId).catch(() => null)
  if (!perms?.can('app:create')) return { error: 'Unauthorized' }

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

// ---- CSV import: create a full app from CSV data ----

function inferFieldType(values: string[]): FieldType {
  const samples = values.filter(v => v.trim() !== '').slice(0, 50)
  if (samples.length === 0) return 'text'

  const allMatch = (test: (v: string) => boolean) => samples.every(test)

  // Toggle (yes/no, true/false, 1/0)
  if (allMatch(v => /^(yes|no|true|false|si|sì|1|0)$/i.test(v.trim()))) return 'toggle'
  // Number
  if (allMatch(v => /^-?\d+([.,]\d+)?$/.test(v.trim().replace(/\s/g, '')))) return 'number'
  // Date (ISO, dd/mm/yyyy, mm/dd/yyyy, etc.)
  if (allMatch(v => !isNaN(Date.parse(v.trim())) && /\d/.test(v))) return 'date'
  // Email
  if (allMatch(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))) return 'email'
  // URL
  if (allMatch(v => /^https?:\/\/.+/i.test(v.trim()))) return 'url'
  // Phone
  if (allMatch(v => /^\+?[\d\s\-().]{7,}$/.test(v.trim()))) return 'phone'
  // Rating (1-5 integers)
  if (allMatch(v => /^[1-5]$/.test(v.trim()))) return 'rating'
  // Progress (0-100)
  if (allMatch(v => { const n = parseInt(v.trim()); return !isNaN(n) && n >= 0 && n <= 100 }) && samples.some(v => parseInt(v.trim()) > 5)) return 'progress'

  // Category detection: if <=15 unique values and values repeat
  const unique = new Set(samples.map(v => v.trim().toLowerCase()))
  if (unique.size <= 15 && unique.size < samples.length * 0.6) return 'category'

  return 'text'
}

function coerceValue(raw: string, type: FieldType): unknown {
  const v = raw.trim()
  if (!v) return undefined
  switch (type) {
    case 'number': return parseFloat(v.replace(/,/g, '.').replace(/\s/g, ''))
    case 'date': return new Date(v).toISOString()
    case 'toggle': return /^(yes|true|si|sì|1)$/i.test(v)
    case 'rating': return Math.min(5, Math.max(1, parseInt(v)))
    case 'progress': return Math.min(100, Math.max(0, parseInt(v)))
    default: return v
  }
}

export async function importAppFromCSV(data: {
  workspaceId: string
  appName: string
  headers: string[]
  rows: string[][]
  titleColumnIndex: number
  fieldTypes?: Record<number, FieldType> // col index → forced type override
}) {
  const user = await requireUser()
  const { workspaceId, appName, headers, rows, titleColumnIndex, fieldTypes } = data

  if (!workspaceId || !appName?.trim()) return { error: 'Workspace and name are required' }
  if (!headers.length || !rows.length) return { error: 'CSV is empty' }

  const perms = await getWorkspacePermissions(user.id, workspaceId).catch(() => null)
  if (!perms?.can('app:create')) return { error: 'Unauthorized' }

  // Build fields from non-title columns
  const fields: AppField[] = []
  const colFieldMap: Record<number, string> = {} // colIndex → fieldId

  headers.forEach((header, colIdx) => {
    if (colIdx === titleColumnIndex) return
    const name = header.trim()
    if (!name) return

    const colValues = rows.map(row => row[colIdx] ?? '')
    const type = fieldTypes?.[colIdx] ?? inferFieldType(colValues)
    const fieldId = `f-${Date.now()}-${colIdx}`

    const field: AppField = { id: fieldId, name, type }

    // For category fields, generate options from unique values
    if (type === 'category') {
      const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#e879f9', '#a855f7', '#22d3ee', '#facc15']
      const unique = [...new Set(colValues.map(v => v.trim()).filter(Boolean))]
      field.options = unique.map((label, i): CategoryOption => ({
        id: `opt-${Date.now()}-${colIdx}-${i}`,
        label,
        color: colors[i % colors.length],
      }))
    }

    fields.push(field)
    colFieldMap[colIdx] = fieldId
  })

  // Create the app
  const app = await prisma.app.create({
    data: {
      workspaceId,
      name: appName.trim(),
      iconEmoji: '📥',
      color: '#6366f1',
      fieldsJson: JSON.stringify(fields),
    },
  })

  // Bulk create items
  // Build a lookup for category label→optionId
  const categoryLookup: Record<string, Record<string, string>> = {}
  for (const f of fields) {
    if (f.type === 'category' && f.options) {
      categoryLookup[f.id] = {}
      for (const opt of f.options) {
        categoryLookup[f.id][opt.label.toLowerCase()] = opt.id
      }
    }
  }

  const itemsData = rows
    .map(row => {
      const title = (row[titleColumnIndex] ?? '').trim()
      if (!title) return null

      const itemData: Record<string, unknown> = {}
      for (const [colIdxStr, fieldId] of Object.entries(colFieldMap)) {
        const colIdx = parseInt(colIdxStr)
        const raw = row[colIdx] ?? ''
        if (!raw.trim()) continue
        const field = fields.find(f => f.id === fieldId)!
        if (field.type === 'category') {
          const optId = categoryLookup[fieldId]?.[raw.trim().toLowerCase()]
          if (optId) itemData[fieldId] = optId
        } else {
          const val = coerceValue(raw, field.type)
          if (val !== undefined) itemData[fieldId] = val
        }
      }

      return {
        appId: app.id,
        title,
        dataJson: JSON.stringify(itemData),
        creatorId: user.id,
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  if (itemsData.length > 0) {
    await prisma.item.createMany({ data: itemsData })
  }

  revalidatePath(`/dashboard/${workspaceId}`)
  return { app, importedCount: itemsData.length, skippedCount: rows.length - itemsData.length }
}

export async function upsertItemsFromCSV(data: {
  appId: string
  headers: string[]
  rows: string[][]
  mapping: Record<string, string> // csvHeader → fieldId | 'title'
  mode: 'create' | 'update' | 'upsert'
}) {
  const user = await requireUser()
  const { appId, headers, rows, mapping, mode } = data

  if (!appId) return { error: 'App ID is required' }

  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (mode === 'create' && !perms?.can('item:create')) return { error: 'Unauthorized' }
  if (mode !== 'create' && !perms?.can('item:update')) return { error: 'Unauthorized' }

  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return { error: 'App not found' }

  const fields: AppField[] = JSON.parse(app.fieldsJson)

  // Build title→item lookup for update/upsert modes
  let existingByTitle: Map<string, { id: string; dataJson: string }> | null = null
  if (mode !== 'create') {
    const items = await prisma.item.findMany({
      where: { appId },
      select: { id: true, title: true, dataJson: true },
    })
    existingByTitle = new Map(items.map(i => [i.title.toLowerCase().trim(), { id: i.id, dataJson: i.dataJson }]))
  }

  // Resolve category label → option id
  const categoryLookup: Record<string, Record<string, string>> = {}
  for (const f of fields) {
    if (f.type === 'category' && f.options) {
      categoryLookup[f.id] = {}
      for (const opt of f.options) {
        categoryLookup[f.id][opt.label.toLowerCase()] = opt.id
      }
    }
  }

  let created = 0, updated = 0, skipped = 0

  for (const row of rows) {
    let title = ''
    const rowData: Record<string, unknown> = {}

    headers.forEach((h, i) => {
      const mapped = mapping[h]
      if (!mapped) return
      const val = (row[i] ?? '').trim()
      if (mapped === 'title') { title = val; return }
      if (!val) return

      const field = fields.find(f => f.id === mapped)
      if (!field) { rowData[mapped] = val; return }

      if (field.type === 'category') {
        const optId = categoryLookup[mapped]?.[val.toLowerCase()]
        if (optId) rowData[mapped] = optId
        else rowData[mapped] = val
      } else if (field.type === 'number') {
        rowData[mapped] = parseFloat(val.replace(/,/g, '.').replace(/\s/g, ''))
      } else if (field.type === 'toggle') {
        rowData[mapped] = /^(yes|true|si|sì|1)$/i.test(val)
      } else if (field.type === 'date') {
        const d = new Date(val)
        rowData[mapped] = isNaN(d.getTime()) ? val : d.toISOString()
      } else if (field.type === 'rating') {
        rowData[mapped] = Math.min(5, Math.max(1, parseInt(val)))
      } else if (field.type === 'progress') {
        rowData[mapped] = Math.min(100, Math.max(0, parseInt(val)))
      } else {
        rowData[mapped] = val
      }
    })

    if (!title) { skipped++; continue }

    const existing = existingByTitle?.get(title.toLowerCase().trim())

    if (existing && mode !== 'create') {
      // Merge: existing data + new CSV data (CSV values overwrite)
      let oldData: Record<string, unknown> = {}
      try { oldData = JSON.parse(existing.dataJson) } catch { /* ignore */ }
      const merged = { ...oldData, ...rowData }
      await prisma.item.update({
        where: { id: existing.id },
        data: { title, dataJson: JSON.stringify(merged) },
      })
      updated++
    } else if (mode !== 'update') {
      await prisma.item.create({
        data: { appId, title, dataJson: JSON.stringify(rowData), creatorId: user.id },
      })
      created++
    } else {
      skipped++ // update mode but no existing item found
    }
  }

  revalidatePath(`/dashboard/${perms!.workspaceId}/${appId}`)
  return { created, updated, skipped }
}

export async function updateAppFields(appId: string, fieldsJson: string) {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:update')) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { fieldsJson } })
  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}`)
  return { success: true }
}

export async function saveColorRules(appId: string, colorRulesJson: string) {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:update')) return { error: 'Unauthorized' }

  await prisma.app.update({ where: { id: appId }, data: { colorRulesJson } })
  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}`)
  return { success: true }
}

export async function createItem(formData: FormData) {
  const user = await requireUser()
  const appId = formData.get('appId') as string
  const title = formData.get('title') as string
  const dataJson = formData.get('dataJson') as string

  if (!appId || !title?.trim()) return { error: 'App and title are required' }

  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('item:create')) return { error: 'Unauthorized' }

  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return { error: 'App not found' }

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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }

  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:update')) return { error: 'Unauthorized' }

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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }

  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:delete')) return { error: 'Unauthorized' }

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

  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:comment')) return { error: 'Unauthorized' }

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

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    include: { app: true },
  })

  // Check permission per distinct app
  const appIds = [...new Set(items.map(i => i.appId))]
  for (const aId of appIds) {
    const perms = await getAppPermissions(user.id, aId).catch(() => null)
    if (!perms?.can('item:delete')) return { error: 'Unauthorized' }
  }

  await prisma.item.deleteMany({ where: { id: { in: itemIds } } })

  const appPaths = [...new Set(items.map(i => `/dashboard/${i.app.workspaceId}/${i.appId}`))]
  for (const path of appPaths) revalidatePath(path)
  return { success: true, count: itemIds.length }
}

export async function reorderItems(appId: string, orderedIds: string[]) {
  const user = await requireUser()
  if (!orderedIds.length) return { error: 'No items' }
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('item:update')) return { error: 'Unauthorized' }
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.item.update({ where: { id }, data: { position: (i + 1) * 1000 } }))
  )
  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}`)
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
    include: { app: true },
  })

  const appIds = [...new Set(items.map(i => i.appId))]
  for (const aId of appIds) {
    const perms = await getAppPermissions(user.id, aId).catch(() => null)
    if (!perms?.can('item:update')) return { error: 'Unauthorized' }
  }

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
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:update')) return { error: 'Unauthorized' }
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
  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}`)
  revalidatePath(`/dashboard/${perms.workspaceId}`)
  return { success: true }
}

export async function deleteApp(appId: string) {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:delete')) return { error: 'Unauthorized' }

  await prisma.app.delete({ where: { id: appId } })
  revalidatePath(`/dashboard/${perms.workspaceId}`)
  return { success: true, workspaceId: perms.workspaceId }
}

export async function duplicateApp(appId: string) {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:duplicate')) return { error: 'Unauthorized' }

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { items: true, automations: true },
  })
  if (!app) return { error: 'App not found' }

  const newApp = await prisma.app.create({
    data: {
      workspaceId: app.workspaceId,
      name: `Copy of ${app.name}`,
      description: app.description,
      iconEmoji: app.iconEmoji,
      color: app.color,
      fieldsJson: app.fieldsJson,
      viewType: app.viewType,
      formFieldsJson: app.formFieldsJson,
      colorRulesJson: app.colorRulesJson,
    },
  })

  // Duplicate items
  if (app.items.length > 0) {
    await prisma.item.createMany({
      data: app.items.map(item => ({
        appId: newApp.id,
        title: item.title,
        dataJson: item.dataJson,
        position: item.position,
        creatorId: user.id,
      })),
    })
  }

  // Duplicate automations
  if (app.automations.length > 0) {
    await prisma.automation.createMany({
      data: app.automations.map(a => ({
        appId: newApp.id,
        name: a.name,
        isActive: a.isActive,
        triggerJson: a.triggerJson,
        actionsJson: a.actionsJson,
      })),
    })
  }

  revalidatePath(`/dashboard/${app.workspaceId}`)
  return { app: newApp }
}

export async function duplicateWorkspace(workspaceId: string) {
  const user = await requireUser()

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: true,
      apps: { include: { items: true, automations: true } },
    },
  })
  if (!workspace) return { error: 'Workspace not found' }

  const wsPerms = await getWorkspacePermissions(user.id, workspaceId).catch(() => null)
  if (!wsPerms?.can('workspace:read')) return { error: 'Unauthorized' }

  const slug = workspace.slug + '-copy-' + Date.now()

  const newWorkspace = await prisma.workspace.create({
    data: {
      name: `Copy of ${workspace.name}`,
      slug,
      description: workspace.description,
      color: workspace.color,
      iconEmoji: workspace.iconEmoji,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  })

  // Duplicate each app with its items and automations
  for (const app of workspace.apps) {
    const newApp = await prisma.app.create({
      data: {
        workspaceId: newWorkspace.id,
        name: app.name,
        description: app.description,
        iconEmoji: app.iconEmoji,
        color: app.color,
        fieldsJson: app.fieldsJson,
        viewType: app.viewType,
        formFieldsJson: app.formFieldsJson,
        colorRulesJson: app.colorRulesJson,
      },
    })

    if (app.items.length > 0) {
      await prisma.item.createMany({
        data: app.items.map(item => ({
          appId: newApp.id,
          title: item.title,
          dataJson: item.dataJson,
          position: item.position,
          creatorId: user.id,
        })),
      })
    }

    if (app.automations.length > 0) {
      await prisma.automation.createMany({
        data: app.automations.map(a => ({
          appId: newApp.id,
          name: a.name,
          isActive: a.isActive,
          triggerJson: a.triggerJson,
          actionsJson: a.actionsJson,
        })),
      })
    }
  }

  revalidatePath('/dashboard')
  return { workspace: newWorkspace }
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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }

  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:create')) return { error: 'Unauthorized' }

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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }

  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:manageTasks')) return { error: 'Unauthorized' }

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
    include: { item: { include: { app: true } } },
  })
  if (!task) return { error: 'Task not found' }

  const perms = await getAppPermissions(user.id, task.item.appId).catch(() => null)
  if (!perms?.can('item:manageTasks')) return { error: 'Unauthorized' }

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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }
  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:update')) return { error: 'Unauthorized' }

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
    include: { app: true },
  })
  if (!item) return { error: 'Item not found' }
  const perms = await getAppPermissions(user.id, item.appId).catch(() => null)
  if (!perms?.can('item:update')) return { error: 'Unauthorized' }

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
  const perms = await getAppPermissions(user.id, relatedAppId).catch(() => null)
  if (!perms?.can('app:read')) return { items: [] }

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

export async function setAppMemberRole(
  appId: string,
  targetUserId: string,
  role: string | null,
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:update')) return { error: 'Unauthorized' }

  if (role === null) {
    // Remove app-level override
    await prisma.appMember.deleteMany({ where: { appId, userId: targetUserId } })
  } else {
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) return { error: 'Invalid role' }
    await prisma.appMember.upsert({
      where: { appId_userId: { appId, userId: targetUserId } },
      update: { role },
      create: { appId, userId: targetUserId, role },
    })
  }

  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}`)
  return { success: true }
}
