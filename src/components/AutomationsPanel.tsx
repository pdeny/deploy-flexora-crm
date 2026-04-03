'use client'

import React, { useState, useTransition } from 'react'
import type { AutomationTrigger, AutomationAction, AutomationCondition, AppField } from '@/lib/types'
import { createAutomation, updateAutomation, deleteAutomation, testWebhook } from '@/lib/actions/automations'
import { operatorsForField } from '@/lib/filters'
import { useT } from '@/contexts/LanguageContext'

type AutomationRow = {
  id: string
  name: string
  isActive: boolean
  triggerJson: string
  actionsJson: string
  createdAt: Date
}

type WorkspaceApp = {
  id: string
  name: string
  iconEmoji: string
  fields: AppField[]
}

type Props = {
  appId: string
  workspaceId: string
  automations: AutomationRow[]
  fields: AppField[]
  workspaceApps?: WorkspaceApp[]
}

type View = { mode: 'list' } | { mode: 'builder'; editingId?: string }

// ── Trigger icons ────────────────────────────────────────────────────────────

const TRIGGER_ICONS: Record<AutomationTrigger['type'], React.ReactNode> = {
  item_created: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  item_updated: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  comment_added: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  scheduled: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
}

// ── Action icons ─────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<AutomationAction['type'], React.ReactNode> = {
  create_task: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  add_comment: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  create_item: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  update_item: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  notify: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  webhook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  send_email: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
}

// ── Workflow Builder ──────────────────────────────────────────────────────────

