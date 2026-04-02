'use client'

import { useState, useTransition } from 'react'
import { createWorkspace } from '@/lib/actions/workspace'
import { useT } from '@/contexts/LanguageContext'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
const EMOJIS = ['🏢', '🚀', '⚡', '🔥', '💎', '🎯', '🌟', '🏆', '🎨', '🛠️', '📊', '💡', '🌐', '🔬', '🎮']

export default function CreateWorkspaceButton() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [color, setColor] = useState(COLORS[0])
  const [emoji, setEmoji] = useState('🏢')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('color', color)
    formData.set('iconEmoji', emoji)
    startTransition(async () => {
      const result = await createWorkspace(formData)
      if (result?.error) setError(result.error)
      else setOpen(false)
    })
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setColor(COLORS[0])
    setEmoji('🏢')
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {t('workspace.new')}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleClose()}>
          <div className="modal" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h2 className="modal-title">{t('workspace.createTitle')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                    <span>⚠</span> {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">{t('common.icon')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EMOJIS.map(e => (
                      <button
                        key={e} type="button" onClick={() => setEmoji(e)}
                        style={{
                          fontSize: 20, width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                          background: emoji === e ? 'rgba(99,102,241,0.2)' : 'var(--bg-elevated)',
                          border: emoji === e ? '2px solid var(--brand-500)' : '1px solid var(--border-subtle)',
                          transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >{e}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ws-name">{t('common.name')} <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input id="ws-name" className="form-input" name="name" placeholder={t('workspace.namePlaceholder')} required autoFocus />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ws-desc">{t('common.description')}</label>
                  <input id="ws-desc" className="form-input" name="description" placeholder={t('workspace.descPlaceholder')} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('common.color')}</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <button
                        key={c} type="button" onClick={() => setColor(c)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: color === c ? `3px solid rgba(255,255,255,0.9)` : '2px solid transparent',
                          boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                          transition: 'all 150ms',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending
                    ? <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('common.creating')}</>
                    : t('workspace.createTitle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
