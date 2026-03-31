'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { addRelation, removeRelation, searchItemsForRelation } from '@/lib/actions/workspace'

type LinkedItem = { id: string; title: string }

type Props = {
  fieldId: string
  fromItemId: string
  relatedAppId: string
  relatedAppName: string
  initialLinked: LinkedItem[]
}

export default function RelationField({ fieldId, fromItemId, relatedAppId, relatedAppName, initialLinked }: Props) {
  const [linked, setLinked] = useState<LinkedItem[]>(initialLinked)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkedItem[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pickerRef = useRef<HTMLDivElement>(null)

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (!showPicker) return
      searchItemsForRelation(relatedAppId, query).then(r => setResults(r.items))
    }, 200)
    return () => clearTimeout(t)
  }, [query, showPicker, relatedAppId])

  useEffect(() => {
    if (!showPicker) return
    function h(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showPicker])

  function handleOpenPicker() {
    setShowPicker(true)
    setQuery('')
    searchItemsForRelation(relatedAppId, '').then(r => setResults(r.items))
  }

  function handleLink(item: LinkedItem) {
    if (linked.some(l => l.id === item.id)) return
    const next = [...linked, item]
    setLinked(next)
    startTransition(async () => {
      await addRelation(fieldId, fromItemId, item.id)
    })
  }

  function handleUnlink(item: LinkedItem) {
    setLinked(prev => prev.filter(l => l.id !== item.id))
    startTransition(async () => {
      await removeRelation(fieldId, fromItemId, item.id)
    })
  }

  const available = results.filter(r => !linked.some(l => l.id === r.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Linked chips */}
      {linked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {linked.map(item => (
            <span
              key={item.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px 3px 10px',
                borderRadius: 9999,
                fontSize: 12, fontWeight: 600,
                background: 'rgba(99,102,241,0.12)',
                color: 'var(--brand-400)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {item.title}
              <button
                type="button"
                onClick={() => handleUnlink(item)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, lineHeight: 1,
                  color: 'var(--brand-300)', opacity: 0.7,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Picker trigger */}
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleOpenPicker}
          disabled={isPending}
          style={{ fontSize: 12 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Link from {relatedAppName}
        </button>

        {showPicker && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            width: 280, zIndex: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <input
                autoFocus
                className="form-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${relatedAppName}…`}
                style={{ fontSize: 12 }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {available.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  {results.length === 0 ? 'No items found' : 'All items already linked'}
                </div>
              ) : (
                available.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { handleLink(item); setShowPicker(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 14px',
                      background: 'none', border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      cursor: 'pointer', display: 'block',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
