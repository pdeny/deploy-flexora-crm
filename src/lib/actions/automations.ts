'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { filterNotifiable } from '@/lib/notifPrefs'
import { getAppPermissions } from '@/lib/permissions'
import type { AutomationTrigger, AutomationAction, AppField } from '@/lib/types'

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createAutomation(
  appId: string,
  data: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] },
) {
  const user = await requireUser()
  const perms = await getAppPermissions(user.id, appId).catch(() => null)
  if (!perms?.can('app:manageAutomations')) return { error: 'Unauthorized' }
  if (!data.name.trim()) return { error: 'Name is required' }

  const automation = await prisma.automation.create({
    data: {
      appId,
      name: data.name.trim(),
      triggerJson: JSON.stringify(data.trigger),
      actionsJson: JSON.stringify(data.actions),
    },
  })

  revalidatePath(`/dashboard/${perms.workspaceId}/${appId}/automations`)
  return { automation }
}

export async function updateAutomation(
  automationId: string,
  data: { name?: string; isActive?: boolean; trigger?: AutomationTrigger; actions?: AutomationAction[] },
) {
  const user = await requireUser()
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { app: true },
  })
  if (!automation) return { error: 'Automation not found' }
  const perms = await getAppPermissions(user.id, automation.appId).catch(() => null)
  if (!perms?.can('app:manageAutomations')) return { error: 'Unauthorized' }

  await prisma.automation.update({
    where: { id: automationId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.trigger ? { triggerJson: JSON.stringify(data.trigger) } : {}),
      ...(data.actions ? { actionsJson: JSON.stringify(data.actions) } : {}),
    },
  })

  revalidatePath(`/dashboard/${automation.app.workspaceId}/${automation.appId}/automations`)
  return { success: true }
}

export async function deleteAutomation(automationId: string) {
  const user = await requireUser()
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { app: true },
  })
  if (!automation) return { error: 'Automation not found' }
  const perms = await getAppPermissions(user.id, automation.appId).catch(() => null)
  if (!perms?.can('app:manageAutomations')) return { error: 'Unauthorized' }

  await prisma.automation.delete({ where: { id: automationId } })
  revalidatePath(`/dashboard/${automation.app.workspaceId}/${automation.appId}/automations`)
  return { success: true }
}

export async function testWebhook(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  await requireUser()
  if (!url || !url.startsWith('http')) return { ok: false, error: 'Invalid URL' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: 'test',
        source: 'Flexora',
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// ── Condition evaluation ─────────────────────────────────────────────────────

function evaluateCondition(
  condition: { fieldId: string; operator: string; value: unknown },
  itemTitle: string,
  itemData: Record<string, unknown>,
  fields: AppField[],
): boolean {
  const raw = condition.fieldId === '__title__'
    ? itemTitle
    : itemData[condition.fieldId]

  const isEmpty = raw === null || raw === undefined || raw === ''

  if (condition.operator === 'is_empty') return isEmpty
  if (condition.operator === 'is_not_empty') return !isEmpty
  if (isEmpty) return false

  const field = fields.find(f => f.id === condition.fieldId)
  if (field?.type === 'multiselect' && Array.isArray(raw)) {
    const ruleVal = String(condition.value ?? '')
    if (condition.operator === 'contains') return raw.includes(ruleVal)
    if (condition.operator === 'not_contains') return !raw.includes(ruleVal)
    if (condition.operator === 'equals') return raw.length === 1 && raw[0] === ruleVal
    if (condition.operator === 'not_equals') return !raw.includes(ruleVal)
    return true
  }

  const strValue = String(raw).toLowerCase()
  const ruleStr = String(condition.value ?? '').toLowerCase()

  switch (condition.operator) {
    case 'contains': return strValue.includes(ruleStr)
    case 'not_contains': return !strValue.includes(ruleStr)
    case 'equals': return strValue === ruleStr
    case 'not_equals': return strValue !== ruleStr
    case 'gt': return Number(raw) > Number(condition.value)
    case 'gte': return Number(raw) >= Number(condition.value)
    case 'lt': return Number(raw) < Number(condition.value)
    case 'lte': return Number(raw) <= Number(condition.value)
    case 'before':
      try { return new Date(raw as string) < new Date(condition.value as string) }
      catch { return false }
    case 'after':
      try { return new Date(raw as string) > new Date(condition.value as string) }
      catch { return false }
    default: return true
  }
}

// ── Execution engine ──────────────────────────────────────────────────────────

type TriggerType = AutomationTrigger['type']

export async function executeAutomations(
  appId: string,
  triggerType: TriggerType,
  context: { itemId?: string; itemTitle?: string; userId?: string; workspaceId?: string },
  _depth = 0,
) {
  // Prevent infinite recursion from actions that trigger other automations
  if (_depth > 0) return

  const automations = await prisma.automation.findMany({
    where: { appId, isActive: true },
  })

  // Fetch app fields for condition evaluation
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { fieldsJson: true },
  })
  const fields: AppField[] = app ? JSON.parse(app.fieldsJson) : []

  for (const automation of automations) {
    let trigger: AutomationTrigger
    let actions: AutomationAction[]
    try {
      trigger = JSON.parse(automation.triggerJson)
      actions = JSON.parse(automation.actionsJson)
    } catch { continue }

    if (trigger.type !== triggerType) continue

    // Evaluate conditions if present
    if (trigger.conditions && trigger.conditions.length > 0 && context.itemId) {
      const item = await prisma.item.findUnique({
        where: { id: context.itemId },
        select: { title: true, dataJson: true },
      })
      if (!item) continue

      let itemData: Record<string, unknown> = {}
      try { itemData = JSON.parse(item.dataJson) } catch { /* ignore */ }

      const allMatch = trigger.conditions.every(c =>
        evaluateCondition(c, item.title, itemData, fields)
      )
      if (!allMatch) continue
    }

    // Execute each action
    for (const action of actions) {
      await runAction(action, appId, context)
    }
  }
}

