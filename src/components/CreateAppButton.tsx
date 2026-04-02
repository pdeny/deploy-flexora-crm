'use client'

import { useState, useTransition } from 'react'
import { createApp } from '@/lib/actions/workspace'
import { useT } from '@/contexts/LanguageContext'
import type { LangKey } from '@/lib/i18n/it'
import type { FieldType, AppField, CategoryOption } from '@/lib/types'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
const EMOJIS = ['📋', '📊', '🗂️', '📁', '🏷️', '📝', '🔖', '📌', '🗃️', '⚙️', '🔍', '📈', '🎯', '💼', '🧩']
const OPTION_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#ef4444', '#6b7280']

type Template = {
  id: string
  labelKey: LangKey
  descKey: LangKey
  defaultName: string
  emoji: string
  color: string
  fieldsJson: string
}

const TEMPLATES: Template[] = [
  {
    id: 'blank',
    labelKey: 'app.tmpl.blank.name',
    descKey: 'app.blank',
    defaultName: '',
    emoji: '📋',
    color: '#6366f1',
    fieldsJson: '[]',
  },
  {
    id: 'crm',
    labelKey: 'app.tmpl.crm.name',
    descKey: 'app.tmpl.crm',
    defaultName: 'CRM',
    emoji: '🤝',
    color: '#10b981',
    fieldsJson: JSON.stringify([
      { id: 'f-stage',   name: 'Stage',    type: 'category', options: [
        { id: 'lead',       label: 'Lead',        color: '#8b5cf6' },
        { id: 'qualified',  label: 'Qualified',   color: '#06b6d4' },
        { id: 'proposal',   label: 'Proposal',    color: '#f59e0b' },
        { id: 'closed-won', label: 'Closed Won',  color: '#10b981' },
        { id: 'closed-lost',label: 'Closed Lost', color: '#ef4444' },
      ]},
      { id: 'f-value',   name: 'Value (€)', type: 'number' },
      { id: 'f-company', name: 'Company',   type: 'text' },
      { id: 'f-email',   name: 'Email',     type: 'email' },
      { id: 'f-phone',   name: 'Phone',     type: 'phone' },
      { id: 'f-close',   name: 'Close Date',type: 'date' },
    ]),
  },
  {
    id: 'project',
    labelKey: 'app.tmpl.project.name',
    descKey: 'app.tmpl.tasks',
    defaultName: 'Project Manager',
    emoji: '🚀',
    color: '#6366f1',
    fieldsJson: JSON.stringify([
      { id: 'f-status',   name: 'Status',   type: 'category', options: [
        { id: 'todo',        label: 'To Do',       color: '#6366f1' },
        { id: 'inprogress',  label: 'In Progress', color: '#f59e0b' },
        { id: 'review',      label: 'In Review',   color: '#06b6d4' },
        { id: 'done',        label: 'Done',         color: '#10b981' },
      ]},
      { id: 'f-priority', name: 'Priority', type: 'category', options: [
        { id: 'low',    label: 'Low',    color: '#10b981' },
        { id: 'medium', label: 'Medium', color: '#f59e0b' },
        { id: 'high',   label: 'High',   color: '#ef4444' },
      ]},
      { id: 'f-due',      name: 'Due Date',  type: 'date' },
      { id: 'f-assignee', name: 'Assignee',  type: 'text' },
      { id: 'f-effort',   name: 'Effort (pts)', type: 'number' },
    ]),
  },
  {
    id: 'bugs',
    labelKey: 'app.tmpl.bugs.name',
    descKey: 'app.tmpl.bugs',
    defaultName: 'Bug Tracker',
    emoji: '🐛',
    color: '#ef4444',
    fieldsJson: JSON.stringify([
      { id: 'f-severity', name: 'Severity', type: 'category', options: [
        { id: 'critical', label: 'Critical', color: '#ef4444' },
        { id: 'high',     label: 'High',     color: '#f59e0b' },
        { id: 'medium',   label: 'Medium',   color: '#06b6d4' },
        { id: 'low',      label: 'Low',      color: '#10b981' },
      ]},
      { id: 'f-status',  name: 'Status', type: 'category', options: [
        { id: 'open',     label: 'Open',     color: '#ef4444' },
        { id: 'progress', label: 'In Progress', color: '#f59e0b' },
        { id: 'fixed',    label: 'Fixed',    color: '#10b981' },
        { id: 'wontfix',  label: "Won't Fix", color: '#6b7280' },
      ]},
      { id: 'f-reporter', name: 'Reporter',  type: 'text' },
      { id: 'f-url',      name: 'Repro URL', type: 'url' },
      { id: 'f-fixed',    name: 'Verified',  type: 'toggle' },
    ]),
  },
  {
    id: 'hr',
    labelKey: 'app.tmpl.hr.name',
    descKey: 'app.tmpl.hiring',
    defaultName: 'HR Tracker',
    emoji: '👥',
    color: '#8b5cf6',
    fieldsJson: JSON.stringify([
      { id: 'f-stage', name: 'Stage', type: 'category', options: [
        { id: 'applied',    label: 'Applied',    color: '#6366f1' },
        { id: 'screening',  label: 'Screening',  color: '#8b5cf6' },
        { id: 'interview',  label: 'Interview',  color: '#f59e0b' },
        { id: 'offer',      label: 'Offer',      color: '#06b6d4' },
        { id: 'hired',      label: 'Hired',      color: '#10b981' },
        { id: 'rejected',   label: 'Rejected',   color: '#ef4444' },
      ]},
      { id: 'f-role',     name: 'Role',       type: 'text' },
      { id: 'f-email',    name: 'Email',      type: 'email' },
      { id: 'f-linkedin', name: 'LinkedIn',   type: 'url' },
      { id: 'f-salary',   name: 'Salary (€)', type: 'number' },
      { id: 'f-remote',   name: 'Remote OK',  type: 'toggle' },
    ]),
  },
  {
    id: 'content',
    labelKey: 'app.tmpl.content.name',
    descKey: 'app.tmpl.content',
    defaultName: 'Content Calendar',
    emoji: '📅',
    color: '#ec4899',
    fieldsJson: JSON.stringify([
      { id: 'f-status', name: 'Status', type: 'category', options: [
        { id: 'idea',      label: 'Idea',       color: '#6366f1' },
        { id: 'drafting',  label: 'Drafting',   color: '#f59e0b' },
        { id: 'review',    label: 'In Review',  color: '#06b6d4' },
        { id: 'scheduled', label: 'Scheduled',  color: '#8b5cf6' },
        { id: 'published', label: 'Published',  color: '#10b981' },
      ]},
      { id: 'f-channel',  name: 'Channel',     type: 'text' },
      { id: 'f-pubdate',  name: 'Publish Date',type: 'date' },
      { id: 'f-author',   name: 'Author',      type: 'text' },
      { id: 'f-url',      name: 'URL',         type: 'url' },
    ]),
  },
]

