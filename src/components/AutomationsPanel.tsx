'use client'

import { useState, useTransition } from 'react'
import type { AutomationTrigger, AutomationAction, AppField } from '@/lib/types'
import { createAutomation, updateAutomation, deleteAutomation, testWebhook } from '@/lib/actions/automations'

type AutomationRow = {
  id: string
  name: string
  isActive: boolean
  triggerJson: string
  actionsJson: string
  createdAt: Date
}

type Props = {
  appId: string
  workspaceId: string
  automations: AutomationRow[]
  fields: AppField[]
}

const TRIGGER_LABELS: Record<AutomationTrigger['type'], string> = {
  item_created: 'Item created',
  item_updated: 'Item updated',
  comment_added: 'Comment added',
  scheduled: 'Scheduled',
}

const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  notify: 'Send notification',
  webhook: 'Call webhook',
  send_email: 'Send email',
  create_item: 'Create item',
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  appId,
  onClose,
}: {
  appId: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>('item_created')
  const [actionType, setActionType] = useState<AutomationAction['type']>('notify')
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({})
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfigChange(key: string, value: unknown) {
    setActionConfig(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return }
    startTransition(async () => {
      const result = await createAutomation(appId, {
        name,
        trigger: { type: triggerType },
        actions: [{ type: actionType, config: actionConfig }],
      })
      if ('error' in result) { setError(result.error ?? 'Unknown error'); return }
      onClose()
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">New Automation</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Notify team on new item"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Trigger</label>
            <select
              className="form-input"
              value={triggerType}
              onChange={e => setTriggerType(e.target.value as AutomationTrigger['type'])}
            >
              {(Object.entries(TRIGGER_LABELS) as [AutomationTrigger['type'], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Action</label>
            <select
              className="form-input"
              value={actionType}
              onChange={e => {
                setActionType(e.target.value as AutomationAction['type'])
                setActionConfig({})
              }}
            >
              {(Object.entries(ACTION_LABELS) as [AutomationAction['type'], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Action config */}
          {actionType === 'notify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
              <div className="form-group">
                <label className="form-label">Message</label>
                <input
                  className="form-input"
                  placeholder="Notification message"
                  value={String(actionConfig.message ?? '')}
                  onChange={e => handleConfigChange('message', e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(actionConfig.notifyAll)}
                  onChange={e => handleConfigChange('notifyAll', e.target.checked)}
                  style={{ accentColor: 'var(--brand-500)' }}
                />
                Notify all workspace members
              </label>
            </div>
          )}

          {actionType === 'webhook' && (
            <div style={{ padding: '12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
              <div className="form-group">
                <label className="form-label">Webhook URL</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={String(actionConfig.url ?? '')}
                  onChange={e => handleConfigChange('url', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? 'Creating…' : 'Create automation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Automation row ───────────────────────────────────────────────────────────

type TestState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; code: number } | { status: 'err'; msg: string }

function AutomationCard({
  automation,
}: {
  automation: AutomationRow
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

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
              When <strong style={{ color: 'var(--text-secondary)' }}>{trigger ? TRIGGER_LABELS[trigger.type] : '?'}</strong>
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Toggle active */}
          <button
            className={`toggle-switch ${automation.isActive ? 'on' : 'off'}`}
            onClick={toggleActive}
            disabled={isPending}
            title={automation.isActive ? 'Disable' : 'Enable'}
          >
            <div className="toggle-thumb" />
          </button>

          {/* Delete */}
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={isPending}>Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm icon-btn"
              onClick={() => setConfirmDel(true)}
              title="Delete automation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Action config preview */}
      {actions.map((a, i) => {
        if (a.type === 'notify') {
          const cfg = a.config as { message?: string; notifyAll?: boolean }
          return (
            <div key={i} className="automation-config-preview">
              <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>Message:</span>{' '}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cfg.message || '(no message)'}</span>
              {cfg.notifyAll && <span className="tag" style={{ marginLeft: 6 }}>All members</span>}
            </div>
          )
        }
        if (a.type === 'webhook') {
          const cfg = a.config as { url?: string }
          return (
            <div key={i} className="automation-config-preview">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>URL:</span>{' '}
                  <span style={{ fontSize: 12, color: 'var(--brand-400)', wordBreak: 'break-all' }}>{cfg.url || '(no url)'}</span>
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
                    {testState.status === 'loading' ? 'Sending…' : 'Test'}
                  </button>
                )}
              </div>
              {testState.status === 'ok' && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                  ✓ Delivered (HTTP {testState.code})
                </div>
              )}
              {testState.status === 'err' && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--error)', fontWeight: 600 }}>
                  ✗ Failed: {testState.msg}
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

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function AutomationsPanel({ appId, automations }: Props) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Automations</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Automate actions when items change or events occur.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Automation
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <p className="empty-state-title">No automations yet</p>
          <p className="empty-state-desc">Create an automation to trigger actions when items are created, updated, or comments are added.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            Create first automation
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {automations.map(a => (
            <AutomationCard key={a.id} automation={a} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal appId={appId} onClose={() => setShowCreate(false)} />
      )}

      <style>{`
        .automation-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          transition: border-color var(--transition-fast);
        }
        .automation-card.active {
          border-color: rgba(99,102,241,0.3);
        }
        .automation-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .automation-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .automation-status-dot.on { background: var(--success); box-shadow: 0 0 6px var(--success); }
        .automation-status-dot.off { background: var(--text-disabled); }
        .automation-config-preview {
          margin-top: 10px;
          padding: 8px 12px;
          background: var(--bg-hover);
          border-radius: 6px;
          font-size: 12px;
        }
        .tag {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          background: rgba(99,102,241,0.15);
          color: var(--brand-400);
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 600;
        }
        .toggle-switch {
          width: 36px;
          height: 20px;
          border-radius: 9999px;
          border: none;
          cursor: pointer;
          padding: 2px;
          position: relative;
          transition: background var(--transition-fast);
          flex-shrink: 0;
        }
        .toggle-switch.on { background: var(--brand-500); }
        .toggle-switch.off { background: var(--border-default); }
        .toggle-switch:disabled { opacity: 0.5; cursor: not-allowed; }
        .toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform var(--transition-fast);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle-switch.on .toggle-thumb { transform: translateX(16px); }
        .toggle-switch.off .toggle-thumb { transform: translateX(0); }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          color: var(--text-tertiary);
        }
        .icon-btn:hover { color: var(--error); background: rgba(239,68,68,0.1); }
      `}</style>
    </div>
  )
}
