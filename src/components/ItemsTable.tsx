'use client'

import { useRouter } from 'next/navigation'
import type { AppField } from '@/lib/types'

type ItemRow = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  creator: { name: string | null; email: string }
  _count: { comments: number; tasks: number }
}

type Props = {
  app: { id: string; workspaceId: string }
  items: ItemRow[]
  fields: AppField[]
  workspaceId: string
  userId: string
}

function FieldCell({ value, field }: { value: unknown; field: AppField }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--text-disabled)' }}>—</span>
  }
  switch (field.type) {
    case 'toggle':
      return <span style={{ fontSize: 15 }}>{value ? '✓' : '✗'}</span>
    case 'category': {
      const opt = field.options?.find(o => o.id === value)
      if (!opt) return <span style={{ color: 'var(--text-disabled)' }}>—</span>
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 10px', borderRadius: 9999,
          fontSize: 11, fontWeight: 600,
          background: opt.color + '22', color: opt.color,
        }}>{opt.label}</span>
      )
    }
    case 'date':
      try { return <span>{new Date(value as string).toLocaleDateString()}</span> }
      catch { return <span>{String(value)}</span> }
    case 'url':
      return (
        <a
          href={String(value)} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--brand-400)', textDecoration: 'none', fontSize: 13 }}
          onClick={e => e.stopPropagation()}
          className="truncate"
        >{String(value)}</a>
      )
    case 'toggle':
      return <span>{Boolean(value) ? '✓' : '—'}</span>
    default:
      return <span className="truncate" style={{ display: 'block', maxWidth: 200 }}>{String(value)}</span>
  }
}

function formatRelative(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ItemsTable({ app, items, fields, workspaceId }: Props) {
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <p className="empty-state-title">No items yet</p>
        <p className="empty-state-desc">Click "Add Item" to create your first entry.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', height: '100%' }}>
      <table className="data-table" style={{ minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ width: 36, color: 'var(--text-disabled)', fontSize: 11 }}>#</th>
            <th>Title</th>
            {fields.map(f => <th key={f.id}>{f.name}</th>)}
            <th>Creator</th>
            <th>Updated</th>
            <th style={{ width: 90 }}>Activity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            let data: Record<string, unknown> = {}
            try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
            return (
              <tr
                key={item.id}
                onClick={() => router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: 'var(--text-disabled)', fontSize: 11, fontWeight: 500, textAlign: 'center' }}>
                  {i + 1}
                </td>
                <td>
                  <span style={{
                    display: 'block', maxWidth: 300, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: 600, color: 'var(--text-primary)',
                  }}>{item.title}</span>
                </td>
                {fields.map(f => (
                  <td key={f.id}><FieldCell value={data[f.id]} field={f} /></td>
                ))}
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {item.creator.name ?? item.creator.email}
                </td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatRelative(item.updatedAt)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <span title="Comments">💬 {item._count.comments}</span>
                    <span title="Tasks">✓ {item._count.tasks}</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
