'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useTransition, useRef } from 'react'
import type { AppField } from '@/lib/types'
import { formatRelative } from '@/lib/utils'
import { evalFormula, formatFormulaResult } from '@/lib/formula'
import { deleteItem, duplicateItem, updateItem, bulkDeleteItems, bulkUpdateField } from '@/lib/actions/workspace'

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
  readOnly?: boolean
}

type ContextMenu = {
  x: number
  y: number
  itemId: string
  itemTitle: string
}

type EditingCell = {
  itemId: string
  fieldId: string   // '__title__' for the title column
}

// ─── Static field display ────────────────────────────────────────────────────

function FieldCell({ value, field }: { value: unknown; field: AppField }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span style={{ color: 'var(--text-disabled)' }}>—</span>
  }
  switch (field.type) {
    case 'toggle':
      return <span style={{ fontSize: 14 }}>{value ? '✓' : '✗'}</span>
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
    case 'multiselect': {
      const ids = Array.isArray(value) ? value as string[] : []
      const opts = ids.map(id => field.options?.find(o => o.id === id)).filter(Boolean)
      if (opts.length === 0) return <span style={{ color: 'var(--text-disabled)' }}>—</span>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {opts.map(opt => opt && (
            <span key={opt.id} style={{
              padding: '1px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
              background: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}33`,
            }}>{opt.label}</span>
          ))}
        </div>
      )
    }
    case 'rating': {
      const n = Number(value)
      return (
        <span style={{ fontSize: 14, letterSpacing: 1 }}>
          {'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}
        </span>
      )
    }
    case 'progress': {
      const pct = Math.min(100, Math.max(0, Number(value)))
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
          <div style={{ flex: 1, height: 5, background: 'var(--bg-overlay)', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--brand-500)', borderRadius: 9999, transition: 'width 300ms' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 28 }}>{pct}%</span>
        </div>
      )
    }
    case 'date': {
      let dateStr: string
      try { dateStr = new Date(value as string).toLocaleDateString() }
      catch { dateStr = String(value) }
      return <span>{dateStr}</span>
    }
    case 'url':
      return (
        <a
          href={String(value)} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--brand-400)', textDecoration: 'none', fontSize: 13 }}
          onClick={e => e.stopPropagation()}
          className="truncate"
        >{String(value)}</a>
      )
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(value)} alt="" onClick={e => e.stopPropagation()}
          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )
    default:
      return <span className="truncate" style={{ display: 'block', maxWidth: 200 }}>{String(value)}</span>
  }
}

// ─── Inline editor ────────────────────────────────────────────────────────────

function InlineEditor({
  field,
  value,
  onSave,
  onCancel,
}: {
  field: AppField
  value: unknown
  onSave: (v: unknown) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>(null)
  // Hoist all hooks unconditionally
  const [multiSel, setMultiSel] = useState<string[]>(() =>
    Array.isArray(value) ? value as string[] : []
  )

  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 10)
  }, [])

  const baseStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-overlay)',
    border: '1px solid var(--brand-500)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: '4px 8px',
    outline: 'none',
    boxShadow: '0 0 0 2px rgba(99,102,241,0.2)',
  }

  if (field.type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          defaultChecked={Boolean(value)}
          style={{ width: 15, height: 15, accentColor: 'var(--brand-500)' }}
          onChange={e => { onSave(e.target.checked) }}
          onBlur={e => onSave(e.target.checked)}
          autoFocus
        />
        <span style={{ fontSize: 12 }}>{value ? 'Yes' : 'No'}</span>
      </label>
    )
  }

  if (field.type === 'rating') {
    const cur = Number(value ?? 0)
    return (
      <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onSave(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: n <= cur ? '#f59e0b' : 'var(--text-disabled)', padding: 0 }}>★</button>
        ))}
      </div>
    )
  }

  if (field.type === 'progress') {
    const cur = Number(value ?? 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
        <input type="range" min={0} max={100} defaultValue={cur}
          style={{ flex: 1, accentColor: 'var(--brand-500)' }}
          onMouseUp={e => onSave(+(e.target as HTMLInputElement).value)}
          onKeyDown={e => e.key === 'Enter' && onSave(+(e.target as HTMLInputElement).value)}
          autoFocus />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 32 }}>{cur}%</span>
      </div>
    )
  }

  if (field.type === 'multiselect' && field.options) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} onClick={e => e.stopPropagation()}>
        {field.options.map(o => {
          const active = multiSel.includes(o.id)
          return (
            <button key={o.id} type="button" onClick={() => {
              const next = active ? multiSel.filter(x => x !== o.id) : [...multiSel, o.id]
              setMultiSel(next)
              onSave(next)
            }} style={{
              padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
              border: `1px solid ${o.color}${active ? '88' : '33'}`,
              background: active ? o.color + '33' : 'transparent',
              color: active ? o.color : 'var(--text-disabled)', cursor: 'pointer',
            }}>{o.label}</button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'category' && field.options) {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        defaultValue={String(value ?? '')}
        style={baseStyle}
        onChange={e => onSave(e.target.value)}
        onBlur={e => onSave(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onSave((e.target as HTMLSelectElement).value) }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        onClick={e => e.stopPropagation()}
      >
        <option value="">—</option>
        {field.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    )
  }

  const typeMap: Partial<Record<string, string>> = {
    date: 'date', number: 'number', email: 'email', url: 'url', phone: 'tel',
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={typeMap[field.type] ?? 'text'}
      defaultValue={String(value ?? '')}
      style={baseStyle}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onSave((e.target as HTMLInputElement).value) }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      }}
      onClick={e => e.stopPropagation()}
    />
  )
}

// ─── Bulk toolbar ─────────────────────────────────────────────────────────────

function BulkToolbar({
  count,
  fields,
  onDelete,
  onBulkField,
  onClear,
  isPending,
}: {
  count: number
  fields: AppField[]
  onDelete: () => void
  onBulkField: (fieldId: string, value: unknown) => void
  onClear: () => void
  isPending: boolean
}) {
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [chosenField, setChosenField] = useState<AppField | null>(null)
  const [fieldValue, setFieldValue] = useState<string>('')
  const [confirmDel, setConfirmDel] = useState(false)


  function applyField() {
    if (!chosenField) return
    const val = chosenField.type === 'category' ? fieldValue : fieldValue
    onBulkField(chosenField.id, val)
    setShowFieldPicker(false)
    setChosenField(null)
    setFieldValue('')
  }

  return (
    <div className="bulk-toolbar">
      <span className="bulk-count">{count} selected</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Bulk set field */}
        {fields.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowFieldPicker(v => !v); setConfirmDel(false) }}
              disabled={isPending}
            >
              Set field
            </button>
            {showFieldPicker && (
              <div className="bulk-field-popover">
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Update field for all selected</p>
                <select
                  className="form-input"
                  style={{ marginBottom: 6 }}
                  value={chosenField?.id ?? ''}
                  onChange={e => {
                    const f = fields.find(x => x.id === e.target.value) ?? null
                    setChosenField(f)
                    setFieldValue('')
                  }}
                >
                  <option value="">Choose field…</option>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {chosenField && chosenField.type === 'category' && chosenField.options && (
                  <select
                    className="form-input"
                    style={{ marginBottom: 8 }}
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                  >
                    <option value="">— clear —</option>
                    {chosenField.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                )}
                {chosenField && chosenField.type !== 'category' && (
                  <input
                    className="form-input"
                    style={{ marginBottom: 8 }}
                    type={chosenField.type === 'number' ? 'number' : chosenField.type === 'date' ? 'date' : 'text'}
                    placeholder={`New ${chosenField.name} value`}
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                  />
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={applyField} disabled={!chosenField || isPending}>Apply</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowFieldPicker(false); setChosenField(null) }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk delete */}
        <div style={{ position: 'relative' }}>
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delete {count} items?</span>
              <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={isPending}>Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => { setConfirmDel(true); setShowFieldPicker(false) }}
              disabled={isPending}
            >
              Delete
            </button>
          )}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={isPending}>Clear</button>
      </div>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function ItemsTable({ app, items, fields, workspaceId, readOnly = false }: Props) {
  const router = useRouter()
  const [localItems, setLocalItems] = useState<ItemRow[]>(items)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [groupBy, setGroupBy] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [colorBy, setColorBy] = useState<string>('')

  // Keep localItems in sync when parent re-renders (server refetch)
  useEffect(() => { setLocalItems(items) }, [items])
  // Clear selection when items change (after bulk delete)
  useEffect(() => { setSelectedIds(new Set()) }, [items])

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return
    function handleClick() { setContextMenu(null); setConfirmDelete(null) }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') { setContextMenu(null); setConfirmDelete(null) } }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  function openContextMenu(e: React.MouseEvent, item: ItemRow) {
    e.preventDefault()
    e.stopPropagation()
    setEditingCell(null)
    setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id, itemTitle: item.title })
    setConfirmDelete(null)
  }

  function handleDuplicate(itemId: string) {
    setContextMenu(null)
    startTransition(async () => { await duplicateItem(itemId) })
  }

  function handleDelete(itemId: string) {
    setContextMenu(null)
    startTransition(async () => { await deleteItem(itemId) })
  }

  // Inline save — optimistic update then server sync
  function saveCell(item: ItemRow, fieldId: string, value: unknown) {
    setEditingCell(null)
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }

    if (fieldId === '__title__') {
      const newTitle = String(value).trim()
      if (!newTitle || newTitle === item.title) return
      setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, title: newTitle } : i))
      startTransition(async () => { await updateItem(item.id, { title: newTitle }) })
    } else {
      const newData = { ...data, [fieldId]: value }
      setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, dataJson: JSON.stringify(newData) } : i))
      startTransition(async () => { await updateItem(item.id, { dataJson: JSON.stringify(newData) }) })
    }
  }

  // Bulk selection helpers
  const allSelected = localItems.length > 0 && localItems.every(i => selectedIds.has(i.id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(localItems.map(i => i.id)))
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    setLocalItems(prev => prev.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
    startTransition(async () => { await bulkDeleteItems(ids) })
  }

  function handleBulkField(fieldId: string, value: unknown) {
    const ids = Array.from(selectedIds)
    setLocalItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      return { ...item, dataJson: JSON.stringify({ ...data, [fieldId]: value }) }
    }))
    startTransition(async () => { await bulkUpdateField(ids, fieldId, value) })
  }

  // ── Grouping logic ──────────────────────────────────────────────────────────
  const groupField = fields.find(f => f.id === groupBy)

  type Group = { key: string; label: string; color?: string; items: ItemRow[] }
  const groups: Group[] = (() => {
    if (!groupField) return [{ key: '__all__', label: '', items: localItems }]
    const map = new Map<string, Group>()
    if (groupField.options) {
      for (const opt of groupField.options) {
        map.set(opt.id, { key: opt.id, label: opt.label, color: opt.color, items: [] })
      }
    }
    map.set('__none__', { key: '__none__', label: 'No value', items: [] })
    for (const item of localItems) {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      const val = String(data[groupField.id] ?? '')
      if (map.has(val)) map.get(val)!.items.push(item)
      else map.get('__none__')!.items.push(item)
    }
    return Array.from(map.values()).filter(g => g.items.length > 0 || g.key !== '__none__')
  })()

  const colorField = colorBy ? fields.find(f => f.id === colorBy) : null

  function renderRows(rowItems: ItemRow[]) {
    return rowItems.map((item) => {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      const isEditingTitle = editingCell?.itemId === item.id && editingCell.fieldId === '__title__'
      const isSelected = selectedIds.has(item.id)

      // Color by category field
      let rowColor: string | undefined
      if (colorField?.type === 'category') {
        const optId = data[colorField.id]
        const opt = colorField.options?.find(o => o.id === optId)
        if (opt) rowColor = opt.color
      }

      return (
        <tr
          key={item.id}
          onClick={() => { if (!readOnly && !editingCell) router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`) }}
          onContextMenu={readOnly ? undefined : e => openContextMenu(e, item)}
          style={{
            cursor: readOnly ? 'default' : editingCell ? 'default' : 'pointer',
            background: isSelected ? 'rgba(99,102,241,0.07)' : rowColor ? rowColor + '0d' : undefined,
            borderLeft: rowColor ? `3px solid ${rowColor}88` : undefined,
          }}
        >
          <td onClick={e => toggleSelect(item.id, e)} style={{ textAlign: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              style={{ accentColor: 'var(--brand-500)', cursor: 'pointer', width: 14, height: 14 }}
            />
          </td>

          {/* Title — click to edit */}
          <td
            onClick={readOnly ? undefined : e => { e.stopPropagation(); setEditingCell({ itemId: item.id, fieldId: '__title__' }) }}
            style={{ minWidth: 180 }}
            title={readOnly ? undefined : 'Click to edit'}
          >
            {isEditingTitle ? (
              <input
                autoFocus
                defaultValue={item.title}
                style={{
                  width: '100%', background: 'var(--bg-overlay)',
                  border: '1px solid var(--brand-500)', borderRadius: 6,
                  color: 'var(--text-primary)', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, padding: '4px 8px',
                  outline: 'none', boxShadow: '0 0 0 2px rgba(99,102,241,0.2)',
                }}
                onBlur={e => saveCell(item, '__title__', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveCell(item, '__title__', (e.target as HTMLInputElement).value) }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null) }
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="editable-cell-title">{item.title}</span>
            )}
          </td>

          {/* Custom field cells */}
          {fields.map(f => {
            if (f.type === 'relation') {
              // Relation data is not in dataJson — show a placeholder
              return (
                <td key={f.id} style={{ minWidth: 100 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                    Open item ↗
                  </span>
                </td>
              )
            }
            if (f.type === 'calculation') {
              const { result, error } = evalFormula(f.calcFormula ?? '', fields, data)
              return (
                <td key={f.id} style={{ minWidth: 100 }} title={error}>
                  <span style={{
                    fontSize: 12, fontFamily: 'monospace',
                    color: error ? 'var(--error)' : 'var(--text-secondary)',
                    fontStyle: error ? 'italic' : undefined,
                  }}>
                    {error ? '⚠ err' : formatFormulaResult(result)}
                  </span>
                </td>
              )
            }
            const isEditing = editingCell?.itemId === item.id && editingCell.fieldId === f.id
            return (
              <td
                key={f.id}
                onClick={readOnly ? undefined : e => { e.stopPropagation(); setEditingCell({ itemId: item.id, fieldId: f.id }) }}
                title={readOnly ? undefined : 'Click to edit'}
                style={{ minWidth: 100 }}
              >
                {isEditing ? (
                  <InlineEditor
                    field={f}
                    value={data[f.id]}
                    onSave={v => saveCell(item, f.id, v)}
                    onCancel={() => setEditingCell(null)}
                  />
                ) : (
                  <span className="editable-cell">
                    <FieldCell value={data[f.id]} field={f} />
                  </span>
                )}
              </td>
            )
          })}

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
    })
  }

  const totalCols = 5 + fields.length

  if (localItems.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <p className="empty-state-title">No items yet</p>
        <p className="empty-state-desc">Click &quot;Add Item&quot; to create your first entry.</p>
      </div>
    )
  }

  return (
    <>
      {someSelected && (
        <BulkToolbar
          count={selectedIds.size}
          fields={fields}
          onDelete={handleBulkDelete}
          onBulkField={handleBulkField}
          onClear={() => setSelectedIds(new Set())}
          isPending={isPending}
        />
      )}

      {/* Group-by + Color-by toolbar */}
      {fields.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px',
          borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Group by</span>
            <select
              className="form-input form-select"
              value={groupBy}
              onChange={e => { setGroupBy(e.target.value); setCollapsedGroups(new Set()) }}
              style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 11 }}
            >
              <option value="">— None —</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {groupBy && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-tertiary)' }} onClick={() => setGroupBy('')}>×</button>
            )}
          </div>
          {fields.some(f => f.type === 'category') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Color by</span>
              <select
                className="form-input form-select"
                value={colorBy}
                onChange={e => setColorBy(e.target.value)}
                style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 11 }}
              >
                <option value="">— None —</option>
                {fields.filter(f => f.type === 'category').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {colorBy && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-tertiary)' }} onClick={() => setColorBy('')}>×</button>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ overflowX: 'auto', height: '100%' }}>
        <table className="data-table" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  style={{ accentColor: 'var(--brand-500)', cursor: 'pointer', width: 14, height: 14 }}
                  title={allSelected ? 'Deselect all' : 'Select all'}
                />
              </th>
              <th>Title</th>
              {fields.map(f => (
                <th key={f.id} title={f.description}>
                  {f.name}
                  {f.required && <span style={{ color: 'var(--error)', marginLeft: 2 }}>*</span>}
                  {f.description && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>ⓘ</span>}
                </th>
              ))}
              <th>Creator</th>
              <th>Updated</th>
              <th style={{ width: 90 }}>Activity</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const isCollapsed = collapsedGroups.has(group.key)
              return [
                // Group header row (only when grouping is active)
                groupField && (
                  <tr key={`hdr-${group.key}`} className="group-header-row" onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(group.key)) next.delete(group.key)
                    else next.add(group.key)
                    return next
                  })}>
                    <td colSpan={totalCols} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms', color: 'var(--text-tertiary)', flexShrink: 0 }}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        {group.color ? (
                          <span style={{ padding: '1px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: group.color + '22', color: group.color, border: `1px solid ${group.color}33` }}>
                            {group.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{group.label}</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600 }}>{group.items.length}</span>
                      </div>
                    </td>
                  </tr>
                ),
                // Item rows
                ...(isCollapsed ? [] : renderRows(group.items)),
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="row-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => { setContextMenu(null); router.push(`/dashboard/${workspaceId}/${app.id}/${contextMenu.itemId}`) }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open detail
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDuplicate(contextMenu.itemId)}
            disabled={isPending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Duplicate
          </button>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
          {confirmDelete === contextMenu.itemId ? (
            <div style={{ padding: '6px 10px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Delete &quot;{contextMenu.itemTitle.slice(0, 30)}&quot;?</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-danger btn-sm" style={{ fontSize: 11, flex: 1 }} onClick={() => handleDelete(contextMenu.itemId)} disabled={isPending}>Delete</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="context-menu-item danger" onClick={e => { e.stopPropagation(); setConfirmDelete(contextMenu.itemId) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Delete…
            </button>
          )}
        </div>
      )}

      <style>{`
        .bulk-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: var(--radius-sm);
          margin-bottom: 8px;
          animation: fadeIn 120ms ease;
        }
        .bulk-count {
          font-size: 13px;
          font-weight: 600;
          color: var(--brand-400);
        }
        .bulk-field-popover {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 300;
          background: var(--bg-overlay);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
          padding: 12px;
          min-width: 240px;
          animation: fadeIn 80ms ease;
        }
        .editable-cell-title {
          display: block;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 600;
          color: var(--text-primary);
        }
        .editable-cell {
          display: block;
        }
        td:hover .editable-cell-title,
        td:hover .editable-cell {
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: var(--text-disabled);
          text-underline-offset: 3px;
        }
        .row-context-menu {
          position: fixed;
          z-index: 400;
          background: var(--bg-overlay);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
          padding: 4px;
          min-width: 160px;
          animation: fadeIn 80ms ease;
        }
        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          font-size: 12.5px;
          font-weight: 500;
          font-family: inherit;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .context-menu-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .context-menu-item.danger { color: var(--error); }
        .context-menu-item.danger:hover { background: rgba(239,68,68,0.1); }
        .context-menu-item:disabled { opacity: 0.4; cursor: not-allowed; }
        .group-header-row td {
          user-select: none;
        }
        .group-header-row:hover td { background: var(--bg-hover) !important; }
      `}</style>
    </>
  )
}