// Field type definitions for the builder sidebar
const FIELD_TYPE_DEFS: { value: FieldType; labelKey: LangKey; icon: string }[] = [
  { value: 'text',        labelKey: 'header.fieldType.text',        icon: 'A' },
  { value: 'number',      labelKey: 'header.fieldType.number',      icon: '123' },
  { value: 'date',        labelKey: 'header.fieldType.date',        icon: '📅' },
  { value: 'category',    labelKey: 'header.fieldType.category',    icon: '☰' },
  { value: 'multiselect', labelKey: 'header.fieldType.multiselect', icon: '☰' },
  { value: 'toggle',      labelKey: 'header.fieldType.toggle',      icon: '☑' },
  { value: 'email',       labelKey: 'header.fieldType.email',       icon: '✉' },
  { value: 'phone',       labelKey: 'header.fieldType.phone',       icon: '☏' },
  { value: 'url',         labelKey: 'header.fieldType.url',         icon: '🔗' },
  { value: 'image',       labelKey: 'header.fieldType.image',       icon: '🖼' },
  { value: 'rating',      labelKey: 'header.fieldType.rating',      icon: '⭐' },
  { value: 'progress',    labelKey: 'header.fieldType.progress',    icon: '▓' },
  { value: 'calculation', labelKey: 'header.fieldType.calculation', icon: 'ƒ' },
]

