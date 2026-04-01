'use client'

import Link from 'next/link'
import { useT } from '@/contexts/LanguageContext'

type View = 'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline'

export function ShareReadOnlyBadge({ itemCount }: { itemCount: number }) {
  const { t } = useT()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 9999,
      fontSize: 11, fontWeight: 600,
      background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
      border: '1px solid rgba(16,185,129,0.2)',
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      {t('share.readOnly', { n: itemCount })}
    </span>
  )
}

export function SharePoweredBy() {
  const { t } = useT()
  return (
    <Link
      href="/"
      style={{
        fontSize: 11, fontWeight: 700, color: 'var(--brand-400)',
        textDecoration: 'none', padding: '3px 10px',
        background: 'rgba(99,102,241,0.1)', borderRadius: 9999,
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      {t('share.poweredBy')}
    </Link>
  )
}

export function ShareViewTabs({ currentView }: { currentView: View }) {
  const { t } = useT()

  const VIEW_LABELS: Record<View, string> = {
    table: t('view.table'),
    kanban: t('view.kanban'),
    gallery: t('view.gallery'),
    calendar: t('view.calendar'),
    timeline: t('view.timeline'),
  }

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '8px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)', flexShrink: 0,
    }}>
      {(Object.keys(VIEW_LABELS) as View[]).map(v => (
        <a
          key={v}
          href={`?view=${v}`}
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 12px', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            color: currentView === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
            background: currentView === v ? 'var(--bg-overlay)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 120ms',
          }}
        >{VIEW_LABELS[v]}</a>
      ))}
    </div>
  )
}
