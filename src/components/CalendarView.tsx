'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { AppField } from '@/lib/types'

type ItemRow = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  creator: { name: string | null; email: string }
  _count: { comments: number; tasks: number }
}

type Props = {
  app: { id: string; workspaceId: string }
  items: ItemRow[]
  fields: AppField[]
  workspaceId: string
}

export default function CalendarView({ app, items, fields, workspaceId }: Props) {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const dateField = fields.find(f => f.type === 'date')

  if (!dateField) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <p className="empty-state-title">No date field</p>
        <p className="empty-state-desc">Add a date field to use Calendar view. Go to Fields → Add Field → Date.</p>
      </div>
    )
  }

  // Build day-key → items map
  const dayMap = new Map<string, ItemRow[]>()
  for (const item of items) {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }
    const val = data[dateField.id]
    if (!val) continue
    try {
      const d = new Date(val as string)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!dayMap.has(key)) dayMap.set(key, [])
      dayMap.get(key)!.push(item)
    } catch { /* ignore */ }
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navigation bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={prevMonth} title="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{ fontWeight: 800, fontSize: 15, minWidth: 200, textAlign: 'center', letterSpacing: '-0.3px' }}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={nextMonth} title="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={goToday} style={{ marginLeft: 4, fontSize: 11 }}>Today</button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
          by <strong style={{ color: 'var(--text-secondary)' }}>{dateField.name}</strong>
        </span>
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'var(--text-disabled)', padding: '10px 4px',
              textTransform: 'uppercase', letterSpacing: '0.8px',
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="cal-day cal-day-empty" />
            }
            const key = `${year}-${month}-${day}`
            const dayItems = dayMap.get(key) ?? []
            const isToday = (
              year === today.getFullYear() &&
              month === today.getMonth() &&
              day === today.getDate()
            )
            return (
              <div key={key} className={`cal-day${isToday ? ' cal-today' : ''}`}>
                <div className="cal-day-number">{day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {dayItems.slice(0, 4).map(item => (
                    <button
                      key={item.id}
                      className="cal-item-chip"
                      onClick={() => router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`)}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  ))}
                  {dayItems.length > 4 && (
                    <span style={{ fontSize: 10, color: 'var(--text-disabled)', paddingLeft: 4, lineHeight: 1.4 }}>
                      +{dayItems.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .cal-day {
          min-height: 110px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 8px 6px;
          transition: border-color var(--transition-fast);
        }
        .cal-day:hover { border-color: var(--border-default); }
        .cal-day-empty {
          background: var(--bg-elevated);
          opacity: 0.3;
          min-height: 110px;
          border-radius: var(--radius-sm);
        }
        .cal-today {
          border-color: rgba(99,102,241,0.4) !important;
          background: rgba(99,102,241,0.04);
        }
        .cal-day-number {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-align: right;
          line-height: 1;
        }
        .cal-today .cal-day-number {
          color: var(--brand-400);
        }
        .cal-item-chip {
          display: block;
          width: 100%;
          text-align: left;
          background: rgba(99,102,241,0.12);
          border: none;
          border-radius: 4px;
          color: var(--brand-300);
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 2px 6px;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: background var(--transition-fast);
          line-height: 1.6;
        }
        .cal-item-chip:hover {
          background: rgba(99,102,241,0.25);
          color: var(--brand-200);
        }
      `}</style>
    </div>
  )
}
