'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { AppField } from '@/lib/types'

type Props = {
  fields: AppField[]
  sortField: string
  sortDir: 'asc' | 'desc'
}

export default function SortDropdown({ fields, sortField, sortDir }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const allFields = [{ id: '__title__', name: 'Title' }, { id: '__updatedAt__', name: 'Updated' }, ...fields]

  const setSort = useCallback((fieldId: string, dir: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams.toString())
    if (!fieldId) {
      params.delete('sortField')
      params.delete('sortDir')
    } else {
      params.set('sortField', fieldId)
      params.set('sortDir', dir)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const isActive = !!sortField

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select
        className="form-input form-select"
        style={{
          padding: '5px 28px 5px 10px',
          fontSize: 12,
          width: 'auto',
          borderColor: isActive ? 'rgba(99,102,241,0.4)' : undefined,
          color: isActive ? 'var(--brand-300)' : undefined,
        }}
        value={sortField}
        onChange={e => setSort(e.target.value, sortDir)}
      >
        <option value="">Sort by…</option>
        {allFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      {isActive && (
        <button
          className={`btn btn-secondary btn-sm btn-icon`}
          onClick={() => setSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
          style={{ fontSize: 12 }}
        >
          {sortDir === 'asc' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
          )}
        </button>
      )}

      {isActive && (
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => setSort('', 'asc')}
          title="Clear sort"
          style={{ color: 'var(--text-disabled)', fontSize: 12 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}
