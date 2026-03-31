import Link from 'next/link'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { AppField } from '@/lib/types'
import ItemsTable from '@/components/ItemsTable'
import KanbanBoard from '@/components/KanbanBoard'
import GalleryView from '@/components/GalleryView'
import CalendarView from '@/components/CalendarView'
import TimelineView from '@/components/TimelineView'

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
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 9999,
            fontSize: 11, fontWeight: 600,
            background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Read-only · {items.length} items
          </span>
          <Link
            href="/"
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--brand-400)',
              textDecoration: 'none', padding: '3px 10px',
              background: 'rgba(99,102,241,0.1)', borderRadius: 9999,
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            Powered by Flexora
          </Link>
        </div>
      </header>

      {/* View tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {(['table', 'kanban', 'gallery', 'calendar', 'timeline'] as const).map(v => (
          <a
            key={v}
            href={`?view=${v}`}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 12px', borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: view === v ? 'var(--bg-overlay)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 120ms',
            }}
          >{v.charAt(0).toUpperCase() + v.slice(1)}</a>
        ))}
      </div>

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
