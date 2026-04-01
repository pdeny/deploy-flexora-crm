'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useTransition } from 'react'
import { searchItems } from '@/lib/actions/workspace'
import { formatRelative } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'

type SearchResultItem = {
  id: string
  title: string
  appId: string
  updatedAt: Date
  app: { id: string; name: string; iconEmoji: string; color: string; workspaceId: string }
}
type SearchResultApp = { id: string; name: string; iconEmoji: string; color: string; workspaceId: string }
type SearchResults = { items: SearchResultItem[]; apps: SearchResultApp[] }

type Props = {
  unreadCount?: number
}

export default function MobileBottomBar({ unreadCount = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useT()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openSearch() {
    setSearchOpen(true)
    setQuery('')
    setResults(null)
    setSelectedIdx(0)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    setResults(null)
  }

  // Escape to close
  useEffect(() => {
    if (!searchOpen) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen])

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [searchOpen])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults(null); setSelectedIdx(0); return }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchItems(query)
        if (res.results) { setResults(res.results as SearchResults); setSelectedIdx(0) }
      })
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const allResults: { type: 'item' | 'app'; item?: SearchResultItem; app?: SearchResultApp }[] = [
    ...(results?.apps ?? []).map(a => ({ type: 'app' as const, app: a })),
    ...(results?.items ?? []).map(i => ({ type: 'item' as const, item: i })),
  ]

  function navigate(idx: number) {
    const r = allResults[idx]
    if (!r) return
    closeSearch()
    if (r.type === 'item' && r.item) router.push(`/dashboard/${r.item.app.workspaceId}/${r.item.appId}/${r.item.id}`)
    else if (r.type === 'app' && r.app) router.push(`/dashboard/${r.app.workspaceId}/${r.app.id}`)
  }

  const isDashboardHome = pathname === '/dashboard'
  const isProfile = pathname === '/dashboard/profile'

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div
          className="mbb-search-backdrop"
          onMouseDown={e => { if (e.target === e.currentTarget) closeSearch() }}
        >
          <div className="mbb-search-panel">
            {/* Drag handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '10px auto 14px', flexShrink: 0 }} />

            {/* Input */}
            <div className="mbb-search-input-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                className="mbb-search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                autoComplete="off"
              />
              {isPending && <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
              <button className="mbb-close-btn" onClick={closeSearch}>✕</button>
            </div>

            {/* Results */}
            <div className="mbb-search-results">
              {!query.trim() ? (
                <div className="mbb-search-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.2 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <p>{t('search.hint')}</p>
                </div>
              ) : results && allResults.length === 0 ? (
                <div className="mbb-search-empty">
                  <p>{t('search.noResults', { query })}</p>
                </div>
              ) : results ? (
                <>
                  {results.apps.length > 0 && (
                    <div>
                      <div className="mbb-section-label">{t('search.apps')}</div>
                      {results.apps.map((app, idx) => (
                        <button key={app.id} className={`mbb-result-row${selectedIdx === idx ? ' selected' : ''}`} onClick={() => navigate(idx)}>
                          <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: app.color + '22', border: `1px solid ${app.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{app.iconEmoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{app.name}</div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>App</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.items.length > 0 && (
                    <div>
                      <div className="mbb-section-label">{t('search.items')}</div>
                      {results.items.map((item, idx) => {
                        const absIdx = (results.apps ?? []).length + idx
                        return (
                          <button key={item.id} className={`mbb-result-row${selectedIdx === absIdx ? ' selected' : ''}`} onClick={() => navigate(absIdx)}>
                            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: item.app.color + '18', border: `1px solid ${item.app.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{item.app.iconEmoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{item.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.app.name} · {formatRelative(item.updatedAt)}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="mobile-bottom-bar">
        {/* Home */}
        <button
          className={`mbb-tab${isDashboardHome ? ' active' : ''}`}
          onClick={() => router.push('/dashboard')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isDashboardHome ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </button>

        {/* Search — central, prominent */}
        <button className="mbb-search-tab" onClick={openSearch} aria-label={t('search.placeholder')}>
          <div className="mbb-search-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </button>

        {/* Profile */}
        <button
          className={`mbb-tab${isProfile ? ' active' : ''}`}
          onClick={() => router.push('/dashboard/profile')}
        >
          {unreadCount > 0 && (
            <span className="mbb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isProfile ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Profilo</span>
        </button>
      </nav>

      <style>{`
        /* Bottom bar — mobile only */
        .mobile-bottom-bar {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-bottom-bar {
            display: flex;
            align-items: center;
            justify-content: space-around;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background: var(--bg-surface);
            border-top: 1px solid var(--border-subtle);
            z-index: 200;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }

          .mbb-tab {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            flex: 1;
            height: 100%;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-tertiary);
            font-size: 10px;
            font-weight: 600;
            font-family: inherit;
            letter-spacing: 0.2px;
            position: relative;
            transition: color var(--transition-fast);
          }
          .mbb-tab.active {
            color: var(--brand-400);
          }
          .mbb-tab svg {
            transition: transform 120ms ease;
          }
          .mbb-tab.active svg {
            transform: translateY(-1px);
          }

          .mbb-search-tab {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            height: 100%;
            background: none;
            border: none;
            cursor: pointer;
          }
          .mbb-search-pill {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: var(--gradient-brand);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            box-shadow: 0 4px 20px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
            transition: transform 120ms ease, box-shadow 120ms ease;
          }
          .mbb-search-tab:active .mbb-search-pill {
            transform: scale(0.93);
            box-shadow: 0 2px 10px rgba(79,70,229,0.35);
          }

          .mbb-badge {
            position: absolute;
            top: 8px;
            right: calc(50% - 18px);
            background: var(--error);
            color: #fff;
            font-size: 9px;
            font-weight: 800;
            min-width: 16px;
            height: 16px;
            border-radius: 99px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 3px;
            border: 2px solid var(--bg-surface);
          }

          /* Search panel — slides up from bottom */
          .mbb-search-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(6px);
            z-index: 500;
            display: flex;
            align-items: flex-end;
            animation: fadeIn 120ms ease;
          }
          .mbb-search-panel {
            width: 100%;
            max-height: 88vh;
            background: var(--bg-surface);
            border-radius: 20px 20px 0 0;
            border-top: 1px solid var(--border-default);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: slideUp 200ms cubic-bezier(0.34, 1.3, 0.64, 1);
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .mbb-search-input-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 4px 16px 14px;
            border-bottom: 1px solid var(--border-subtle);
            flex-shrink: 0;
          }
          .mbb-search-input {
            flex: 1;
            background: none;
            border: none;
            outline: none;
            font-size: 16px;
            font-family: inherit;
            color: var(--text-primary);
          }
          .mbb-search-input::placeholder { color: var(--text-disabled); }
          .mbb-close-btn {
            background: var(--bg-overlay);
            border: 1px solid var(--border-default);
            border-radius: 8px;
            color: var(--text-secondary);
            font-size: 13px;
            cursor: pointer;
            padding: 4px 10px;
            font-family: inherit;
            flex-shrink: 0;
          }
          .mbb-search-results {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding: 6px 6px 16px;
          }
          .mbb-search-empty {
            padding: 40px 20px;
            text-align: center;
            color: var(--text-disabled);
            font-size: 13px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .mbb-section-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--text-disabled);
            padding: 10px 10px 4px;
          }
          .mbb-result-row {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 11px 10px;
            background: none;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            text-align: left;
            font-family: inherit;
            color: inherit;
            min-height: 52px;
            transition: background var(--transition-fast);
          }
          .mbb-result-row:active,
          .mbb-result-row.selected {
            background: rgba(99,102,241,0.08);
          }
        }
      `}</style>
    </>
  )
}
