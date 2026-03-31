'use client'

import { useState, useTransition } from 'react'
import { updateAppFields, createItem } from '@/lib/actions/workspace'
import type { AppField, FieldType, CategoryOption } from '@/lib/types'

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text',     label: 'Text',     icon: 'T' },
  { value: 'number',   label: 'Number',   icon: '#' },
  { value: 'date',     label: 'Date',     icon: '📅' },
  { value: 'category', label: 'Category', icon: '🏷' },
  { value: 'email',    label: 'Email',    icon: '✉' },
  { value: 'url',      label: 'URL',      icon: '🔗' },
  { value: 'phone',    label: 'Phone',    icon: '📞' },
  { value: 'toggle',   label: 'Toggle',   icon: '☑' },
]

const OPTION_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#06b6d4','#3b82f6']

type AppSnap = {
  id: string
  name: string
  iconEmoji: string
  color: string
}

type Props = {
  app: AppSnap
  workspaceId: string
  fields: AppField[]
  userId: string
}

export default function AppHeader({ app, workspaceId, fields: initialFields }: Props) {
  const [showFields, setShowFields]   = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [fields, setFields]           = useState<AppField[]>(initialFields)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newOptions, setNewOptions]   = useState<CategoryOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [itemData, setItemData]       = useState<Record<string, unknown>>({})
  const [itemError, setItemError]     = useState<string | null>(null)
  const [isPendingFields, startFields] = useTransition()
  const [isPendingItem, startItem]     = useTransition()

  // ---- Field management ----
  function addOption() {
    if (!newOptionLabel.trim()) return
    const color = OPTION_COLORS[newOptions.length % OPTION_COLORS.length]
    setNewOptions(prev => [...prev, { id: `opt-${Date.now()}`, label: newOptionLabel.trim(), color }])
    setNewOptionLabel('')
  }

  function addField() {
    if (!newFieldName.trim()) return
    const f: AppField = {
      id: `f-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      ...(newFieldType === 'category' ? { options: newOptions } : {}),
    }
    setFields(prev => [...prev, f])
    setNewFieldName('')
    setNewFieldType('text')
    setNewOptions([])
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function saveFields() {
    startFields(async () => {
      const result = await updateAppFields(app.id, JSON.stringify(fields))
      if (!result?.error) setShowFields(false)
    })
  }

  function cancelFields() {
    setFields(initialFields)
    setShowFields(false)
  }

  // ---- Add item ----
  function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setItemError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('appId', app.id)
    fd.set('dataJson', JSON.stringify(itemData))
    startItem(async () => {
      const result = await createItem(fd)
      if (result?.error) setItemError(result.error)
      else { setShowAddItem(false); setItemData({}) }
    })
  }

  return (
    <>
      <div className="app-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 24, width: 40, height: 40, background: `${app.color}18`,
            border: `1px solid ${app.color}33`, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{app.iconEmoji}</span>
          <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px' }}>{app.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFields(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
            Fields
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* ── Manage Fields Modal ── */}
      {showFields && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && cancelFields()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Manage Fields</h2>
              <button className="btn btn-ghost btn-icon" onClick={cancelFields}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Existing fields list */}
              <div>
                <div className="fields-section-label">Current Fields</div>
                {fields.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>No custom fields yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fields.map(f => (
                      <div key={f.id} className="field-row-item">
                        <span className="field-type-chip">{f.type}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.name}</span>
                        {f.options && f.options.length > 0 && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {f.options.slice(0, 4).map(o => (
                              <span key={o.id} style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: o.color + '22', color: o.color }}>{o.label}</span>
                            ))}
                          </div>
                        )}
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => removeField(f.id)}
                          style={{ color: 'var(--error)', opacity: 0.7 }}
                          title="Remove field"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new field */}
              <div className="add-field-panel">
                <div className="fields-section-label">Add Field</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px auto', gap: 10 }}>
                  <input
                    className="form-input"
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    placeholder="Field name"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), newFieldName.trim() && addField())}
                  />
                  <select
                    className="form-input form-select"
                    value={newFieldType}
                    onChange={e => { setNewFieldType(e.target.value as FieldType); setNewOptions([]) }}
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                  <button className="btn btn-secondary" onClick={addField} disabled={!newFieldName.trim()}>Add</button>
                </div>

                {newFieldType === 'category' && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Options</div>
                    {newOptions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                        {newOptions.map(o => (
                          <span key={o.id} style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: o.color + '22', color: o.color, border: `1px solid ${o.color}44` }}>
                            {o.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        value={newOptionLabel}
                        onChange={e => setNewOptionLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                        placeholder="Option label"
                        style={{ maxWidth: 220 }}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={addOption} disabled={!newOptionLabel.trim()}>+ Add option</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelFields}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFields} disabled={isPendingFields}>
                {isPendingFields ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : 'Save Fields'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ── */}
      {showAddItem && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Item</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddItem(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {itemError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                    <span>⚠</span> {itemError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Title <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input className="form-input" name="title" placeholder="Item title" required autoFocus />
                </div>
                {fields.map(f => (
                  <div key={f.id} className="form-group">
                    <label className="form-label">{f.name}</label>
                    <ItemFieldInput field={f} onChange={v => setItemData(d => ({ ...d, [f.id]: v }))} />
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItem(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPendingItem}>
                  {isPendingItem ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Adding…</> : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .app-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          flex-shrink: 0;
          gap: 16px;
          min-height: 58px;
        }
        .fields-section-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 10px;
        }
        .field-row-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          transition: border-color var(--transition-fast);
        }
        .field-row-item:hover { border-color: var(--border-default); }
        .add-field-panel {
          padding: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }
      `}</style>
    </>
  )
}

function ItemFieldInput({ field, onChange }: { field: AppField; onChange: (v: unknown) => void }) {
  if (field.type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" onChange={e => onChange(e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Enabled</span>
      </label>
    )
  }
  if (field.type === 'category' && field.options) {
    return (
      <select className="form-input form-select" defaultValue="" onChange={e => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    )
  }
  const typeMap: Partial<Record<FieldType, string>> = { date: 'date', number: 'number', email: 'email', url: 'url', phone: 'tel' }
  return (
    <input
      type={typeMap[field.type] ?? 'text'}
      className="form-input"
      onChange={e => onChange(e.target.value)}
      placeholder={field.name}
    />
  )
}
