'use client'

import React, { useState, useTransition } from 'react'
import type { AppField, ColorRule, ColorRuleCondition } from '@/lib/types'
import { operatorsForField } from '@/lib/filters'
import { saveColorRules } from '@/lib/actions/workspace'

const RULE_COLORS = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#6b7280', name: 'Gray' },
]

/** Build condition value input based on field type + operator */
function ConditionValueInput({
  condition,
  field,
  onChange,
}: {
  condition: ColorRuleCondition
  field?: AppField
  onChange: (value: unknown) => void
}) {
  if (condition.op === 'is_empty' || condition.op === 'is_not_empty') return null

  if (field?.type === 'toggle') {
    return (
      <select
        className="form-input form-select"
        value={String(condition.value ?? 'true')}
        onChange={e => onChange(e.target.value === 'true')}
        style={{ minWidth: 90, fontSize: 12 }}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (field?.type === 'category' && field.options) {
    return (
      <select
        className="form-input form-select"
        value={String(condition.value ?? '')}
        onChange={e => onChange(e.target.value)}
        style={{ minWidth: 110, fontSize: 12 }}
      >
        <option value="">— choose —</option>
        {field.options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    )
  }

  const isNumeric = field?.type === 'number' || field?.type === 'rating' || field?.type === 'progress'
  const isDate = field?.type === 'date'

  return (
    <input
      className="form-input"
      type={isNumeric ? 'number' : isDate ? 'date' : 'text'}
      value={String(condition.value ?? '')}
      onChange={e => onChange(isNumeric ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      placeholder="value"
      style={{ minWidth: 110, fontSize: 12 }}
    />
  )
}

export default function ColorRulesModal({
  appId,
  fields,
  initialRules,
  onClose,
}: {
  appId: string
  fields: AppField[]
  initialRules: ColorRule[]
  onClose: () => void
}) {
  const [rules, setRules] = useState<ColorRule[]>(initialRules)
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(
    initialRules.length === 0 ? null : initialRules[0].id
  )

  const conditionFields: { id: string; name: string; type: AppField['type'] }[] = [
    { id: '__title__', name: 'Title', type: 'text' },
    ...fields.filter(f => !['lookup', 'rollup', 'relation', 'calculation', 'image'].includes(f.type)),
  ]

  function addRule() {
    const id = `cr-${Date.now()}`
    const newRule: ColorRule = {
      id,
      name: `Rule ${rules.length + 1}`,
      color: RULE_COLORS[rules.length % RULE_COLORS.length].hex,
      conditions: [],
    }
    setRules(prev => [...prev, newRule])
    setExpandedId(id)
  }

  function updateRule(id: string, patch: Partial<ColorRule>) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function addCondition(ruleId: string) {
    const defaultField = conditionFields[0]
    if (!defaultField) return
    const allFields = fields.filter(f => !['lookup', 'rollup', 'relation', 'calculation', 'image'].includes(f.type))
    const ops = operatorsForField(defaultField.id === '__title__' ? '__title__' : defaultField.id, [
      { id: '__title__', name: 'Title', type: 'text', required: false },
      ...allFields,
    ])
    const newCond: ColorRuleCondition = {
      fieldId: defaultField.id,
      op: ops[0]?.value ?? 'contains',
      value: '',
    }
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, conditions: [...r.conditions, newCond] } : r))
  }

  function updateCondition(ruleId: string, idx: number, patch: Partial<ColorRuleCondition>) {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r
      const conds = r.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c)
      return { ...r, conditions: conds }
    }))
  }

  function removeCondition(ruleId: string, idx: number) {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, conditions: r.conditions.filter((_, i) => i !== idx) } : r
    ))
  }

  function save() {
    startTransition(async () => {
      await saveColorRules(appId, JSON.stringify(rules))
      onClose()
    })
  }

  const allFields: AppField[] = [
    { id: '__title__', name: 'Title', type: 'text' },
    ...fields.filter(f => !['lookup', 'rollup', 'relation', 'calculation', 'image'].includes(f.type)),
  ]

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600, width: '95vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Color Rules</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Rows are colored by the first matching rule (top → bottom).
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No rules yet. Add a rule to start color-coding rows.
            </div>
          )}

          {rules.map((rule, ruleIdx) => {
            const isExpanded = expandedId === rule.id
            return (
              <div key={rule.id} style={{
                border: `1px solid ${isExpanded ? rule.color + '55' : 'var(--border-subtle)'}`,
                borderRadius: 10,
                overflow: 'hidden',
                transition: 'border-color 200ms',
              }}>
                {/* Rule header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: isExpanded ? rule.color + '0a' : 'var(--bg-surface)',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: rule.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>
                    {rule.name || 'Unnamed rule'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {rule.conditions.length === 0 ? 'always' : `${rule.conditions.length} condition${rule.conditions.length > 1 ? 's' : ''}`}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600 }}>#{ruleIdx + 1}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteRule(rule.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: '2px 4px', borderRadius: 4, fontSize: 14, lineHeight: 1 }}
                    title="Delete rule"
                  >×</button>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* Rule body */}
                {isExpanded && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Name + Color */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Rule name</div>
                        <input
                          className="form-input"
                          value={rule.name}
                          onChange={e => updateRule(rule.id, { name: e.target.value })}
                          placeholder="e.g. High priority"
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Color</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                          {RULE_COLORS.map(c => (
                            <button
                              key={c.hex}
                              title={c.name}
                              onClick={() => updateRule(rule.id, { color: c.hex })}
                              style={{
                                width: 22, height: 22, borderRadius: 5, background: c.hex, border: 'none',
                                cursor: 'pointer', outline: rule.color === c.hex ? `3px solid ${c.hex}` : '2px solid transparent',
                                outlineOffset: rule.color === c.hex ? 1 : 0,
                                transition: 'outline 100ms',
                              }}
                            />
                          ))}
                          <input
                            type="color"
                            value={rule.color}
                            onChange={e => updateRule(rule.id, { color: e.target.value })}
                            title="Custom color"
                            style={{ width: 22, height: 22, borderRadius: 5, padding: 1, border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-overlay)' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: rule.color + '12',
                      borderLeft: `4px solid ${rule.color}`,
                      fontSize: 12, color: 'var(--text-secondary)',
                    }}>
                      Preview — matching rows will look like this
                    </div>

                    {/* Conditions */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Conditions{rule.conditions.length === 0 && <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}> — leave empty to match all rows</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {rule.conditions.map((cond, idx) => {
                          const condField = allFields.find(f => f.id === cond.fieldId)
                          const ops = operatorsForField(cond.fieldId, allFields)
                          const needsValue = cond.op !== 'is_empty' && cond.op !== 'is_not_empty'
                          return (
                            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              {idx > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-disabled)', minWidth: 24, textAlign: 'center' }}>AND</span>}
                              {idx === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-disabled)', minWidth: 24, textAlign: 'center' }}>IF</span>}
                              <select
                                className="form-input form-select"
                                value={cond.fieldId}
                                onChange={e => {
                                  const newOps = operatorsForField(e.target.value, allFields)
                                  updateCondition(rule.id, idx, { fieldId: e.target.value, op: newOps[0]?.value ?? 'contains', value: '' })
                                }}
                                style={{ fontSize: 12, minWidth: 110 }}
                              >
                                {allFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                              </select>
                              <select
                                className="form-input form-select"
                                value={cond.op}
                                onChange={e => updateCondition(rule.id, idx, { op: e.target.value, value: '' })}
                                style={{ fontSize: 12, minWidth: 90 }}
                              >
                                {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              {needsValue && (
                                <ConditionValueInput
                                  condition={cond}
                                  field={condField}
                                  onChange={v => updateCondition(rule.id, idx, { value: v })}
                                />
                              )}
                              <button
                                onClick={() => removeCondition(rule.id, idx)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: '3px 6px', borderRadius: 4, fontSize: 13, flexShrink: 0 }}
                                title="Remove condition"
                              >×</button>
                            </div>
                          )
                        })}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => addCondition(rule.id)}
                          style={{ alignSelf: 'flex-start', fontSize: 11, marginTop: 2 }}
                          disabled={conditionFields.length === 0}
                        >
                          + Add condition
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button className="btn btn-secondary btn-sm" onClick={addRule} style={{ alignSelf: 'flex-start' }}>
            + Add rule
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={isPending}>
            {isPending ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : 'Save Rules'}
          </button>
        </div>
      </div>
    </div>
  )
}
