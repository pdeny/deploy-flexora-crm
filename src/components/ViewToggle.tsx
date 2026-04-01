'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'

type View = 'table' | 'kanban' | 'gallery' | 'calendar' | 'timeline'

export default function ViewToggle({ currentView }: { currentView: View }) {
  const { t } = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setView = useCallback((view: View) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const views: { id: View; label: string; icon: React.ReactNode }[] = [
    {
      id: 'table',
      label: t('view.table'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      ),
    },
    {
      id: 'kanban',
      label: t('view.kanban'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="5" height="18" rx="1"/>
          <rect x="10" y="3" width="5" height="12" rx="1"/>
          <rect x="17" y="3" width="5" height="15" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'gallery',
      label: t('view.gallery'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'calendar',
      label: t('view.calendar'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      id: 'timeline',
      label: t('view.timeline'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <rect x="5" y="8" width="6" height="4" rx="1"/>
          <rect x="13" y="12" width="7" height="4" rx="1"/>
          <line x1="3" y1="6" x2="3" y2="18"/>
          <line x1="21" y1="6" x2="21" y2="18"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="view-toggle-group">
      {views.map(v => (
        <button
          key={v.id}
          className={`view-toggle-btn${currentView === v.id ? ' active' : ''}`}
          onClick={() => setView(v.id)}
          title={v.label}
        >
          {v.icon}
          <span>{v.label}</span>
        </button>
      ))}
      <style>{`
        .view-toggle-group {
          display: flex;
          align-items: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 8px;
          padding: 3px;
          gap: 2px;
        }
        .view-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          color: var(--text-tertiary);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .view-toggle-btn:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .view-toggle-btn.active {
          color: var(--text-primary);
          background: var(--bg-overlay);
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  )
}
