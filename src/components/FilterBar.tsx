'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AppField } from '@/lib/types'
import { type FilterRule, type FilterOperator, operatorsForField } from '@/lib/filters'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  fields: AppField[]
  rules: FilterRule[]
}

function FilterValueInput({
  fieldId,
  fields,
  value,
  onChange,
}: {
  fieldId: string
  fields: AppField[]
  value: unknown
  onChange: (v: unknown) => void
}) {
  const { t } = useT()
  const field = fields.find(f => f.id === fieldId)
  if (!field) return <input className="form-input" style={{ flex: 1 }} value={String(value ?? '')} onChange={e => onChange(e.target.value)} />

  if (field.type === 'toggle') {
    return (
      <select className="form-input form-select" style={{ flex: 1 }} value={String(value ?? 'true')} onChange={e => onChange(e.target.value === 'true')}>
        <option value="true">{t('bool.yes')}</option>
        <option value="false">{t('bool.no')}</option>
      </select>
    )
  }
  if (field.type === 'category' && field.options) {
    return (
      <select className="form-input form-select" style={{ flex: 1 }} value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
        <option value="">{t('filter.select')}</option>
        {field.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    )
  }
  if (field.type === 'date') {
    return <input type="date" className="form-input" style={{ flex: 1 }} value={String(value ?? '')} onChange={e => onChange(e.target.value)} />
  }
  if (field.type === 'number') {
    return <input type="number" className="form-input" style={{ flex: 1 }} value={String(value ?? '')} onChange={e => onChange(e.target.value)} />
  }
  return <input type="text" className="form-input" style={{ flex: 1 }} value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder="Value…" />
}

export default function FilterBar({ fields, rules }: Props) {
  const { t } = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [showAdd, setShowAdd] = useState(false)
  const [newFieldId, setNewFieldId] = useState(fields[0]?.id ?? '__title__')
  const [newOp, setNewOp] = useState<FilterOperator>('contains')
  const [newValue, setNewValue] = useState<unknown>('')

  const allFields = [{ id: '__title__', name: 'Title', type: 'text' as const }, ...fields]

  const pushRules = useCallback((newRules: FilterRule[]) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newRules.length === 0) {
      params.delete('filters')
    } else {
      params.set('filters', JSON.stringify(newRules))
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  function removeRule(id: string) {
    pushRules(rules.filter(r => r.id !== id))
  }

  function clearAll() {
    pushRules([])
  }

  function addRule() {
    const ops = operatorsForField(newFieldId, fields)
    const opToUse = ops.find(o => o.value === newOp)?.value ?? ops[0].value
    const rule: FilterRule = {
      id: `r-${Date.now()}`,
      fieldId: newFieldId,
      op: opToUse,
      value: newValue,
    }
    pushRules([...rules, rule])
    setShowAdd(false)
    setNewValue('')
  }

  function getFieldName(fieldId: string): string {
    if (fieldId === '__title__') return 'Title'
    return fields.find(f => f.id === fieldId)?.name ?? fieldId
  }

  function getValueLabel(rule: FilterRule): string {
    if (rule.op === 'is_empty' || rule.op === 'is_not_empty') return ''
    const field = fields.find(f => f.id === rule.fieldId)
    if (field?.type === 'category' && field.options) {
      const opt = field.options.find(o => o.id === rule.value)
      if (opt) return opt.label
    }
    return String(rule.value ?? '')
  }

  const ops = operatorsForField(newFieldId, fields)

  return (
    <div className="filter-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
          {t('header.filter')}
        </span>
        {rules.map(rule => (
          <div key={rule.id} className="filter-chip">
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{getFieldName(rule.fieldId)}</span>
            <span style={{ color: 'var(--text-disabled)' }}>{rule.op.replace(/_/g, ' ')}</span>
            {getValueLabel(rule) && <span style={{ color: 'var(--brand-300)', fontWeight: 600 }}>{getValueLabel(rule)}</span>}
            <button
              onClick={() => removeRule(rule.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-disabled)', padding: '0 2px',
                display: 'flex', alignItems: 'center', lineHeight: 1,
                fontSize: 12,
              }}
              aria-label="Remove filter"
            >×</button>
          </div>
        ))}

        {showAdd ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Field selector */}
            <select
              className="form-input form-select"
              style={{ padding: '4px 28px 4px 8px', fontSize: 12, width: 'auto' }}
              value={newFieldId}
              onChange={e => {
                setNewFieldId(e.target.value)
                setNewOp(operatorsForField(e.target.value, fields)[0].value)
                setNewValue('')
              }}
            >
              {allFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            {/* Operator selector */}
            <select
              className="form-input form-select"
              style={{ padding: '4px 28px 4px 8px', fontSize: 12, width: 'auto' }}
              value={newOp}
              onChange={e => setNewOp(e.target.value as FilterOperator)}
            >
              {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Value */}
            {newOp !== 'is_empty' && newOp !== 'is_not_empty' && (
              <div style={{ minWidth: 120, maxWidth: 200 }}>
                <FilterValueInput
                  fieldId={newFieldId}
                  fields={fields}
                  value={newValue}
                  onChange={setNewValue}
                />
              </div>
            )}

            <button className="btn btn-primary btn-sm" onClick={addRule} style={{ fontSize: 12 }}>{t('common.save')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)} style={{ fontSize: 12 }}>{t('common.cancel')}</button>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowAdd(true)}
            style={{ fontSize: 12, gap: 4 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('filter.add')}
          </button>
        )}
      </div>

      {rules.length > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ fontSize: 12, color: 'var(--error)', flexShrink: 0 }}>
          {t('filter.clearAll')}
        </button>
      )}

      <style>{`
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
          flex-shrink: 0;
          min-height: 44px;
          flex-wrap: wrap;
        }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px 3px 10px;
          border-radius: var(--radius-full);
          font-size: 11.5px;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
