'use client'

import { useState, useTransition } from 'react'
import { generateShareLink, revokeShareLink } from '@/lib/actions/settings'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  appId: string
  initialToken: string | null
  currentView: string
  onClose: () => void
}

export default function ShareLinkModal({ appId, initialToken, currentView, onClose }: Props) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t } = useT()

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}?view=${currentView}`
    : null

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateShareLink(appId)
      if ('token' in res) setToken(res.token)
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeShareLink(appId)
      setToken(null)
    })
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{t('shareModal.title')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            {t('shareModal.desc')}
          </p>

          {token ? (
            <>
              {/* Active link */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: 8, padding: '8px 10px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><polyline points="10 15 10 12"/><line x1="10" y1="9" x2="10.01" y2="9"/>
                </svg>
                <input
                  readOnly
                  value={shareUrl ?? ''}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    fontSize: 12, color: 'var(--brand-400)', fontFamily: 'monospace',
                    cursor: 'text', minWidth: 0,
                  }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                  style={{ flexShrink: 0, fontSize: 11 }}
                >
                  {copied ? t('shareModal.copied') : t('shareModal.copy')}
                </button>
              </div>

              {/* View param note */}
              <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: -8 }}>
                {t('shareModal.viewIncluded', { view: currentView })}
              </p>

              {/* Revoke */}
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('shareModal.disableTitle')}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>
                  {t('shareModal.revokeDesc')}
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleRevoke}
                  disabled={isPending}
                >
                  {t('shareModal.revokeBtn')}
                </button>
              </div>
            </>
          ) : (
            /* No link yet */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              padding: '24px 0', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('shareModal.noLink')}</p>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={isPending}
              >
                {isPending ? t('shareModal.generating') : t('shareModal.generateBtn')}
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}