function WorkflowBuilder({
  appId,
  fields,
  workspaceApps,
  initial,
  editingId,
  onDone,
}: {
  appId: string
  fields: AppField[]
  workspaceApps: WorkspaceApp[]
  initial?: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] }
  editingId?: string
  onDone: () => void
}) {
  const { t } = useT()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState(initial?.name ?? '')
  const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>(initial?.trigger?.type ?? 'item_created')
  const [conditions, setConditions] = useState<AutomationCondition[]>(initial?.trigger?.conditions ?? [])
  const [actions, setActions] = useState<AutomationAction[]>(initial?.actions ?? [])

  const TRIGGER_TYPES: AutomationTrigger['type'][] = ['item_created', 'item_updated', 'comment_added', 'scheduled']

  const ACTION_TYPES: { type: AutomationAction['type']; disabled?: boolean }[] = [
    { type: 'create_task' },
    { type: 'add_comment' },
    { type: 'create_item' },
    { type: 'update_item' },
    { type: 'notify' },
    { type: 'webhook' },
  ]

  const TRIGGER_LABELS: Record<AutomationTrigger['type'], string> = {
    item_created: t('auto.trigger.item_created'),
    item_updated: t('auto.trigger.item_updated'),
    comment_added: t('auto.trigger.comment_added'),
    scheduled: t('auto.trigger.scheduled'),
  }

  const ACTION_LABELS: Record<AutomationAction['type'], string> = {
    notify: t('auto.action.notify'),
    webhook: t('auto.action.webhook'),
    send_email: t('auto.action.send_email'),
    create_item: t('auto.action.create_item'),
    create_task: t('auto.action.create_task'),
    add_comment: t('auto.action.add_comment'),
    update_item: t('auto.action.update_item'),
  }

  // Filterable fields (exclude computed types)
  const filterableFields: { id: string; name: string }[] = [
    { id: '__title__', name: 'Title' },
    ...fields.filter(f => !['calculation', 'lookup', 'rollup', 'image', 'relation'].includes(f.type)),
  ]

  function addCondition() {
    setConditions(c => [...c, { fieldId: '', operator: '', value: '' }])
  }

  function updateCondition(idx: number, patch: Partial<AutomationCondition>) {
    setConditions(c => c.map((cond, i) => i === idx ? { ...cond, ...patch } : cond))
  }

  function removeCondition(idx: number) {
    setConditions(c => c.filter((_, i) => i !== idx))
  }

  function addAction(type: AutomationAction['type']) {
    setActions(a => [...a, { type, config: {} }])
  }

  function updateActionConfig(idx: number, key: string, value: unknown) {
    setActions(a => a.map((act, i) =>
      i === idx ? { ...act, config: { ...act.config, [key]: value } } : act
    ))
  }

  function removeAction(idx: number) {
    setActions(a => a.filter((_, i) => i !== idx))
  }

  function handleSave() {
    if (!name.trim()) { setError(t('auto.nameRequired')); return }
    if (actions.length === 0) { setError('Add at least one action'); return }
    setError('')

    const trigger: AutomationTrigger = {
      type: triggerType,
      conditions: conditions.filter(c => c.fieldId && c.operator),
    }

    startTransition(async () => {
      const result = editingId
        ? await updateAutomation(editingId, { name, trigger, actions })
        : await createAutomation(appId, { name, trigger, actions })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      onDone()
    })
  }

  return (
    <div className="wf-builder">
      {/* Step 1: Trigger */}
      <div className="wf-step">
        <div className="wf-step-header">
          <div className="wf-step-number">1</div>
          <div>
            <div className="wf-step-title">{t('auto.builder.step1')}</div>
            <div className="wf-step-subtitle">{t('auto.builder.step1Desc')}</div>
          </div>
        </div>
        <div className="wf-step-body">
          <div className="wf-trigger-grid">
            {TRIGGER_TYPES.map(type => (
              <button
                key={type}
                className={`wf-trigger-card${triggerType === type ? ' selected' : ''}${type === 'scheduled' ? ' disabled' : ''}`}
                onClick={() => type !== 'scheduled' && setTriggerType(type)}
                disabled={type === 'scheduled'}
              >
                <div className="wf-trigger-icon">{TRIGGER_ICONS[type]}</div>
                <div className="wf-trigger-label">{TRIGGER_LABELS[type]}</div>
                {type === 'scheduled' && <span className="wf-badge-soon">{t('auto.builder.comingSoon')}</span>}
              </button>
            ))}
          </div>
          {triggerType !== 'scheduled' && (
            <div className="wf-trigger-desc">
              {t(`auto.builder.triggerDesc.${triggerType}` as keyof typeof t)}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Conditions */}
      <div className="wf-step">
        <div className="wf-step-header">
          <div className="wf-step-number">2</div>
          <div>
            <div className="wf-step-title">{t('auto.builder.step2')}</div>
            <div className="wf-step-subtitle">{t('auto.builder.step2Desc')}</div>
          </div>
        </div>
        <div className="wf-step-body">
          {conditions.length === 0 && (
            <p className="wf-muted">{t('auto.builder.noConditions')}</p>
          )}
          {conditions.map((cond, idx) => {
            const ops = cond.fieldId ? operatorsForField(cond.fieldId, [{ id: '__title__', name: 'Title', type: 'text' }, ...fields]) : []
            const selectedField = fields.find(f => f.id === cond.fieldId)
            return (
              <div key={idx} className="wf-condition-row">
                <select
                  className="form-input wf-cond-select"
                  value={cond.fieldId}
                  onChange={e => updateCondition(idx, { fieldId: e.target.value, operator: '', value: '' })}
                >
                  <option value="">{t('auto.builder.selectField')}</option>
                  {filterableFields.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

                <select
                  className="form-input wf-cond-select"
                  value={cond.operator}
                  onChange={e => updateCondition(idx, { operator: e.target.value })}
                  disabled={!cond.fieldId}
                >
                  <option value="">{t('auto.builder.selectOp')}</option>
                  {ops.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                {cond.operator && cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' && (
                  selectedField?.type === 'category' || selectedField?.type === 'multiselect'
                    ? (
                      <select
                        className="form-input wf-cond-value"
                        value={String(cond.value ?? '')}
                        onChange={e => updateCondition(idx, { value: e.target.value })}
                      >
                        <option value="">{t('auto.builder.value')}</option>
                        {selectedField.options?.map(opt => (
                          <option key={opt.id} value={opt.label}>{opt.label}</option>
                        ))}
                      </select>
                    )
                    : selectedField?.type === 'toggle'
                      ? (
                        <select
                          className="form-input wf-cond-value"
                          value={String(cond.value ?? '')}
                          onChange={e => updateCondition(idx, { value: e.target.value })}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      )
                      : (
                        <input
                          className="form-input wf-cond-value"
                          type={selectedField?.type === 'number' || selectedField?.type === 'rating' || selectedField?.type === 'progress' ? 'number' : selectedField?.type === 'date' ? 'date' : 'text'}
                          placeholder={t('auto.builder.value')}
                          value={String(cond.value ?? '')}
                          onChange={e => updateCondition(idx, { value: e.target.value })}
                        />
                      )
                )}

                <button className="wf-cond-remove" onClick={() => removeCondition(idx)} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}
          <button className="btn btn-secondary btn-sm" onClick={addCondition} style={{ marginTop: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('auto.builder.addCondition')}
          </button>
        </div>
      </div>

      {/* Step 3: Actions */}
      <div className="wf-step">
        <div className="wf-step-header">
          <div className="wf-step-number">3</div>
          <div>
            <div className="wf-step-title">{t('auto.builder.step3')}</div>
            <div className="wf-step-subtitle">{t('auto.builder.step3Desc')}</div>
          </div>
        </div>
        <div className="wf-step-body">
          {/* Available action types as cards */}
          <div className="wf-action-grid">
            {ACTION_TYPES.map(({ type, disabled }) => (
              <button
                key={type}
                className={`wf-action-card${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && addAction(type)}
                disabled={disabled}
              >
                <div className="wf-action-icon">{ACTION_ICONS[type]}</div>
                <div className="wf-action-label">{ACTION_LABELS[type]}</div>
              </button>
            ))}
          </div>

          {/* Added actions */}
          {actions.length > 0 && (
            <div className="wf-actions-list">
              {actions.map((action, idx) => (
                <div key={idx} className="wf-action-item">
                  <div className="wf-action-item-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="wf-action-item-icon">{ACTION_ICONS[action.type]}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{ACTION_LABELS[action.type]}</span>
                    </div>
                    <button className="wf-cond-remove" onClick={() => removeAction(idx)} title="Remove">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  {/* Action config forms */}
                  <div className="wf-action-config">
                    {action.type === 'create_task' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">{t('auto.builder.taskTitle')}</label>
                          <input className="form-input" value={String(action.config.title ?? '')}
                            onChange={e => updateActionConfig(idx, 'title', e.target.value)}
                            placeholder={t('auto.builder.taskTitle')} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('auto.builder.taskPriority')}</label>
                          <select className="form-input" value={String(action.config.priority ?? 'medium')}
                            onChange={e => updateActionConfig(idx, 'priority', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'add_comment' && (
                      <div className="form-group">
                        <label className="form-label">{t('auto.builder.commentContent')}</label>
                        <textarea className="form-input" rows={2}
                          value={String(action.config.content ?? '')}
                          onChange={e => updateActionConfig(idx, 'content', e.target.value)}
                          placeholder={t('auto.builder.commentContent')}
                          style={{ resize: 'vertical', minHeight: 60 }} />
                      </div>
                    )}

                    {action.type === 'create_item' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">{t('auto.builder.targetApp')}</label>
                          <select className="form-input" value={String(action.config.targetAppId ?? appId)}
                            onChange={e => updateActionConfig(idx, 'targetAppId', e.target.value)}>
                            {workspaceApps.map(a => (
                              <option key={a.id} value={a.id}>{a.iconEmoji} {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('auto.builder.itemTitle')}</label>
                          <input className="form-input" value={String(action.config.title ?? '')}
                            onChange={e => updateActionConfig(idx, 'title', e.target.value)}
                            placeholder={t('auto.builder.itemTitle')} />
                        </div>
                      </>
                    )}

                    {action.type === 'update_item' && (
                      <UpdateItemConfig
                        fields={fields}
                        updates={(action.config.updates as { fieldId: string; value: unknown }[]) ?? []}
                        onChange={updates => updateActionConfig(idx, 'updates', updates)}
                        t={t}
                      />
                    )}

                    {action.type === 'notify' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">{t('auto.messageLabel')}</label>
                          <input className="form-input" value={String(action.config.message ?? '')}
                            onChange={e => updateActionConfig(idx, 'message', e.target.value)}
                            placeholder={t('auto.messagePlaceholder')} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={Boolean(action.config.notifyAll)}
                            onChange={e => updateActionConfig(idx, 'notifyAll', e.target.checked)}
                            style={{ accentColor: 'var(--brand-500)' }} />
                          {t('auto.notifyAll')}
                        </label>
                      </>
                    )}

                    {action.type === 'webhook' && (
                      <div className="form-group">
                        <label className="form-label">{t('auto.webhookUrl')}</label>
                        <input className="form-input" type="url" value={String(action.config.url ?? '')}
                          onChange={e => updateActionConfig(idx, 'url', e.target.value)}
                          placeholder={t('auto.webhookPlaceholder')} />
                      </div>
                    )}

                    {action.type === 'send_email' && (
                      <p className="wf-muted">{t('auto.builder.comingSoon')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow name + save */}
      <div className="wf-step">
        <div className="wf-step-header">
          <div className="wf-step-number wf-step-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div className="wf-step-title">{t('auto.builder.workflowName')}</div>
          </div>
        </div>
        <div className="wf-step-body">
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('auto.builder.namePlaceholder')}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>
              {isPending ? t('auto.builder.saving') : t('auto.builder.save')}
            </button>
            <button className="btn btn-ghost" onClick={onDone} disabled={isPending}>
              {t('auto.builder.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Update item sub-component ────────────────────────────────────────────────

function UpdateItemConfig({
  fields,
  updates,
  onChange,
  t,
}: {
  fields: AppField[]
  updates: { fieldId: string; value: unknown }[]
  onChange: (updates: { fieldId: string; value: unknown }[]) => void
  t: ReturnType<typeof useT>['t']
}) {
  const editableFields = fields.filter(f => !['calculation', 'lookup', 'rollup', 'image', 'relation'].includes(f.type))

  function addUpdate() {
    onChange([...updates, { fieldId: '', value: '' }])
  }

  function updateField(idx: number, patch: Partial<{ fieldId: string; value: unknown }>) {
    onChange(updates.map((u, i) => i === idx ? { ...u, ...patch } : u))
  }

  function removeUpdate(idx: number) {
    onChange(updates.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {updates.map((upd, idx) => (
        <div key={idx} className="wf-condition-row">
          <select className="form-input wf-cond-select" value={upd.fieldId}
            onChange={e => updateField(idx, { fieldId: e.target.value, value: '' })}>
            <option value="">{t('auto.builder.fieldToUpdate')}</option>
            {editableFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input className="form-input wf-cond-value" placeholder={t('auto.builder.newValue')}
            value={String(upd.value ?? '')}
            onChange={e => updateField(idx, { value: e.target.value })} />
          <button className="wf-cond-remove" onClick={() => removeUpdate(idx)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}
      <button className="btn btn-secondary btn-sm" onClick={addUpdate} style={{ alignSelf: 'flex-start' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {t('auto.builder.addFieldUpdate')}
      </button>
    </div>
  )
}

// ─── Automation card (list view) ─────────────────────────────────────────────

type TestState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; code: number } | { status: 'err'; msg: string }

function AutomationCard({
  automation,
  onEdit,
}: {
  automation: AutomationRow
  onEdit: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const { t } = useT()

  const TRIGGER_LABELS: Record<AutomationTrigger['type'], string> = {
    item_created: t('auto.trigger.item_created'),
    item_updated: t('auto.trigger.item_updated'),
    comment_added: t('auto.trigger.comment_added'),
    scheduled: t('auto.trigger.scheduled'),
  }

  const ACTION_LABELS: Record<AutomationAction['type'], string> = {
    notify: t('auto.action.notify'),
    webhook: t('auto.action.webhook'),
    send_email: t('auto.action.send_email'),
    create_item: t('auto.action.create_item'),
    create_task: t('auto.action.create_task'),
    add_comment: t('auto.action.add_comment'),
    update_item: t('auto.action.update_item'),
  }

  let trigger: AutomationTrigger | null = null
  let actions: AutomationAction[] = []
  try {
    trigger = JSON.parse(automation.triggerJson)
    actions = JSON.parse(automation.actionsJson)
  } catch { /* ignore */ }

  function toggleActive() {
    startTransition(async () => {
      await updateAutomation(automation.id, { isActive: !automation.isActive })
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAutomation(automation.id)
    })
  }

  return (
    <div className={`automation-card ${automation.isActive ? 'active' : 'inactive'}`}>
      <div className="automation-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`automation-status-dot ${automation.isActive ? 'on' : 'off'}`} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{automation.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {t('auto.when')} <strong style={{ color: 'var(--text-secondary)' }}>{trigger ? TRIGGER_LABELS[trigger.type] : '?'}</strong>
              {trigger?.conditions && trigger.conditions.length > 0 && (
                <span style={{ color: 'var(--text-disabled)' }}> ({trigger.conditions.length} cond.)</span>
              )}
              {' → '}
              {actions.map((a, i) => (
                <span key={i}>
                  <strong style={{ color: 'var(--brand-400)' }}>{ACTION_LABELS[a.type] ?? a.type}</strong>
                  {i < actions.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Edit */}
          <button className="btn btn-ghost btn-sm icon-btn" onClick={onEdit} title={t('auto.builder.edit')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>

          {/* Toggle active */}
          <button
            className={`toggle-switch ${automation.isActive ? 'on' : 'off'}`}
            onClick={toggleActive}
            disabled={isPending}
            title={automation.isActive ? t('auto.disable') : t('auto.enable')}
          >
            <div className="toggle-thumb" />
          </button>

          {/* Delete */}
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={isPending}>{t('common.delete')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>{t('common.cancel')}</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm icon-btn" onClick={() => setConfirmDel(true)} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Webhook test preview */}
      {actions.map((a, i) => {
        if (a.type === 'webhook') {
          const cfg = a.config as { url?: string }
          return (
            <div key={i} className="automation-config-preview">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>URL:</span>{' '}
                  <span style={{ fontSize: 12, color: 'var(--brand-400)', wordBreak: 'break-all' }}>{cfg.url || t('auto.noUrl')}</span>
                </div>
                {cfg.url && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, fontSize: 11, padding: '3px 10px' }}
                    disabled={testState.status === 'loading'}
                    onClick={() => {
                      setTestState({ status: 'loading' })
                      testWebhook(cfg.url!).then(res => {
                        if (res.ok) setTestState({ status: 'ok', code: res.status ?? 200 })
                        else setTestState({ status: 'err', msg: res.error ?? `HTTP ${res.status}` })
                        setTimeout(() => setTestState({ status: 'idle' }), 4000)
                      })
                    }}
                  >
                    {testState.status === 'loading' ? t('auto.sending') : t('auto.test')}
                  </button>
                )}
              </div>
              {testState.status === 'ok' && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                  {t('auto.delivered', { code: testState.code })}
                </div>
              )}
              {testState.status === 'err' && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--error)', fontWeight: 600 }}>
                  {t('auto.failed', { msg: testState.msg })}
                </div>
              )}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function AutomationsPanel({ appId, workspaceId, automations, fields, workspaceApps = [] }: Props) {
  const [view, setView] = useState<View>({ mode: 'list' })
  const { t } = useT()

  if (view.mode === 'builder') {
    let initial: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] } | undefined
    if (view.editingId) {
      const auto = automations.find(a => a.id === view.editingId)
      if (auto) {
        try {
          initial = {
            name: auto.name,
            trigger: JSON.parse(auto.triggerJson),
            actions: JSON.parse(auto.actionsJson),
          }
        } catch { /* ignore */ }
      }
    }

    return (
      <div className="wf-page">
        <div className="wf-main">
          <WorkflowBuilder
            appId={appId}
            fields={fields}
            workspaceApps={workspaceApps}
            initial={initial}
            editingId={view.editingId}
            onDone={() => setView({ mode: 'list' })}
          />
        </div>

        {/* Right sidebar: How it works */}
        <div className="wf-sidebar">
          <div className="wf-sidebar-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <h3 className="wf-sidebar-title">{t('auto.builder.howItWorks')}</h3>
          </div>
          <div className="wf-sidebar-steps">
            <div className="wf-sidebar-item">
              <div className="wf-sidebar-num">1</div>
              <div>
                <strong>{t('auto.builder.step1')}</strong>
                <p>{t('auto.builder.howTrigger')}</p>
              </div>
            </div>
            <div className="wf-sidebar-item">
              <div className="wf-sidebar-num">2</div>
              <div>
                <strong>{t('auto.builder.step2')}</strong>
                <p>{t('auto.builder.howCondition')}</p>
              </div>
            </div>
            <div className="wf-sidebar-item">
              <div className="wf-sidebar-num">3</div>
              <div>
                <strong>{t('auto.builder.step3')}</strong>
                <p>{t('auto.builder.howAction')}</p>
              </div>
            </div>
          </div>
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('auto.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {t('auto.desc')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setView({ mode: 'builder' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('auto.new')}
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <p className="empty-state-title">{t('auto.empty')}</p>
          <p className="empty-state-desc">{t('auto.emptyDesc')}</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setView({ mode: 'builder' })}>
            {t('auto.createFirst')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {automations.map(a => (
            <AutomationCard
              key={a.id}
              automation={a}
              onEdit={() => setView({ mode: 'builder', editingId: a.id })}
            />
          ))}
        </div>
      )}

      <style>{styles}</style>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = `
/* ═══════════════════════════════════════════════════════════════════════════
   Automation list cards
   ═══════════════════════════════════════════════════════════════════════════ */
.automation-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 16px;
  transition: border-color var(--transition-fast);
}
.automation-card.active { border-color: rgba(99,102,241,0.3); }
.automation-card-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.automation-status-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
}
.automation-status-dot.on { background: var(--success); box-shadow: 0 0 6px var(--success); }
.automation-status-dot.off { background: var(--text-disabled); }
.automation-config-preview {
  margin-top: 10px; padding: 8px 12px; background: var(--bg-hover); border-radius: 6px; font-size: 12px;
}
.tag {
  display: inline-flex; align-items: center; padding: 1px 7px;
  background: rgba(99,102,241,0.15); color: var(--brand-400);
  border-radius: 9999px; font-size: 10px; font-weight: 600;
}
.toggle-switch {
  width: 36px; height: 20px; border-radius: 9999px; border: none; cursor: pointer;
  padding: 2px; position: relative; transition: background var(--transition-fast); flex-shrink: 0;
}
.toggle-switch.on { background: var(--brand-500); }
.toggle-switch.off { background: var(--border-default); }
.toggle-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle-thumb {
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: transform var(--transition-fast); box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle-switch.on .toggle-thumb { transform: translateX(16px); }
.toggle-switch.off .toggle-thumb { transform: translateX(0); }
.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; color: var(--text-tertiary);
}
.icon-btn:hover { color: var(--error); background: rgba(239,68,68,0.1); }

/* ═══════════════════════════════════════════════════════════════════════════
   Workflow builder — Page layout
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-page {
  display: flex;
  gap: 28px;
  padding: 28px 32px 80px;
  max-width: 1100px;
}
.wf-main {
  flex: 1;
  min-width: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Workflow builder — Stepper
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-builder {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 4px;
}
.wf-builder::before {
  content: '';
  position: absolute;
  left: 21px;
  top: 40px;
  bottom: 40px;
  width: 2px;
  background: linear-gradient(to bottom, var(--brand-500) 0%, var(--border-subtle) 50%, var(--success) 100%);
  opacity: 0.4;
  z-index: 0;
}

/* ── Step block ────────────────────────────────────────────────────────── */
.wf-step {
  position: relative;
  z-index: 1;
}
.wf-step-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 0 10px;
}
.wf-step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--brand-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
  box-shadow: 0 3px 12px rgba(99,102,241,0.35);
  border: 3px solid var(--bg-surface);
}
.wf-step-check {
  background: var(--success);
  box-shadow: 0 3px 12px rgba(34,197,94,0.35);
}
.wf-step-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.wf-step-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.wf-step-body {
  margin-left: 56px;
  padding: 4px 0 28px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step 1 — Trigger cards
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-trigger-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.wf-trigger-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 12px 16px;
  background: var(--bg-card);
  border: 2px solid var(--border-subtle);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
  color: var(--text-secondary);
  font-size: 12px;
  position: relative;
}
.wf-trigger-card:hover:not(.disabled) {
  border-color: var(--brand-400);
  background: rgba(99,102,241,0.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(99,102,241,0.12);
}
.wf-trigger-card.selected {
  border-color: var(--brand-500);
  background: rgba(99,102,241,0.08);
  color: var(--text-primary);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15), 0 4px 16px rgba(99,102,241,0.12);
}
.wf-trigger-card.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.wf-trigger-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-400);
  transition: all 0.18s ease;
}
.wf-trigger-card.selected .wf-trigger-icon {
  background: rgba(99,102,241,0.18);
  border-color: rgba(99,102,241,0.3);
  color: var(--brand-500);
}
.wf-trigger-label {
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}
.wf-trigger-desc {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(99,102,241,0.04);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.45;
}
.wf-badge-soon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  color: var(--text-disabled);
  letter-spacing: 0.6px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step 2 — Condition rows
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-condition-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
}
.wf-cond-select {
  flex: 1;
  min-width: 130px;
  font-size: 13px;
}
.wf-cond-value {
  flex: 1;
  min-width: 100px;
  font-size: 13px;
}
.wf-cond-remove {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-disabled);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.wf-cond-remove:hover {
  color: var(--error);
  border-color: rgba(239,68,68,0.25);
  background: rgba(239,68,68,0.06);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step 3 — Action palette + configured actions
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 18px;
}
.wf-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 10px 14px;
  background: var(--bg-card);
  border: 1px dashed var(--border-default);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
  color: var(--text-secondary);
  font-size: 11px;
}
.wf-action-card:hover:not(.disabled) {
  border-style: solid;
  border-color: var(--brand-400);
  background: rgba(99,102,241,0.04);
  transform: translateY(-1px);
  box-shadow: 0 3px 12px rgba(99,102,241,0.1);
}
.wf-action-card.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.wf-action-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(99,102,241,0.06);
  border: 1px solid rgba(99,102,241,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-400);
  transition: all 0.18s ease;
}
.wf-action-card:hover:not(.disabled) .wf-action-icon {
  background: rgba(99,102,241,0.12);
  border-color: rgba(99,102,241,0.2);
}
.wf-action-label {
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

/* Added actions list */
.wf-actions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wf-action-item {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}
.wf-action-item:hover {
  border-color: rgba(99,102,241,0.25);
}
.wf-action-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}
.wf-action-item-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-400);
}
.wf-action-config {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Right sidebar — How it works
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-sidebar {
  width: 270px;
  flex-shrink: 0;
  padding: 22px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  height: fit-content;
  position: sticky;
  top: 24px;
}
.wf-sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.wf-sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.wf-sidebar-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wf-sidebar-item {
  display: flex;
  gap: 12px;
}
.wf-sidebar-item strong {
  font-size: 13px;
  color: var(--text-primary);
  display: block;
}
.wf-sidebar-item p {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 4px 0 0;
  line-height: 1.5;
}
.wf-sidebar-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--brand-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99,102,241,0.25);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════════════════ */
.wf-muted {
  font-size: 13px;
  color: var(--text-disabled);
  font-style: italic;
  margin: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Responsive
   ═══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .wf-sidebar { display: none; }
  .wf-page { padding: 20px 16px; }
}
@media (max-width: 640px) {
  .wf-trigger-grid { grid-template-columns: 1fr 1fr; }
  .wf-action-grid { grid-template-columns: 1fr 1fr; }
  .wf-condition-row { flex-direction: column; padding: 10px; }
  .wf-cond-select, .wf-cond-value { min-width: 0; width: 100%; }
  .wf-step-body { margin-left: 46px; }
}
`
