'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { filterNotifiable } from '@/lib/notifPrefs'
import type { AutomationTrigger, AutomationAction } from '@/lib/types'

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createAutomation(
  appId: string,
  data: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] },
) {
  const user = await requireUser()
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { workspace: { include: { members: true } } },
  })
  if (!app) return { error: 'App not found' }
  if (!app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }
  if (!data.name.trim()) return { error: 'Name is required' }

  const automation = await prisma.automation.create({
    data: {
      appId,
      name: data.name.trim(),
      triggerJson: JSON.stringify(data.trigger),
      actionsJson: JSON.stringify(data.actions),
    },
  })

  revalidatePath(`/dashboard/${app.workspaceId}/${appId}/automations`)
  return { automation }
}

export async function updateAutomation(
  automationId: string,
  data: { name?: string; isActive?: boolean; trigger?: AutomationTrigger; actions?: AutomationAction[] },
) {
  const user = await requireUser()
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!automation) return { error: 'Automation not found' }
  if (!automation.app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

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
    include: { app: { include: { workspace: { include: { members: true } } } } },
  })
  if (!automation) return { error: 'Automation not found' }
  if (!automation.app.workspace.members.some(m => m.userId === user.id)) return { error: 'Unauthorized' }

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

// ── Execution engine ──────────────────────────────────────────────────────────

type TriggerType = AutomationTrigger['type']

export async function executeAutomations(
  appId: string,
  triggerType: TriggerType,
  context: { itemId?: string; itemTitle?: string; userId?: string; workspaceId?: string },
) {
  // Fetch active automations matching this trigger
  const automations = await prisma.automation.findMany({
    where: { appId, isActive: true },
  })

  for (const automation of automations) {
    let trigger: AutomationTrigger
    let actions: AutomationAction[]
    try {
      trigger = JSON.parse(automation.triggerJson)
      actions = JSON.parse(automation.actionsJson)
    } catch { continue }

    if (trigger.type !== triggerType) continue

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

    // Determine recipients
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
}
