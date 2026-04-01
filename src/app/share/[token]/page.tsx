import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { AppField } from '@/lib/types'
import ItemsTable from '@/components/ItemsTable'
import KanbanBoard from '@/components/KanbanBoard'
import GalleryView from '@/components/GalleryView'
import CalendarView from '@/components/CalendarView'
import TimelineView from '@/components/TimelineView'
import { ShareReadOnlyBadge, SharePoweredBy, ShareViewTabs } from './ShareBadges'

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { token } = await params
  const sp = await searchParams

  const app = await prisma.app.findUnique({
    where: { shareToken: token },
    include: {
      items: {
        include: { creator: true, _count: { select: { comments: true, tasks: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!app) notFound()

  const fields: AppField[] = JSON.parse(app.fieldsJson)
  const items = app.items
  const view = (['kanban', 'gallery', 'calendar', 'timeline'].includes(sp.view ?? '') ? sp.view : 'table') as
    'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Read-only header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: app.color + '22', border: `1px solid ${app.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{app.iconEmoji}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{app.name}</div>
          {app.description && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{app.description}</div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShareReadOnlyBadge itemCount={items.length} />
          <SharePoweredBy />
        </div>
      </header>

      <ShareViewTabs currentView={view} />

      {/* Content — read-only: pass a fake userId that won't match any member */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view === 'table' && (
          <ItemsTable app={app} items={items} fields={fields} workspaceId={app.workspaceId} userId="__readonly__" readOnly />
        )}
        {view === 'kanban' && <KanbanBoard app={app} items={items} fields={fields} workspaceId={app.workspaceId} />}
        {view === 'gallery' && <GalleryView app={app} items={items} fields={fields} workspaceId={app.workspaceId} />}
        {view === 'calendar' && <CalendarView app={app} items={items} fields={fields} workspaceId={app.workspaceId} />}
        {view === 'timeline' && <TimelineView app={app} items={items} fields={fields} workspaceId={app.workspaceId} />}
      </div>
    </div>
  )
}
