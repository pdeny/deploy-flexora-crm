'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useTransition, useRef } from 'react'
import type { AppField, ColorRule } from '@/lib/types'
import { formatRelative } from '@/lib/utils'
import { evalFormula, formatFormulaResult } from '@/lib/formula'
import { deleteItem, duplicateItem, updateItem, bulkDeleteItems, bulkUpdateField, reorderItems } from '@/lib/actions/workspace'
import { MultiselectCombobox } from '@/components/MultiselectCombobox'
import { useT } from '@/contexts/LanguageContext'

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
  app: { id: string; workspaceId: string; colorRulesJson?: string }
  items: ItemRow[]
  fields: AppField[]
  workspaceId: string
  userId: string
  readOnly?: boolean
  canReorder?: boolean
  /** itemId → fieldId → linked items (title + id) */
  relationsMap?: Record<string, Record<string, { id: string; title: string }[]>>
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
    case 'lookup':
      return (
        <span className="truncate" style={{ display: 'block', maxWidth: 200, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {String(value)}
        </span>
      )
    case 'rollup':
      return (
        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-400)' }}>
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
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
      <div onClick={e => e.stopPropagation()}>
        <MultiselectCombobox
          options={field.options}
          value={multiSel}
          onChange={next => { setMultiSel(next); onSave(next) }}
        />
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

// ─── Color rule evaluator ─────────────────────────────────────────────────────

function evalConditionValue(itemVal: unknown, op: string, condVal: unknown, field?: AppField): boolean {
  const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
  switch (op) {
    case 'is_empty': return isEmpty(itemVal)
    case 'is_not_empty': return !isEmpty(itemVal)
    case 'equals':
      if (field?.type === 'toggle') return Boolean(itemVal) === (condVal === 'true' || condVal === true)
      if (field?.type === 'category') return itemVal === condVal
      return String(itemVal ?? '').toLowerCase() === String(condVal ?? '').toLowerCase()
    case 'not_equals':
      if (field?.type === 'toggle') return Boolean(itemVal) !== (condVal === 'true' || condVal === true)
      if (field?.type === 'category') return itemVal !== condVal
      return String(itemVal ?? '').toLowerCase() !== String(condVal ?? '').toLowerCase()
    case 'contains': return String(itemVal ?? '').toLowerCase().includes(String(condVal ?? '').toLowerCase())
    case 'not_contains': return !String(itemVal ?? '').toLowerCase().includes(String(condVal ?? '').toLowerCase())
    case 'gt': return Number(itemVal) > Number(condVal)
    case 'gte': return Number(itemVal) >= Number(condVal)
    case 'lt': return Number(itemVal) < Number(condVal)
    case 'lte': return Number(itemVal) <= Number(condVal)
    case 'before': {
      const d1 = new Date(itemVal as string), d2 = new Date(condVal as string)
      return !isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d1 < d2
    }
    case 'after': {
      const d1 = new Date(itemVal as string), d2 = new Date(condVal as string)
      return !isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d1 > d2
    }
    default: return false
  }
}

function getColorRuleMatch(item: { title: string; dataJson: string }, rules: ColorRule[], fields: AppField[]): string | undefined {
  for (const rule of rules) {
    if (rule.conditions.length === 0) return rule.color
    let d: Record<string, unknown> = {}
    try { d = JSON.parse(item.dataJson) } catch { /* */ }
    const allMatch = rule.conditions.every(cond => {
      const itemVal = cond.fieldId === '__title__' ? item.title : d[cond.fieldId]
      const field = fields.find(f => f.id === cond.fieldId)
      return evalConditionValue(itemVal, cond.op, cond.value, field)
    })
    if (allMatch) return rule.color
  }
  return undefined
}

// ─── Summary row ──────────────────────────────────────────────────────────────

type SummaryType = 'none' | 'count' | 'empty' | 'sum' | 'avg' | 'min' | 'max' | 'checked' | 'pct_filled'

function getAvailableSummaryOpts(field: AppField): { type: SummaryType; label: string }[] {
  const base: { type: SummaryType; label: string }[] = [
    { type: 'none',       label: 'None' },
    { type: 'count',      label: 'Count (non-empty)' },
    { type: 'empty',      label: 'Count (empty)' },
    { type: 'pct_filled', label: '% Filled' },
  ]
  const numeric: { type: SummaryType; label: string }[] = [
    { type: 'sum', label: 'Sum' },
    { type: 'avg', label: 'Average' },
    { type: 'min', label: 'Min' },
    { type: 'max', label: 'Max' },
  ]
  switch (field.type) {
    case 'number':
    case 'rating':
    case 'progress':
    case 'calculation':
    case 'rollup':
      return [...base, ...numeric]
    case 'date':
      return [...base, { type: 'min', label: 'Earliest' }, { type: 'max', label: 'Latest' }]
    case 'toggle':
      return [
        { type: 'none',    label: 'None' },
        { type: 'checked', label: 'Checked' },
        { type: 'empty',   label: 'Unchecked' },
        { type: 'count',   label: 'Count (non-empty)' },
      ]
    case 'relation':
      return [{ type: 'none', label: 'None' }]
    default:
      return base
  }
}

function computeSummaryValue(
  items: { id: string; dataJson: string }[],
  field: AppField,
  type: SummaryType,
): { label: string; value: string } | null {
  if (type === 'none' || items.length === 0) return null
  const values = items.map(item => {
    let d: Record<string, unknown> = {}
    try { d = JSON.parse(item.dataJson) } catch { /* */ }
    return d[field.id]
  })
  const n = items.length
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

  switch (type) {
    case 'count':
      return { label: 'Count', value: String(values.filter(v => !isEmpty(v)).length) }
    case 'empty':
      if (field.type === 'toggle')
        return { label: 'Unchecked', value: String(values.filter(v => !v).length) }
      return { label: 'Empty', value: String(values.filter(isEmpty).length) }
    case 'pct_filled': {
      const filled = values.filter(v => !isEmpty(v)).length
      return { label: '% Filled', value: `${Math.round((filled / n) * 100)}%` }
    }
    case 'checked':
      return { label: 'Checked', value: String(values.filter(v => Boolean(v)).length) }
    case 'sum': {
      const nums = values.map(v => (v !== null && v !== undefined && v !== '') ? Number(v) : NaN).filter(v => !isNaN(v))
      if (!nums.length) return { label: 'Sum', value: '—' }
      return { label: 'Sum', value: parseFloat(nums.reduce((a, b) => a + b, 0).toFixed(4)).toString() }
    }
    case 'avg': {
      const nums = values.map(v => (v !== null && v !== undefined && v !== '') ? Number(v) : NaN).filter(v => !isNaN(v))
      if (!nums.length) return { label: 'Avg', value: '—' }
      return { label: 'Avg', value: parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4)).toString() }
    }
    case 'min': {
      if (field.type === 'date') {
        const times = values.filter(v => v && typeof v === 'string').map(v => new Date(v as string).getTime()).filter(t => !isNaN(t))
        if (!times.length) return { label: 'Earliest', value: '—' }
        return { label: 'Earliest', value: new Date(Math.min(...times)).toLocaleDateString() }
      }
      const nums = values.map(v => (v !== null && v !== undefined && v !== '') ? Number(v) : NaN).filter(v => !isNaN(v))
      if (!nums.length) return { label: 'Min', value: '—' }
      return { label: 'Min', value: String(Math.min(...nums)) }
    }
    case 'max': {
      if (field.type === 'date') {
        const times = values.filter(v => v && typeof v === 'string').map(v => new Date(v as string).getTime()).filter(t => !isNaN(t))
        if (!times.length) return { label: 'Latest', value: '—' }
        return { label: 'Latest', value: new Date(Math.max(...times)).toLocaleDateString() }
      }
      const nums = values.map(v => (v !== null && v !== undefined && v !== '') ? Number(v) : NaN).filter(v => !isNaN(v))
      if (!nums.length) return { label: 'Max', value: '—' }
      return { label: 'Max', value: String(Math.max(...nums)) }
    }
    default:
      return null
  }
}

