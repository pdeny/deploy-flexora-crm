import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { getAppPermissions, toPermissionMap } from '@/lib/permissions'
import AppHeader from '@/components/AppHeader'
import ItemsTable from '@/components/ItemsTable'
import KanbanBoard from '@/components/KanbanBoard'
import GalleryView from '@/components/GalleryView'
import CalendarView from '@/components/CalendarView'
import TimelineView from '@/components/TimelineView'
import type { AppField } from '@/lib/types'
import type { FilterRule } from '@/lib/filters'
import { applyFilters, applySort } from '@/lib/filters'
import { computeRollupLookup } from '@/lib/rollup'

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; appId: string }>
  searchParams: Promise<{ view?: string; filters?: string; sortField?: string; sortDir?: string }>

}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId, appId } = await params
  const sp = await searchParams

  const [app, workspaceApps] = await Promise.all([
    prisma.app.findUnique({
      where: { id: appId },
      include: {
        workspace: { include: { members: true } },
        items: {
          include: { creator: true, _count: { select: { comments: true, tasks: true } } },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        },
      },
    }),
    prisma.app.findMany({
      where: { workspaceId },
      select: { id: true, name: true, iconEmoji: true, fieldsJson: true },
      orderBy: { name: 'asc' },
    }),
  ])
  if (!app || app.workspaceId !== workspaceId) notFound()

  let perms
  try { perms = await getAppPermissions(user.id, appId) } catch { redirect('/dashboard') }
  const can = toPermissionMap(perms)

  const fields: AppField[] = JSON.parse(app.fieldsJson)

  // Parse filters from URL
  let filterRules: FilterRule[] = []
  try {
    if (sp.filters) filterRules = JSON.parse(decodeURIComponent(sp.filters))
  } catch { /* ignore malformed */ }

  // Apply filters and sort
  const sortField = sp.sortField ?? ''
  const sortDir = (sp.sortDir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'

  let items = app.items as typeof app.items
  items = applyFilters(items, filterRules, fields) as typeof app.items
  if (sortField === '__updatedAt__') {
    items = [...items].sort((a, b) =>
      sortDir === 'asc'
        ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ) as typeof app.items
  } else {
    items = applySort(items, sortField || undefined, sortDir, fields) as typeof app.items
  }

  // Compute rollup/lookup values and merge into items
  const lookupRollupFields = fields.filter(f => (f.type === 'lookup' || f.type === 'rollup') && f.linkedFieldId)
  let finalItems: typeof items = items
  if (lookupRollupFields.length > 0) {
    const relFieldIds = [...new Set(lookupRollupFields.map(f => f.linkedFieldId!))]
    const itemIds = items.map(i => i.id)
    const [relations, linkedItemsRaw] = await Promise.all([
      prisma.itemRelation.findMany({
        where: { fieldId: { in: relFieldIds }, fromItemId: { in: itemIds } },
        select: { fieldId: true, fromItemId: true, toItemId: true },
      }),
      (async () => {
        const toIds = await prisma.itemRelation.findMany({
          where: { fieldId: { in: relFieldIds }, fromItemId: { in: itemIds } },
          select: { toItemId: true },
        }).then(rs => [...new Set(rs.map(r => r.toItemId))])
        return toIds.length > 0
          ? prisma.item.findMany({ where: { id: { in: toIds } }, select: { id: true, title: true, dataJson: true } })
          : []
      })(),
    ])
    const linkedItemsMap = Object.fromEntries(linkedItemsRaw.map(li => [li.id, li]))
    const computed = computeRollupLookup(items, fields, relations, linkedItemsMap)
    finalItems = items.map(item => {
      const extra = computed[item.id]
      if (!extra || Object.keys(extra).length === 0) return item
      let d: Record<string, unknown> = {}
      try { d = JSON.parse(item.dataJson) } catch { /* */ }
      return { ...item, dataJson: JSON.stringify({ ...d, ...extra }) }
    }) as typeof items
  }

  // Fetch linked item titles for relation fields so the table can display them
  const relationFields = fields.filter(f => f.type === 'relation')
  const relationsMap: Record<string, Record<string, { id: string; title: string }[]>> = {}
  if (relationFields.length > 0 && finalItems.length > 0) {
    const itemIds = finalItems.map(i => i.id)
    const relFieldIds = relationFields.map(f => f.id)
    const rels = await prisma.itemRelation.findMany({
      where: { fieldId: { in: relFieldIds }, fromItemId: { in: itemIds } },
      include: { toItem: { select: { id: true, title: true } } },
    })
    for (const r of rels) {
      if (!relationsMap[r.fromItemId]) relationsMap[r.fromItemId] = {}
      if (!relationsMap[r.fromItemId][r.fieldId]) relationsMap[r.fromItemId][r.fieldId] = []
      relationsMap[r.fromItemId][r.fieldId].push({ id: r.toItemId, title: r.toItem.title })
    }
  }

  const view = (['kanban', 'gallery', 'calendar', 'timeline'].includes(sp.view ?? '') ? sp.view : 'table') as 'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AppHeader
        app={app}
        workspaceId={workspaceId}
        fields={fields}
        userId={user.id}
        currentView={view}
        filterRules={filterRules}
        sortField={sortField}
        sortDir={sortDir}
        items={finalItems}
        workspaceApps={workspaceApps}
        can={can}
      />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view === 'table' && <ItemsTable app={app} items={finalItems} fields={fields} workspaceId={workspaceId} userId={user.id} canReorder={!sortField} relationsMap={relationsMap} can={can} />}
        {view === 'kanban' && <KanbanBoard app={app} items={finalItems} fields={fields} workspaceId={workspaceId} />}
        {view === 'gallery' && <GalleryView app={app} items={finalItems} fields={fields} workspaceId={workspaceId} />}
        {view === 'calendar' && <CalendarView app={app} items={finalItems} fields={fields} workspaceId={workspaceId} />}
        {view === 'timeline' && <TimelineView app={app} items={finalItems} fields={fields} workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
