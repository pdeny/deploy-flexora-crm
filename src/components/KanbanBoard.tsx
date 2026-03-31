'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef, useEffect } from 'react'
import type { AppField } from '@/lib/types'
import { formatRelative } from '@/lib/utils'
import { createItem, updateItem } from '@/lib/actions/workspace'

type ItemRow = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  creator: { name: string | null; email: string }
  _count: { comments: number; tasks: number }
}

type KanbanColumn = {
  id: string
  label: string
  color: string
  items: ItemRow[]
}

type Props = {
  app: { id: string; workspaceId: string }
  items: ItemRow[]
  fields: AppField[]
  workspaceId: string
}

function FieldPreview({ value, field }: { value: unknown; field: AppField }) {
  if (value === null || value === undefined || value === '') return null
  if (field.type === 'category') {
    const opt = field.options?.find(o => o.id === value)
    if (!opt) return null
    return (
      <span style={{
        padding: '1px 7px', borderRadius: 9999,
        fontSize: 10, fontWeight: 700,
        background: opt.color + '22', color: opt.color,
        border: `1px solid ${opt.color}33`,
      }}>{opt.label}</span>
    )
  }
  if (field.type === 'toggle') {
    return <span style={{ fontSize: 11, color: value ? 'var(--success)' : 'var(--text-disabled)' }}>{value ? '✓' : '✗'}</span>
  }
  if (field.type === 'multiselect') {
    const ids = Array.isArray(value) ? value as string[] : []
    const opts = ids.map(id => field.options?.find(o => o.id === id)).filter(Boolean)
    if (opts.length === 0) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {opts.slice(0, 3).map(opt => opt && (
          <span key={opt.id} style={{ padding: '1px 5px', borderRadius: 9999, fontSize: 9, fontWeight: 700, background: opt.color + '22', color: opt.color }}>{opt.label}</span>
        ))}
        {opts.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-disabled)' }}>+{opts.length-3}</span>}
      </div>
    )
  }
  if (field.type === 'rating') {
    const n = Number(value)
    return <span style={{ fontSize: 12, color: '#f59e0b' }}>{'★'.repeat(n)}</span>
  }
  if (field.type === 'progress') {
    const pct = Math.min(100, Math.max(0, Number(value)))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--bg-overlay)', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-500)', borderRadius: 9999 }} />
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-disabled)', fontWeight: 700 }}>{pct}%</span>
      </div>
    )
  }
  if (field.type === 'date') {
    let dateStr: string | null = null
    try { dateStr = new Date(value as string).toLocaleDateString() } catch { /* skip */ }
    return dateStr ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dateStr}</span> : null
  }
  if (field.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={String(value)} alt=""
        style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 2 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  const str = String(value)
  if (!str) return null
  return <span style={{ fontSize: 11, color: 'var(--text-secondary)' }} className="truncate">{str.slice(0, 40)}</span>
}

// ─── Quick-add form at bottom of column ──────────────────────────────────────

function QuickAdd({
  appId,
  groupFieldId,
  groupOptionId,
  onDone,
}: {
  appId: string
  groupFieldId: string
  groupOptionId: string | null
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) { onDone(); return }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('appId', appId)
      fd.set('title', trimmed)
      const data: Record<string, unknown> = {}
      if (groupOptionId) data[groupFieldId] = groupOptionId
      fd.set('dataJson', JSON.stringify(data))
      await createItem(fd)
      onDone()
    })
  }

  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)' }}>
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Item title…"
        disabled={isPending}
        style={{
          width: '100%', background: 'var(--bg-overlay)', border: '1px solid var(--brand-500)',
          borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit',
          fontSize: 13, padding: '6px 9px', outline: 'none',
          boxShadow: '0 0 0 2px rgba(99,102,241,0.2)',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); onDone() }
        }}
        onBlur={() => { if (!isPending) submit() }}
      />
      <p style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 4 }}>↵ to add · Esc to cancel</p>
    </div>
  )
}

