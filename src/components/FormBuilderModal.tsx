'use client'

import { useState, useTransition } from 'react'
import type { AppField } from '@/lib/types'
import { saveFormConfig, revokeFormLink } from '@/lib/actions/settings'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  appId: string
  fields: AppField[]
  initialToken: string | null
  initialConfig: {
    title: string
    description: string
    fieldIds: string[]
    submitLabel: string
  }
  onClose: () => void
}

export default function FormBuilderModal({ appId, fields, initialToken, initialConfig, onClose }: Props) {
  const { t } = useT()
  const [token, setToken] = useState<string | null>(initialToken)
  const [title, setTitle] = useState(initialConfig.title)
  const [description, setDescription] = useState(initialConfig.description)
  const [submitLabel, setSubmitLabel] = useState(initialConfig.submitLabel || 'Submit')
  const [fieldIds, setFieldIds] = useState<string[]>(
    initialConfig.fieldIds.length > 0 ? initialConfig.fieldIds : fields.map(f => f.id)
  )
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'design' | 'share'>('design')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const formUrl = token ? `${origin}/form/${token}` : null
  const embedUrl = token ? `${origin}/form/${token}?embed=1` : null
  const embedCode = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="700" frameborder="0" style="border:none;border-radius:12px;"></iframe>`
    : null

  function toggleField(id: string) {
    setFieldIds(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  function moveField(id: string, dir: -1 | 1) {
    setFieldIds(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveFormConfig(appId, { title, description, fieldIds, submitLabel })
      if ('token' in res) setToken(res.token)
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeFormLink(appId)
      setToken(null)
    })
  }

  function handleCopy(text: string, type: 'url' | 'embed') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const orderedFields = [
    ...fieldIds.map(id => fields.find(f => f.id === id)).filter(Boolean) as AppField[],
    ...fields.filter(f => !fieldIds.includes(f.id)),
  ]

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 className="modal-title">{t('formBuilder.title')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-subtle)',
          padding: '0 20px', flexShrink: 0,
        }}>
          {(['design', 'share'] as const).map(tb => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              style={{
                padding: '10px 14px',
                fontSize: 13, fontWeight: 600,
                background: 'none', border: 'none',
                borderBottom: tab === tb ? '2px solid var(--brand-500)' : '2px solid transparent',
                color: tab === tb ? 'var(--text-primary)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {tb === 'design' ? t('formBuilder.tabDesign') : t('formBuilder.tabShare')}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'design' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Form title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {t('formBuilder.formTitle')}
                </label>
                <input
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('formBuilder.formTitlePlaceholder')}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {t('formBuilder.description')} <span style={{ fontWeight: 400, color: 'var(--text-disabled)' }}>({t('common.optional')})</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('formBuilder.descPlaceholder')}
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    padding: '8px 12px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Fields */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('formBuilder.fields')}
                </label>
                <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginBottom: 10 }}>
                  {t('formBuilder.fieldsHint')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Title field (always included) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{t('common.name')}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-disabled)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-overlay)' }}>{t('common.required')}</span>
                  </div>

                  {orderedFields.map(f => {
                    const included = fieldIds.includes(f.id)
                    const idx = fieldIds.indexOf(f.id)
                    return (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8,
                          background: included ? 'var(--bg-elevated)' : 'transparent',
                          border: `1px solid ${included ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                          opacity: included ? 1 : 0.55,
                          transition: 'all 120ms',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleField(f.id)}
                          style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                            border: `1.5px solid ${included ? 'var(--brand-500)' : 'var(--border-default)'}`,
                            background: included ? 'var(--brand-500)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {included && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>

                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{f.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{f.type}</span>

                        {included && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveField(f.id, -1)}
                              style={{
                                width: 22, height: 22, borderRadius: 5,
                                background: 'none', border: '1px solid var(--border-subtle)',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: idx === 0 ? 0.3 : 1,
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button
                              type="button"
                              disabled={idx === fieldIds.length - 1}
                              onClick={() => moveField(f.id, 1)}
                              style={{
                                width: 22, height: 22, borderRadius: 5,
                                background: 'none', border: '1px solid var(--border-subtle)',
                                cursor: idx === fieldIds.length - 1 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: idx === fieldIds.length - 1 ? 0.3 : 1,
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Submit button label */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {t('formBuilder.submitLabel')}
                </label>
                <input
                  className="input"
                  value={submitLabel}
                  onChange={e => setSubmitLabel(e.target.value)}
                  placeholder="Submit"
                />
              </div>
            </div>
          )}

          {tab === 'share' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {token ? (
                <>
                  {/* Status badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{t('formBuilder.formActive')}</span>
                  </div>

                  {/* Shareable link */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {t('formBuilder.shareableLink')}
                    </label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 8, padding: '8px 10px',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <input
                        readOnly
                        value={formUrl ?? ''}
                        onClick={e => (e.target as HTMLInputElement).select()}
                        style={{
                          flex: 1, background: 'none', border: 'none', outline: 'none',
                          fontSize: 12, color: 'var(--brand-400)', fontFamily: 'monospace',
                          cursor: 'text', minWidth: 0,
                        }}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(formUrl!, 'url')} style={{ flexShrink: 0, fontSize: 11 }}>
                        {copied === 'url' ? '✓' : t('formBuilder.copy')}
                      </button>
                    </div>
                    <a
                      href={formUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      {t('formBuilder.preview')}
                    </a>
                  </div>

                  {/* Embed code */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {t('formBuilder.embedCode')}
                    </label>
                    <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginBottom: 8, lineHeight: 1.5 }}>
                      {t('formBuilder.embedDesc')}
                    </p>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        readOnly
                        value={embedCode ?? ''}
                        onClick={e => (e.target as HTMLTextAreaElement).select()}
                        rows={4}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                          borderRadius: 8, padding: '10px 12px',
                          fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)',
                          resize: 'vertical', outline: 'none',
                        }}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(embedCode!, 'embed')}
                        style={{ position: 'absolute', top: 8, right: 8, fontSize: 11 }}
                      >
                        {copied === 'embed' ? '✓' : t('formBuilder.copy')}
                      </button>
                    </div>
                  </div>

                  {/* Disable form */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('formBuilder.disableForm')}</div>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>
                      {t('formBuilder.disableDesc')}
                    </p>
                    <button className="btn btn-danger btn-sm" onClick={handleRevoke} disabled={isPending}>
                      {t('formBuilder.disableForm')}
                    </button>
                  </div>
                </>
              ) : (
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
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="M7 9h10M7 13h5"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('formBuilder.saveFirst')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isPending || !title.trim()}
          >
            {isPending ? (
              <><span className="spinner" style={{ width: 13, height: 13 }} /> {t('formBuilder.saving')}</>
            ) : token ? t('formBuilder.savePublish') : t('formBuilder.saveGenerate')}
          </button>
        </div>
      </div>
    </div>
  )
}
