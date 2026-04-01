'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

type SearchResults = {
  items: SearchResultItem[]
  apps: SearchResultApp[]
}

export default function SearchModal() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⌘K / Ctrl+K shortcut to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function close() {
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Focus input on open and reset state
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus()
        setQuery('')
        setResults(null)
        setSelectedIdx(0)
      }, 30)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setTimeout(() => { setResults(null); setSelectedIdx(0) }, 0)
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchItems(query)
        if (res.results) {
          setResults(res.results as SearchResults)
          setSelectedIdx(0)
        }
      })
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Flatten results for keyboard navigation
  const allResults: { type: 'item' | 'app'; item?: SearchResultItem; app?: SearchResultApp }[] = [
    ...(results?.apps ?? []).map(a => ({ type: 'app' as const, app: a })),
    ...(results?.items ?? []).map(i => ({ type: 'item' as const, item: i })),
  ]

  function navigate(idx: number) {
    const r = allResults[idx]
    if (!r) return
    close()
    if (r.type === 'item' && r.item) {
      router.push(`/dashboard/${r.item.app.workspaceId}/${r.item.appId}/${r.item.id}`)
    } else if (r.type === 'app' && r.app) {
      router.push(`/dashboard/${r.app.workspaceId}/${r.app.id}`)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      navigate(selectedIdx)
    }
  }

  if (!open) {
    return (
      <button
        className="search-trigger-btn"
        onClick={() => setOpen(true)}
        title="Search (⌘K)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>{t('search.placeholder')}</span>
        <kbd>⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="search-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="search-modal">
        {/* Input */}
        <div className="search-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            autoComplete="off"
          />
          {isPending && <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
          <kbd className="search-esc-kbd" onClick={close}>Esc</kbd>
        </div>

        {/* Results */}
        <div className="search-results">
          {!query.trim() ? (
            <div className="search-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.2 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p>{t('search.hint')}</p>
            </div>
          ) : results && allResults.length === 0 ? (
            <div className="search-empty">
              <p>{t('search.noResults', { query })}</p>
            </div>
          ) : results ? (
            <>
              {results.apps.length > 0 && (
                <div>
                  <div className="search-section-label">{t('search.apps')}</div>
                  {results.apps.map((app, idx) => (
                    <button
                      key={app.id}
                      className={`search-result-row${selectedIdx === idx ? ' selected' : ''}`}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => navigate(idx)}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: app.color + '22', border: `1px solid ${app.color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                      }}>{app.iconEmoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{app.name}</div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>App</span>
                    </button>
                  ))}
                </div>
              )}

              {results.items.length > 0 && (
                <div>
                  <div className="search-section-label">{t('search.items')}</div>
                  {results.items.map((item, idx) => {
                    const absIdx = (results.apps ?? []).length + idx
                    return (
                      <button
                        key={item.id}
                        className={`search-result-row${selectedIdx === absIdx ? ' selected' : ''}`}
                        onMouseEnter={() => setSelectedIdx(absIdx)}
                        onClick={() => navigate(absIdx)}
                      >
                        <span style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: item.app.color + '18', border: `1px solid ${item.app.color}22`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13,
                        }}>{item.app.iconEmoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{item.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.app.name} · {formatRelative(item.updatedAt)}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>Item</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>

        {allResults.length > 0 && (
          <div className="search-footer">
            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>↑↓ navigate · ↵ open · Esc close</span>
          </div>
        )}
      </div>

      <style>{`
        .search-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(6px);
          z-index: 500;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
          animation: fadeIn 100ms ease;
        }
        .search-modal {
          width: 100%;
          max-width: 580px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl), 0 0 80px rgba(99,102,241,0.1);
          overflow: hidden;
          animation: slideUp 160ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .search-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 15px;
          font-family: inherit;
          color: var(--text-primary);
        }
        .search-input::placeholder { color: var(--text-disabled); }
        .search-esc-kbd {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--bg-overlay);
          border: 1px solid var(--border-default);
          border-radius: 5px;
          color: var(--text-disabled);
          cursor: pointer;
          font-family: inherit;
          flex-shrink: 0;
        }
        .search-results {
          max-height: 420px;
          overflow-y: auto;
          padding: 6px;
        }
        .search-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-disabled);
          font-size: 13px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .search-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-disabled);
          padding: 10px 10px 4px;
        }
        .search-result-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 10px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          color: inherit;
          transition: background var(--transition-fast);
        }
        .search-result-row:hover,
        .search-result-row.selected {
          background: rgba(99,102,241,0.08);
        }
        .search-footer {
          padding: 8px 16px;
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
        }
        .search-trigger-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .search-trigger-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--brand-500);
        }
        .search-trigger-btn kbd {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 4px;
          font-family: inherit;
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  )
}