function genId() {
  return 'f-' + Math.random().toString(36).slice(2, 8)
}

type Props = { workspaceId: string; compact?: boolean }

export default function CreateAppButton({ workspaceId, compact }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'template' | 'details' | 'fields'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0])
  const [isPending, startTransition] = useTransition()
  const [color, setColor] = useState(COLORS[0])
  const [emoji, setEmoji] = useState('📋')
  const [error, setError] = useState<string | null>(null)

  // Fields builder state
  const [fields, setFields] = useState<AppField[]>([])
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  // Details form state (need to persist across steps)
  const [appName, setAppName] = useState('')
  const [appDesc, setAppDesc] = useState('')

  function handleClose() {
    setOpen(false)
    setError(null)
    setStep('template')
    setSelectedTemplate(TEMPLATES[0])
    setColor(COLORS[0])
    setEmoji('📋')
    setFields([])
    setExpandedFieldId(null)
    setAppName('')
    setAppDesc('')
  }

  function handleSelectTemplate(tpl: Template) {
    setSelectedTemplate(tpl)
    setColor(tpl.color)
    setEmoji(tpl.emoji)
    setFields(tpl.fieldsJson ? JSON.parse(tpl.fieldsJson) : [])
    setAppName(tpl.defaultName)
    setAppDesc(tpl.id !== 'blank' ? t(tpl.descKey) : '')
    setStep('details')
  }

  function handleDetailsNext() {
    if (!appName.trim()) return
    setStep('fields')
  }

  function handleAddField(type: FieldType) {
    const def = FIELD_TYPE_DEFS.find(d => d.value === type)
    const newField: AppField = {
      id: genId(),
      name: t(def?.labelKey ?? 'header.fieldType.text'),
      type,
      ...(type === 'category' || type === 'multiselect' ? { options: [] } : {}),
    }
    setFields(prev => [...prev, newField])
    setExpandedFieldId(newField.id)
  }

  function updateField(id: string, updates: Partial<AppField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
    if (expandedFieldId === id) setExpandedFieldId(null)
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function addOption(fieldId: string) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      const opts = f.options ?? []
      const newOpt: CategoryOption = {
        id: 'o-' + Math.random().toString(36).slice(2, 8),
        label: '',
        color: OPTION_COLORS[opts.length % OPTION_COLORS.length],
      }
      return { ...f, options: [...opts, newOpt] }
    }))
  }

  function updateOption(fieldId: string, optId: string, updates: Partial<CategoryOption>) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      return { ...f, options: (f.options ?? []).map(o => o.id === optId ? { ...o, ...updates } : o) }
    }))
  }

  function removeOption(fieldId: string, optId: string) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      return { ...f, options: (f.options ?? []).filter(o => o.id !== optId) }
    }))
  }

  function handleCreate() {
    if (!appName.trim()) return
    setError(null)
    const formData = new FormData()
    formData.set('workspaceId', workspaceId)
    formData.set('name', appName.trim())
    formData.set('description', appDesc)
    formData.set('color', color)
    formData.set('iconEmoji', emoji)
    formData.set('fieldsJson', JSON.stringify(fields))
    startTransition(async () => {
      const result = await createApp(formData)
      if (result?.error) setError(result.error)
      else handleClose()
    })
  }

  const modalWidth = step === 'template' ? 560 : step === 'details' ? 440 : 760

  return (
    <>
      {compact ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} title={t('app.new')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('app.new')}
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('app.new')}
        </button>
      )}

      {open && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleClose()}>
          <div className="modal" style={{ maxWidth: modalWidth, maxHeight: '85vh', display: 'flex', flexDirection: 'column', transition: 'max-width 200ms ease' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {step !== 'template' && (
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => setStep(step === 'fields' ? 'details' : 'template')}
                    title={t('common.back')}
                    style={{ marginRight: 2 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                )}
                <h2 className="modal-title">
                  {step === 'template' ? t('app.chooseTemplate') : step === 'details' ? t('app.configure') : t('app.builder.title')}
                </h2>
              </div>
              {/* Step indicator */}
              {step !== 'template' && (
                <div className="cab-steps">
                  <span className={`cab-step ${step === 'details' ? 'active' : 'done'}`}>1</span>
                  <span className="cab-step-line" />
                  <span className={`cab-step ${step === 'fields' ? 'active' : ''}`}>2</span>
                </div>
              )}
              <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {step === 'template' && (
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                <div className="template-grid">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      className="template-card"
                      onClick={() => handleSelectTemplate(tpl)}
                      style={{ '--tpl-color': tpl.color } as React.CSSProperties}
                    >
                      <div className="template-emoji" style={{ background: tpl.color + '20', border: `1px solid ${tpl.color}33` }}>
                        {tpl.emoji}
                      </div>
                      <div className="template-label">{t(tpl.labelKey)}</div>
                      <div className="template-desc">{t(tpl.descKey)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'details' && (
              <>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>
                  {/* Template badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: selectedTemplate.color + '15', border: `1px solid ${selectedTemplate.color}30`, borderRadius: 8 }}>
                    <span style={{ fontSize: 16 }}>{selectedTemplate.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: selectedTemplate.color }}>
                      {t(selectedTemplate.labelKey)} {t('app.tmpl.templateSuffix')}
                    </span>
                  </div>

                  {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                      {error}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">{t('common.icon')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {EMOJIS.map(e => (
                        <button key={e} type="button" onClick={() => setEmoji(e)} style={{
                          fontSize: 17, width: 34, height: 34, borderRadius: 7, cursor: 'pointer',
                          background: emoji === e ? 'rgba(99,102,241,0.2)' : 'var(--bg-elevated)',
                          border: emoji === e ? '2px solid var(--brand-500)' : '1px solid var(--border-subtle)',
                          transition: 'all 120ms',
                        }}>{e}</button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="app-name">{t('common.name')} <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      id="app-name" className="form-input"
                      value={appName}
                      onChange={e => setAppName(e.target.value)}
                      placeholder={t('app.namePlaceholder')}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="app-desc">{t('common.description')}</label>
                    <input
                      id="app-desc" className="form-input"
                      value={appDesc}
                      onChange={e => setAppDesc(e.target.value)}
                      placeholder={t('app.descPlaceholder')}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('common.color')}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)} style={{
                          width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: color === c ? '3px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                          boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                          transition: 'all 120ms',
                        }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ flexShrink: 0 }}>
                  <button type="button" className="btn btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
                  <button type="button" className="btn btn-primary" onClick={handleDetailsNext} disabled={!appName.trim()}>
                    {t('app.builder.next')}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 4 }}>
                      <polyline points="9 6 15 12 9 18"/>
                    </svg>
                  </button>
                </div>
              </>
            )}

            {step === 'fields' && (
              <>
                <div className="cab-builder">
                  {/* Sidebar — field types palette */}
                  <div className="cab-sidebar">
                    <div className="cab-sidebar-title">{t('app.builder.fieldTypes')}</div>
                    <div className="cab-type-list">
                      {FIELD_TYPE_DEFS.map(ft => (
                        <button
                          key={ft.value}
                          className="cab-type-btn"
                          onClick={() => handleAddField(ft.value)}
                        >
                          <span className="cab-type-icon">{ft.icon}</span>
                          <span>{t(ft.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main area — configured fields */}
                  <div className="cab-main">
                    {error && (
                      <div style={{ margin: '0 0 12px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                        {error}
                      </div>
                    )}

                    {fields.length === 0 ? (
                      <div className="cab-empty">
                        <div style={{ fontSize: 32, opacity: 0.3 }}>+</div>
                        <p>{t('app.builder.emptyHint')}</p>
                      </div>
                    ) : (
                      <div className="cab-field-list">
                        {fields.map((field, idx) => {
                          const ftDef = FIELD_TYPE_DEFS.find(d => d.value === field.type)
                          const isExpanded = expandedFieldId === field.id
                          const hasOptions = field.type === 'category' || field.type === 'multiselect'

                          return (
                            <div key={field.id} className={`cab-field-card ${isExpanded ? 'expanded' : ''}`}>
                              {/* Field header row */}
                              <div className="cab-field-header" onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}>
                                <span className="cab-field-icon">{ftDef?.icon ?? '?'}</span>
                                <span className="cab-field-drag">
                                  <button className="cab-move-btn" title="Move up" onClick={e => { e.stopPropagation(); moveField(idx, -1) }} disabled={idx === 0}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                                  </button>
                                  <button className="cab-move-btn" title="Move down" onClick={e => { e.stopPropagation(); moveField(idx, 1) }} disabled={idx === fields.length - 1}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                                  </button>
                                </span>
                                <input
                                  className="cab-field-name-input"
                                  value={field.name}
                                  onChange={e => updateField(field.id, { name: e.target.value })}
                                  onClick={e => e.stopPropagation()}
                                  placeholder={t('app.builder.fieldNamePlaceholder')}
                                />
                                <span className="cab-field-type-badge">{t(ftDef?.labelKey ?? 'header.fieldType.text')}</span>
                                <button
                                  className="cab-field-remove"
                                  onClick={e => { e.stopPropagation(); removeField(field.id) }}
                                  title={t('common.delete')}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>

                              {/* Expanded config */}
                              {isExpanded && (
                                <div className="cab-field-config">
                                  {/* Required toggle */}
                                  <label className="cab-toggle-row">
                                    <input
                                      type="checkbox"
                                      checked={!!field.required}
                                      onChange={e => updateField(field.id, { required: e.target.checked })}
                                    />
                                    <span>{t('common.required')}</span>
                                  </label>

                                  {/* Description */}
                                  <input
                                    className="form-input"
                                    value={field.description ?? ''}
                                    onChange={e => updateField(field.id, { description: e.target.value })}
                                    placeholder={t('app.builder.fieldDescPlaceholder')}
                                    style={{ fontSize: 12 }}
                                  />

                                  {/* Category/Multiselect options */}
                                  {hasOptions && (
                                    <div className="cab-options-section">
                                      <div className="cab-options-label">{t('app.builder.options')}</div>
                                      {(field.options ?? []).map(opt => (
                                        <div key={opt.id} className="cab-option-row">
                                          <input
                                            type="color"
                                            value={opt.color}
                                            onChange={e => updateOption(field.id, opt.id, { color: e.target.value })}
                                            className="cab-option-color"
                                          />
                                          <input
                                            className="form-input cab-option-input"
                                            value={opt.label}
                                            onChange={e => updateOption(field.id, opt.id, { label: e.target.value })}
                                            placeholder={t('app.builder.optionPlaceholder')}
                                          />
                                          <button className="cab-field-remove" onClick={() => removeOption(field.id, opt.id)}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                      <button className="cab-add-option" onClick={() => addOption(field.id)}>
                                        + {t('app.builder.addOption')}
                                      </button>
                                    </div>
                                  )}

                                  {/* Calculation formula */}
                                  {field.type === 'calculation' && (
                                    <div>
                                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('header.formula')}</div>
                                      <input
                                        className="form-input"
                                        value={field.calcFormula ?? ''}
                                        onChange={e => updateField(field.id, { calcFormula: e.target.value })}
                                        placeholder="e.g. {f-price} * {f-qty}"
                                        style={{ fontSize: 12, fontFamily: 'monospace' }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer" style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t('app.builder.fieldCount', { n: fields.length })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setStep('details')}>{t('common.back')}</button>
                    <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isPending}>
                      {isPending ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.creating')}</> : t('app.create')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .template-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .template-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          padding: 14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all var(--transition-fast);
        }
        .template-card:hover {
          border-color: var(--tpl-color, var(--brand-500));
          background: var(--bg-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .template-emoji {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        }
        .template-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .template-desc {
          font-size: 11px;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        /* Step indicator */
        .cab-steps {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cab-step {
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          background: var(--bg-elevated);
          color: var(--text-tertiary);
          border: 1px solid var(--border-default);
        }
        .cab-step.active {
          background: var(--brand-500);
          color: #fff;
          border-color: var(--brand-500);
        }
        .cab-step.done {
          background: var(--accent-emerald);
          color: #fff;
          border-color: var(--accent-emerald);
        }
        .cab-step-line {
          width: 20px;
          height: 2px;
          background: var(--border-default);
        }

        /* Builder layout */
        .cab-builder {
          display: flex;
          min-height: 380px;
          max-height: 60vh;
        }
        .cab-sidebar {
          width: 190px;
          flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          padding: 14px;
          overflow-y: auto;
        }
        .cab-sidebar-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .cab-type-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cab-type-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          color: var(--text-primary);
          transition: background var(--transition-fast);
          text-align: left;
        }
        .cab-type-btn:hover {
          background: var(--bg-hover);
        }
        .cab-type-icon {
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        /* Main area */
        .cab-main {
          flex: 1;
          padding: 14px;
          overflow-y: auto;
        }
        .cab-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 8px;
          color: var(--text-disabled);
          font-size: 13px;
          text-align: center;
          padding: 40px;
        }
        .cab-field-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cab-field-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }
        .cab-field-card.expanded {
          border-color: var(--brand-500);
        }
        .cab-field-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .cab-field-header:hover {
          background: var(--bg-hover);
        }
        .cab-field-icon {
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        .cab-field-drag {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex-shrink: 0;
        }
        .cab-move-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px; height: 12px;
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          border-radius: 3px;
          padding: 0;
        }
        .cab-move-btn:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-elevated); }
        .cab-move-btn:disabled { opacity: 0.2; cursor: default; }
        .cab-field-name-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          color: var(--text-primary);
          min-width: 0;
        }
        .cab-field-name-input::placeholder { color: var(--text-disabled); }
        .cab-field-type-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 9999px;
          background: var(--bg-elevated);
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }
        .cab-field-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          background: none;
          border: none;
          color: var(--text-disabled);
          cursor: pointer;
          border-radius: 4px;
          flex-shrink: 0;
          padding: 0;
          transition: all var(--transition-fast);
        }
        .cab-field-remove:hover {
          background: rgba(239,68,68,0.1);
          color: #f87171;
        }
        .cab-field-config {
          padding: 10px 12px 14px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: var(--bg-elevated);
        }
        .cab-toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          user-select: none;
        }
        .cab-toggle-row input {
          width: 13px; height: 13px;
          accent-color: var(--brand-500);
          cursor: pointer;
        }
        .cab-options-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cab-options-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .cab-option-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cab-option-color {
          width: 24px; height: 24px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
          background: none;
          flex-shrink: 0;
        }
        .cab-option-input {
          flex: 1;
          font-size: 12px !important;
          padding: 5px 8px !important;
        }
        .cab-add-option {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          background: none;
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-tertiary);
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          align-self: flex-start;
        }
        .cab-add-option:hover {
          border-color: var(--brand-500);
          color: var(--brand-400);
        }
      `}</style>
    </>
  )
}