async function runAction(
  action: AutomationAction,
  appId: string,
  context: { itemId?: string; itemTitle?: string; userId?: string; workspaceId?: string },
) {
  if (action.type === 'notify') {
    const cfg = action.config as { message?: string; notifyAll?: boolean }
    const message = cfg.message ?? 'An automation was triggered'

    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: { workspace: { include: { members: true } } },
    })
    if (!app) return

    const candidateIds = cfg.notifyAll
      ? app.workspace.members.map(m => m.userId)
      : context.userId ? [context.userId] : []

    const recipientIds = await filterNotifiable(candidateIds, app.workspaceId)

    for (const userId of recipientIds) {
      await prisma.notification.create({
        data: {
          userId,
          title: `Automation: ${message}`,
          body: context.itemTitle ? `Item: "${context.itemTitle}"` : '',
          link: context.workspaceId && context.itemId
            ? `/dashboard/${context.workspaceId}/${appId}/${context.itemId}`
            : null,
        },
      })
    }
  }

  if (action.type === 'webhook') {
    const cfg = action.config as { url?: string }
    if (!cfg.url) return
    try {
      await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'automation',
          itemId: context.itemId,
          itemTitle: context.itemTitle,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      })
    } catch { /* webhook failures are silent */ }
  }

  if (action.type === 'create_task') {
    const cfg = action.config as { title?: string; priority?: string }
    if (!cfg.title || !context.itemId || !context.userId) return
    await prisma.task.create({
      data: {
        itemId: context.itemId,
        title: cfg.title,
        priority: cfg.priority || 'medium',
        creatorId: context.userId,
        status: 'todo',
      },
    })
  }

  if (action.type === 'add_comment') {
    const cfg = action.config as { content?: string }
    if (!cfg.content || !context.itemId || !context.userId) return
    await prisma.comment.create({
      data: {
        itemId: context.itemId,
        authorId: context.userId,
        content: cfg.content,
      },
    })
    // Note: not re-triggering comment_added to prevent loops
  }

  if (action.type === 'create_item') {
    const cfg = action.config as { targetAppId?: string; title?: string; data?: Record<string, unknown> }
    if (!cfg.title || !context.userId) return
    await prisma.item.create({
      data: {
        appId: cfg.targetAppId || appId,
        title: cfg.title,
        dataJson: JSON.stringify(cfg.data || {}),
        creatorId: context.userId,
      },
    })
    // Note: not re-triggering item_created to prevent loops
  }

  if (action.type === 'update_item') {
    const cfg = action.config as { updates?: { fieldId: string; value: unknown }[] }
    if (!cfg.updates?.length || !context.itemId) return
    const item = await prisma.item.findUnique({
      where: { id: context.itemId },
      select: { dataJson: true },
    })
    if (!item) return

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }

    for (const upd of cfg.updates) {
      data[upd.fieldId] = upd.value
    }

    await prisma.item.update({
      where: { id: context.itemId },
      data: { dataJson: JSON.stringify(data) },
    })
    // Note: not re-triggering item_updated to prevent loops
  }
}