function SummaryCell({
  field,
  items,
  summaryType,
  onChange,
}: {
  field: AppField
  items: { id: string; dataJson: string }[]
  summaryType: SummaryType
  onChange: (type: SummaryType) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const opts = getAvailableSummaryOpts(field)
  const result = summaryType !== 'none' ? computeSummaryValue(items, field, summaryType) : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={e => { e.stopPropagation(); if (opts.length > 1) setOpen(o => !o) }}
        title={opts.length > 1 ? 'Click to change aggregate' : undefined}
        style={{
          cursor: opts.length > 1 ? 'pointer' : 'default',
          padding: '3px 6px', borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600,
          background: open ? 'var(--bg-overlay)' : 'transparent',
          userSelect: 'none', transition: 'background 150ms',
          whiteSpace: 'nowrap',
        }}
      >
        {result ? (
          <>
            <span style={{ fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>{result.label}</span>
            <span style={{ color: 'var(--brand-400)' }}>{result.value}</span>
          </>
        ) : (
          opts.length > 1 ? <span style={{ color: 'var(--text-disabled)', opacity: 0.4, fontSize: 13 }}>+</span> : null
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50, marginBottom: 4,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 8, boxShadow: 'var(--shadow-lg)', padding: '4px 0', minWidth: 170,
        }}>
          {opts.map(opt => (
            <button
              key={opt.type}
              onClick={() => { onChange(opt.type); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 14px', fontSize: 12, background: 'none', border: 'none',
                color: opt.type === summaryType ? 'var(--brand-400)' : 'var(--text-primary)',
                fontWeight: opt.type === summaryType ? 700 : 400, cursor: 'pointer',
              }}
            >
              {opt.type === summaryType ? '✓ ' : '\u00a0\u00a0'}{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const { t } = useT()
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
      <span className="bulk-count">{t('table.selected', { n: count })}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Bulk set field */}
        {fields.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowFieldPicker(v => !v); setConfirmDel(false) }}
              disabled={isPending}
            >
              {t('table.setField')}
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
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('table.bulkDelete')}?</span>
              <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={isPending}>{t('common.delete')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>{t('common.cancel')}</button>
            </div>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => { setConfirmDel(true); setShowFieldPicker(false) }}
              disabled={isPending}
            >
              {t('table.bulkDelete')}
            </button>
          )}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={isPending}>{t('table.clear')}</button>
      </div>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function ItemsTable({ app, items, fields, workspaceId, readOnly = false, canReorder = false, relationsMap = {} }: Props) {
  const { t } = useT()
  const router = useRouter()
  const [localItems, setLocalItems] = useState<ItemRow[]>(items)
  const colorRules: ColorRule[] = (() => {
    try { return JSON.parse(app.colorRulesJson ?? '[]') } catch { return [] }
  })()
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [groupBy, setGroupBy] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [colorBy, setColorBy] = useState<string>('')
  const [summaryTypes, setSummaryTypes] = useState<Record<string, SummaryType>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(`summary-${app.id}`) ?? '{}') } catch { return {} }
  })

  function updateSummaryType(fieldId: string, type: SummaryType) {
    setSummaryTypes(prev => {
      const next = { ...prev, [fieldId]: type }
      localStorage.setItem(`summary-${app.id}`, JSON.stringify(next))
      return next
    })
  }

  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

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

  function handleDrop(targetId: string) {
    if (!dragRowId || dragRowId === targetId) { setDragOverId(null); return }
    const fromIdx = localItems.findIndex(i => i.id === dragRowId)
    const toIdx = localItems.findIndex(i => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragOverId(null); return }
    const newItems = [...localItems]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    setLocalItems(newItems)
    setDragRowId(null)
    setDragOverId(null)
    startTransition(async () => { await reorderItems(app.id, newItems.map(i => i.id)) })
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
  const showDragHandle = canReorder && !groupBy

  function renderRows(rowItems: ItemRow[]) {
    return rowItems.map((item) => {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
      const isEditingTitle = editingCell?.itemId === item.id && editingCell.fieldId === '__title__'
      const isSelected = selectedIds.has(item.id)

      // Color rules take priority over colorBy
      const ruleColor = colorRules.length > 0 ? getColorRuleMatch(item, colorRules, fields) : undefined
      let rowColor: string | undefined = ruleColor
      if (!rowColor && colorField?.type === 'category') {
        const optId = data[colorField.id]
        const opt = colorField.options?.find(o => o.id === optId)
        if (opt) rowColor = opt.color
      }

      return (
        <tr
          key={item.id}
          draggable={showDragHandle ? true : undefined}
          onDragStart={showDragHandle ? e => { e.dataTransfer.effectAllowed = 'move'; setDragRowId(item.id) } : undefined}
          onDragOver={showDragHandle ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(item.id) } : undefined}
          onDrop={showDragHandle ? e => { e.preventDefault(); handleDrop(item.id) } : undefined}
          onDragEnd={showDragHandle ? () => { setDragRowId(null); setDragOverId(null) } : undefined}
          onClick={() => { if (!readOnly && !editingCell) router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`) }}
          onContextMenu={readOnly ? undefined : e => openContextMenu(e, item)}
          className={dragOverId === item.id && dragRowId !== item.id ? 'drag-target-row' : undefined}
          style={{
            cursor: readOnly ? 'default' : editingCell ? 'default' : 'pointer',
            opacity: dragRowId === item.id ? 0.4 : 1,
            background: isSelected ? 'rgba(99,102,241,0.07)' : rowColor ? rowColor + '0d' : undefined,
            borderLeft: rowColor ? `3px solid ${rowColor}88` : undefined,
          }}
        >
          {showDragHandle && (
            <td
              className="drag-handle"
              onClick={e => e.stopPropagation()}
              title="Drag to reorder"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ display: 'block', margin: 'auto' }}>
                <circle cx="3" cy="2.5" r="1.5"/><circle cx="7" cy="2.5" r="1.5"/>
                <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
                <circle cx="3" cy="11.5" r="1.5"/><circle cx="7" cy="11.5" r="1.5"/>
              </svg>
            </td>
          )}
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
              const linked = relationsMap[item.id]?.[f.id] ?? []
              return (
                <td key={f.id} style={{ minWidth: 120 }}>
                  {linked.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {linked.map(l => (
                        <span key={l.id} style={{
                          display: 'inline-block',
                          background: 'rgba(99,102,241,0.12)',
                          color: 'var(--brand-300)',
                          border: '1px solid rgba(99,102,241,0.22)',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>{l.title}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>
                  )}
                </td>
              )
            }
            if (f.type === 'lookup' || f.type === 'rollup') {
              return (
                <td key={f.id} style={{ minWidth: 100 }} title={f.type === 'rollup' ? `${f.rollupFunction ?? 'COUNT'}` : undefined}>
                  <FieldCell value={data[f.id]} field={f} />
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

  const totalCols = (showDragHandle ? 1 : 0) + 5 + fields.length

  if (localItems.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <p className="empty-state-title">{t('table.noItems')}</p>
        <p className="empty-state-desc">{t('table.noItemsDesc')}</p>
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
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('table.groupBy')}</span>
            <select
              className="form-input form-select"
              value={groupBy}
              onChange={e => { setGroupBy(e.target.value); setCollapsedGroups(new Set()) }}
              style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 11 }}
            >
              <option value="">— {t('table.none')} —</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {groupBy && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-tertiary)' }} onClick={() => setGroupBy('')}>×</button>
            )}
          </div>
          {fields.some(f => f.type === 'category') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('table.colorBy')}</span>
              <select
                className="form-input form-select"
                value={colorBy}
                onChange={e => setColorBy(e.target.value)}
                style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 11 }}
              >
                <option value="">— {t('table.none')} —</option>
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
              {showDragHandle && <th style={{ width: 28, padding: '0 4px' }} />}
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  style={{ accentColor: 'var(--brand-500)', cursor: 'pointer', width: 14, height: 14 }}
                  title={allSelected ? t('table.clear') : t('table.selectAll')}
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
              <th>{t('table.creator')}</th>
              <th>{t('table.created')}</th>
              <th style={{ width: 90 }}>{t('detail.tabs.activity')}</th>
            </tr>
          </thead>
          <tbody onMouseDown={() => setContextMenu(null)}>
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
          {fields.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-subtle)' }}>
                {showDragHandle && <td style={{ padding: '4px 8px' }} />}
                <td style={{ padding: '4px 8px' }} />
                <td style={{ padding: '6px 12px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {localItems.length} {localItems.length === 1 ? 'record' : 'records'}
                  </span>
                </td>
                {fields.map(f => (
                  <td key={f.id} style={{ padding: '4px 8px' }}>
                    <SummaryCell
                      field={f}
                      items={localItems}
                      summaryType={summaryTypes[f.id] ?? 'none'}
                      onChange={type => updateSummaryType(f.id, type)}
                    />
                  </td>
                ))}
                <td /><td /><td />
              </tr>
            </tfoot>
          )}
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
            {t('table.openItem')}
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDuplicate(contextMenu.itemId)}
            disabled={isPending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {t('table.duplicate')}
          </button>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
          {confirmDelete === contextMenu.itemId ? (
            <div style={{ padding: '6px 10px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('table.deleteConfirm', { title: contextMenu.itemTitle.slice(0, 30) })}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-danger btn-sm" style={{ fontSize: 11, flex: 1 }} onClick={() => handleDelete(contextMenu.itemId)} disabled={isPending}>{t('common.delete')}</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <button className="context-menu-item danger" onClick={e => { e.stopPropagation(); setConfirmDelete(contextMenu.itemId) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              {t('common.delete')}…
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
        .drag-handle {
          width: 28px;
          padding: 0 6px;
          color: var(--text-disabled);
          cursor: grab;
          text-align: center;
          user-select: none;
        }
        .drag-handle:hover { color: var(--text-tertiary); }
        .drag-handle:active { cursor: grabbing; }
        .drag-target-row td { box-shadow: inset 0 2px 0 var(--brand-500); }
      `}</style>
    </>
  )
}