export default function KanbanBoard({ app, items, fields, workspaceId }: Props) {
  const router = useRouter()

  // Find first category field to group by
  const categoryFields = fields.filter(f => f.type === 'category')
  const [groupFieldId, setGroupFieldId] = useState<string>(categoryFields[0]?.id ?? '')
  const groupField = fields.find(f => f.id === groupFieldId)
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState(items)
  const [, startTransition] = useTransition()

  // Keep localItems in sync with server-fetched items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalItems(items) }, [JSON.stringify(items.map(i => i.id + i.dataJson))])

  if (categoryFields.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏷</div>
        <p className="empty-state-title">No category fields</p>
        <p className="empty-state-desc">Add a category field to use Kanban view. Go to Fields → Add Field → Category.</p>
      </div>
    )
  }

  function handleDrop(colId: string, itemId: string) {
    setDragOverCol(null)
    setDraggingId(null)
    // Optimistic: update local dataJson for the dragged item
    setLocalItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      const newData = { ...data, [groupFieldId]: colId === '__none__' ? '' : colId }
      return { ...item, dataJson: JSON.stringify(newData) }
    }))
    // Sync to server
    startTransition(async () => {
      const item = localItems.find(i => i.id === itemId)
      if (!item) return
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      const newData = { ...data, [groupFieldId]: colId === '__none__' ? '' : colId }
      await updateItem(itemId, { dataJson: JSON.stringify(newData) })
    })
  }

  // Build columns
  const columns: KanbanColumn[] = []

  if (groupField?.options) {
    for (const opt of groupField.options) {
      columns.push({ id: opt.id, label: opt.label, color: opt.color, items: [] })
    }
  }
  // Always include "No category" column
  columns.push({ id: '__none__', label: 'No Category', color: 'var(--text-disabled)', items: [] })

  for (const item of localItems) {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
    const val = data[groupFieldId]
    const col = columns.find(c => c.id === val) ?? columns[columns.length - 1]
    col.items.push(item)
  }

  // Remove empty "No category" column if it has no items
  const visibleColumns = columns.filter(c => c.items.length > 0 || c.id !== '__none__')

  // Preview fields: fields other than the groupBy field, first 3
  const previewFields = fields.filter(f => f.id !== groupFieldId).slice(0, 3)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Group by selector */}
      {categoryFields.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          background: 'var(--bg-surface)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Group by</span>
          <select
            className="form-input form-select"
            value={groupFieldId}
            onChange={e => setGroupFieldId(e.target.value)}
            style={{ width: 'auto', padding: '4px 30px 4px 10px', fontSize: 12 }}
          >
            {categoryFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Kanban board */}
      <div className="kanban-board">
        {visibleColumns.map(col => (
          <div
            key={col.id}
            className={`kanban-column ${dragOverCol === col.id ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.id) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
            onDrop={e => { e.preventDefault(); if (draggingId) handleDrop(col.id, draggingId) }}
          >
            {/* Column header */}
            <div className="kanban-col-header">
              <span
                style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{col.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600 }}>{col.items.length}</span>
            </div>

            {/* Cards */}
            <div className="kanban-cards">
              {col.items.length === 0 && quickAddCol !== col.id && (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-disabled)', fontSize: 12 }}>
                  Empty
                </div>
              )}
              {col.items.map(item => {
                let data: Record<string, unknown> = {}
                try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }

                return (
                  <div
                    key={item.id}
                    className={`kanban-card ${draggingId === item.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={e => { setDraggingId(item.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    onClick={() => { if (!draggingId) router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`) }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
                      {item.title}
                    </div>

                    {previewFields.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                        {previewFields.map(f => {
                          const val = data[f.id]
                          if (val === null || val === undefined || val === '') return null
                          return (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-disabled)', fontWeight: 600, minWidth: 60 }} className="truncate">{f.name}</span>
                              <FieldPreview value={val} field={f} />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      paddingTop: 8, borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{formatRelative(item.updatedAt)}</span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {item._count.comments > 0 && <span>💬 {item._count.comments}</span>}
                        {item._count.tasks > 0 && <span>✓ {item._count.tasks}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick-add */}
            {quickAddCol === col.id ? (
              <QuickAdd
                appId={app.id}
                groupFieldId={groupFieldId}
                groupOptionId={col.id === '__none__' ? null : col.id}
                onDone={() => setQuickAddCol(null)}
              />
            ) : (
              <button
                className="kanban-quick-add-btn"
                onClick={() => setQuickAddCol(col.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add item
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .kanban-board {
          display: flex;
          gap: 12px;
          padding: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          flex: 1;
          align-items: flex-start;
        }
        .kanban-column {
          display: flex;
          flex-direction: column;
          width: 272px;
          flex-shrink: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
          max-height: 100%;
        }
        .kanban-col-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          background: var(--bg-elevated);
        }
        .kanban-cards {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          flex: 1;
        }
        .kanban-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 12px 13px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .kanban-card:hover {
          border-color: var(--border-strong);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .kanban-card.dragging {
          opacity: 0.4;
          cursor: grabbing;
        }
        .kanban-card[draggable="true"] { cursor: grab; }
        .kanban-column.drag-over {
          border-color: var(--brand-500);
          background: rgba(99,102,241,0.05);
        }
        .kanban-column.drag-over .kanban-cards {
          outline: 2px dashed rgba(99,102,241,0.3);
          outline-offset: -4px;
          border-radius: 8px;
        }
        .kanban-quick-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 8px 14px;
          background: none;
          border: none;
          border-top: 1px solid var(--border-subtle);
          color: var(--text-disabled);
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: color var(--transition-fast), background var(--transition-fast);
          flex-shrink: 0;
        }
        .kanban-quick-add-btn:hover {
          color: var(--text-secondary);
          background: var(--bg-hover);
        }
      `}</style>
    </div>
  )
}
