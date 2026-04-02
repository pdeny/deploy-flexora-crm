'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { AppField } from '@/lib/types'
import type { FormConfig } from '@/lib/actions/settings'
import { submitFormEntry } from '@/lib/actions/settings'
import { useT } from '@/contexts/LanguageContext'
import { MultiselectCombobox } from '@/components/MultiselectCombobox'

type AppInfo = {
  name: string
  iconEmoji: string
  color: string
  description: string | null
}

type Props = {
  token: string
  app: AppInfo
  config: FormConfig
  fields: AppField[]
  embed?: boolean
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AppField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontSize: 14,
    padding: '9px 12px',
    outline: 'none',
    transition: 'border-color 150ms',
  }

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.name}
          style={inputStyle}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          style={inputStyle}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      )

    case 'toggle':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--brand-500)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{field.name}</span>
        </label>
      )

    case 'category': {
      const opts = field.options ?? []
      return (
        <select
          className="form-input form-select"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {opts.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )
    }

    case 'multiselect': {
      const opts = field.options ?? []
      const selected: string[] = Array.isArray(value) ? value as string[] : []
      return (
        <MultiselectCombobox
          options={opts}
          value={selected}
          onChange={onChange}
        />
      )
    }

    case 'rating': {
      const num = Number(value ?? 0)
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n === num ? 0 : n)}
              style={{
                fontSize: 22,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: n <= num ? '#f59e0b' : 'var(--border-default)',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ★
            </button>
          ))}
        </div>
      )
    }

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.name}
          style={inputStyle}
        />
      )
  }
}

export default function PublicFormClient({ token, app, config, fields, embed }: Props) {
  const [title, setTitle] = useState('')
  const [data, setData] = useState<Record<string, unknown>>({})
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useT()

  function setField(id: string, value: unknown) {
    setData(prev => ({ ...prev, [id]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Client-side required validation
    for (const field of fields) {
      if (!field.required) continue
      const val = data[field.id]
      const isEmpty = val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)
      if (isEmpty) { setError(t('form.fieldRequired', { name: field.name })); return }
    }
    startTransition(async () => {
      const res = await submitFormEntry(token, title, JSON.stringify(data))
      if ('error' in res) {
        setError(res.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: embed ? 'transparent' : 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: embed ? '16px 16px 40px' : '40px 16px 80px',
    }}>
      {/* Branding bar — hidden in embed mode */}
      {!embed && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 44,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: app.color + '22', border: `1px solid ${app.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
            }}>{app.iconEmoji}</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{app.name}</span>
          </div>
          <Link
            href="/"
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--brand-400)',
              textDecoration: 'none', padding: '3px 10px',
              background: 'rgba(99,102,241,0.1)', borderRadius: 9999,
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            {t('form.poweredBy')}
          </Link>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 560, marginTop: embed ? 0 : 44 }}>
        {submitted ? (
          // ── Success state ──────────────────────────────────────────────
          <div style={{
            marginTop: 60,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: '48px 40px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              {t('form.submitted')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.6, margin: '0 0 28px' }}>
              {t('form.thankYou')}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setSubmitted(false); setTitle(''); setData({}) }}
            >
              {t('form.another')}
            </button>
          </div>
        ) : (
          // ── Form ─────────────────────────────────────────────────────
          <form onSubmit={handleSubmit}>
            {/* Header card */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              borderTop: `4px solid ${app.color}`,
              padding: '28px 32px 24px',
              marginBottom: 12,
            }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {config.title}
              </h1>
              {config.description && (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                  {config.description}
                </p>
              )}
            </div>

            {/* Title field */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              padding: '20px 24px',
              marginBottom: 8,
            }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {t('form.titleField')} <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('form.titlePlaceholder')}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  padding: '9px 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Custom fields */}
            {fields.map(field => (
              <div
                key={field.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  padding: '20px 24px',
                  marginBottom: 8,
                }}
              >
                {field.type !== 'toggle' && (
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: field.description ? 4 : 10 }}>
                    {field.name}
                    {field.required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
                  </label>
                )}
                {field.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {field.description}
                  </p>
                )}
                <FieldInput
                  field={field}
                  value={data[field.id]}
                  onChange={v => setField(field.id, v)}
                />
              </div>
            ))}

            {error && (
              <div style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--error)',
                fontSize: 13,
                marginBottom: 8,
              }}>
                {error}
              </div>
            )}

            <div style={{ padding: '16px 0 0' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
                style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 700 }}
              >
                {isPending ? (
                  <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('form.submitting')}</>
                ) : config.submitLabel || t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        input:focus {
          border-color: var(--brand-500) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
      `}</style>
    </div>
  )
}
