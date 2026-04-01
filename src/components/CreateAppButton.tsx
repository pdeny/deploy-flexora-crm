'use client'

import { useState, useTransition } from 'react'
import { createApp } from '@/lib/actions/workspace'
import { useT } from '@/contexts/LanguageContext'
import type { LangKey } from '@/lib/i18n/it'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
const EMOJIS = ['📋', '📊', '🗂️', '📁', '🏷️', '📝', '🔖', '📌', '🗃️', '⚙️', '🔍', '📈', '🎯', '💼', '🧩']

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

type Props = { workspaceId: string; compact?: boolean }

export default function CreateAppButton({ workspaceId, compact }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'template' | 'details'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0])
  const [isPending, startTransition] = useTransition()
  const [color, setColor] = useState(COLORS[0])
  const [emoji, setEmoji] = useState('📋')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setError(null)
    setStep('template')
    setSelectedTemplate(TEMPLATES[0])
    setColor(COLORS[0])
    setEmoji('📋')
  }

  function handleSelectTemplate(tpl: Template) {
    setSelectedTemplate(tpl)
    setColor(tpl.color)
    setEmoji(tpl.emoji)
    setStep('details')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('workspaceId', workspaceId)
    formData.set('color', color)
    formData.set('iconEmoji', emoji)
    formData.set('fieldsJson', selectedTemplate.fieldsJson)
    startTransition(async () => {
      const result = await createApp(formData)
      if (result?.error) setError(result.error)
      else handleClose()
    })
  }

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
          <div className="modal" style={{ maxWidth: step === 'template' ? 560 : 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {step === 'details' && (
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => setStep('template')}
                    title={t('common.back')}
                    style={{ marginRight: 2 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                )}
                <h2 className="modal-title">
                  {step === 'template' ? t('app.chooseTemplate') : t('app.configure')}
                </h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {step === 'template' ? (
              <div className="modal-body">
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
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Template badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: selectedTemplate.color + '15', border: `1px solid ${selectedTemplate.color}30`, borderRadius: 8 }}>
                    <span style={{ fontSize: 16 }}>{selectedTemplate.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: selectedTemplate.color }}>
                      {t(selectedTemplate.labelKey)} {t('app.tmpl.templateSuffix')}
                    </span>
                    {selectedTemplate.id !== 'blank' && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                        {t('app.fieldsPreConfigured', { n: JSON.parse(selectedTemplate.fieldsJson).length })}
                      </span>
                    )}
                  </div>

                  {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                      ⚠ {error}
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
                      id="app-name" className="form-input" name="name"
                      defaultValue={selectedTemplate.defaultName}
                      placeholder={t('app.namePlaceholder')}
                      required autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="app-desc">{t('common.description')}</label>
                    <input
                      id="app-desc" className="form-input" name="description"
                      defaultValue={selectedTemplate.id !== 'blank' ? t(selectedTemplate.descKey) : ''}
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

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={isPending}>
                    {isPending ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.creating')}</> : t('app.create')}
                  </button>
                </div>
              </form>
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
      `}</style>
    </>
  )
}
