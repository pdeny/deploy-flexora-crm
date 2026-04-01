'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import type { AppField } from '@/lib/types'
import { useT } from '@/contexts/LanguageContext'

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

const DAY_WIDTH = 36    // px per day column
const ROW_HEIGHT = 36   // px per item row
const LABEL_WIDTH = 220 // px for left label panel
const DAYS_VISIBLE = 56 // 8 weeks shown

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

// 12 distinct colors for item bars
const BAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6',
  '#ef4444','#14b8a6','#f97316','#84cc16','#a855f7','#06b6d4',
]

export default function TimelineView({ app, items, fields, workspaceId }: Props) {
  const { t } = useT()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = startOfDay(new Date())

  // Start date of visible window (always a Monday-ish aligned to today - 7 days)
  const [windowStart, setWindowStart] = useState<Date>(() => addDays(today, -14))

  const dateFields = fields.filter(f => f.type === 'date')

  // Scroll to today on mount — must be before early returns to satisfy rules-of-hooks
  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = diffDays(windowStart, today)
      scrollRef.current.scrollLeft = Math.max(0, todayOffset * DAY_WIDTH - 200)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentional: scroll once on mount only

  // If no date field, prompt to add one
  if (dateFields.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <p className="empty-state-title">{t('empty.timeline.noDate')}</p>
        <p className="empty-state-desc">{t('empty.timeline.noDateDesc')}</p>
      </div>
    )
  }

  const startField = dateFields[0]
  const endField = dateFields.length >= 2 ? dateFields[1] : null

  // Build day columns
  const days: Date[] = Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(windowStart, i))

  // Group days into month bands
  type MonthBand = { label: string; startCol: number; span: number }
  const monthBands: MonthBand[] = []
  let curMonth = -1, curStart = 0
  days.forEach((d, i) => {
    if (d.getMonth() !== curMonth) {
      if (curMonth !== -1) monthBands.push({ label: `${MONTH_NAMES[curMonth]} ${days[curStart].getFullYear()}`, startCol: curStart, span: i - curStart })
      curMonth = d.getMonth()
      curStart = i
    }
  })
  monthBands.push({ label: `${MONTH_NAMES[curMonth]} ${days[curStart].getFullYear()}`, startCol: curStart, span: DAYS_VISIBLE - curStart })

  // Parse items → bars
  type Bar = { item: ItemRow; startOff: number; endOff: number; color: string; data: Record<string, unknown> }
  const bars: Bar[] = []
  const todayKey = dayKey(today)

  items.forEach((item, idx) => {
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }

    const rawStart = data[startField.id]
    if (!rawStart) return

    let startDate: Date
    try {
      startDate = startOfDay(new Date(rawStart as string))
      if (isNaN(startDate.getTime())) return
    } catch { return }

    let endDate: Date = startDate
    if (endField) {
      const rawEnd = data[endField.id]
      if (rawEnd) {
        try {
          const d = startOfDay(new Date(rawEnd as string))
          if (!isNaN(d.getTime()) && d >= startDate) endDate = d
        } catch { /* ignore */ }
      }
    }

    const startOff = diffDays(windowStart, startDate)
    const endOff = diffDays(windowStart, endDate)

    // Skip items entirely outside visible window
    if (endOff < 0 || startOff >= DAYS_VISIBLE) return

    bars.push({
      item,
      startOff: Math.max(0, startOff),
      endOff: Math.min(DAYS_VISIBLE - 1, endOff),
      color: BAR_COLORS[idx % BAR_COLORS.length],
      data,
    })
  })

  const totalWidth = DAYS_VISIBLE * DAY_WIDTH

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top nav bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm btn-icon" title={t('timeline.prev')}
          onClick={() => setWindowStart(d => addDays(d, -14))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
          onClick={() => {
            setWindowStart(addDays(today, -14))
            setTimeout(() => {
              if (scrollRef.current) {
                const off = diffDays(addDays(today, -14), today)
                scrollRef.current.scrollLeft = Math.max(0, off * DAY_WIDTH - 200)
              }
            }, 50)
          }}>
          {t('timeline.today')}
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" title={t('timeline.next')}
          onClick={() => setWindowStart(d => addDays(d, 14))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {t('timeline.start')}: <strong style={{ color: 'var(--text-secondary)' }}>{startField.name}</strong>
          {endField && <> · {t('timeline.end')}: <strong style={{ color: 'var(--text-secondary)' }}>{endField.name}</strong></>}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-disabled)' }}>
          {t('timeline.itemsWithDates', { n: bars.length, m: items.length })}
        </span>
      </div>

      {/* Main area: label column + scrollable grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: item labels (fixed) */}
        <div style={{
          width: LABEL_WIDTH, flexShrink: 0,
          borderRight: '1px solid var(--border-default)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-surface)',
          overflowY: 'hidden',
        }}>
          {/* Header placeholder to align with month/day headers */}
          <div style={{ height: 54, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              {t('timeline.item')}
            </span>
          </div>
          {/* Item rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  height: ROW_HEIGHT, display: 'flex', alignItems: 'center',
                  padding: '0 14px', borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer', gap: 8, flexShrink: 0,
                  transition: 'background var(--transition-fast)',
                }}
                className="tl-row-label"
                onClick={() => router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`)}
              >
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}>{item.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: scrollable grid */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
          <div style={{ width: totalWidth, minWidth: totalWidth, position: 'relative' }}>
            {/* Month header row */}
            <div style={{
              display: 'flex', height: 26,
              borderBottom: '1px solid var(--border-subtle)',
              position: 'sticky', top: 0, zIndex: 10,
              background: 'var(--bg-surface)',
            }}>
              {monthBands.map(band => (
                <div key={band.startCol} style={{
                  width: band.span * DAY_WIDTH,
                  padding: '0 8px',
                  fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  display: 'flex', alignItems: 'center',
                  borderRight: '1px solid var(--border-subtle)',
                  flexShrink: 0,
                }}>{band.label}</div>
              ))}
            </div>

            {/* Day header row */}
            <div style={{
              display: 'flex', height: 28,
              borderBottom: '1px solid var(--border-default)',
              position: 'sticky', top: 26, zIndex: 10,
              background: 'var(--bg-surface)',
            }}>
              {days.map((d, i) => {
                const isToday = dayKey(d) === todayKey
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div key={i} style={{
                    width: DAY_WIDTH, flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid var(--border-subtle)',
                    background: isToday ? 'rgba(99,102,241,0.12)' : isWeekend ? 'var(--bg-elevated)' : undefined,
                  }}>
                    <span style={{ fontSize: 9, color: isToday ? 'var(--brand-400)' : 'var(--text-disabled)', fontWeight: 700, lineHeight: 1 }}>
                      {DAY_NAMES[d.getDay()]}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: isToday ? 800 : 600,
                      color: isToday ? 'var(--brand-400)' : isWeekend ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      lineHeight: 1.2,
                    }}>{d.getDate()}</span>
                  </div>
                )
              })}
            </div>

            {/* Body: rows + bars */}
            <div style={{ position: 'relative' }}>
              {/* Row backgrounds */}
              {items.map((item, idx) => (
                <div key={item.id} style={{
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid var(--border-subtle)',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  position: 'relative',
                  display: 'flex',
                }}>
                  {/* Day cell stripes */}
                  {days.map((d, ci) => {
                    const isToday = dayKey(d) === todayKey
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <div key={ci} style={{
                        width: DAY_WIDTH, flexShrink: 0, height: '100%',
                        borderRight: '1px solid var(--border-subtle)',
                        background: isToday ? 'rgba(99,102,241,0.06)' : isWeekend ? 'var(--bg-elevated)' : undefined,
                        opacity: isWeekend ? 0.6 : 1,
                      }} />
                    )
                  })}
                </div>
              ))}

              {/* Today vertical line */}
              {(() => {
                const todayOff = diffDays(windowStart, today)
                if (todayOff < 0 || todayOff >= DAYS_VISIBLE) return null
                return (
                  <div style={{
                    position: 'absolute',
                    top: 0, bottom: 0,
                    left: todayOff * DAY_WIDTH + DAY_WIDTH / 2,
                    width: 2,
                    background: 'rgba(99,102,241,0.5)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }} />
                )
              })()}

              {/* Bars overlay */}
              {bars.map(({ item, startOff, endOff, color }) => {
                const rowIdx = items.findIndex(i => i.id === item.id)
                if (rowIdx === -1) return null
                const barWidth = Math.max(DAY_WIDTH, (endOff - startOff + 1) * DAY_WIDTH - 4)
                return (
                  <div
                    key={item.id}
                    title={item.title}
                    onClick={() => router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`)}
                    style={{
                      position: 'absolute',
                      top: rowIdx * ROW_HEIGHT + 6,
                      left: startOff * DAY_WIDTH + 2,
                      width: barWidth,
                      height: ROW_HEIGHT - 12,
                      background: color + 'cc',
                      border: `1.5px solid ${color}`,
                      borderRadius: 5,
                      cursor: 'pointer',
                      zIndex: 6,
                      display: 'flex', alignItems: 'center', paddingLeft: 8,
                      overflow: 'hidden',
                      transition: 'filter var(--transition-fast)',
                    }}
                    className="tl-bar"
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    }}>{item.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tl-row-label:hover { background: var(--bg-hover) !important; }
        .tl-bar:hover { filter: brightness(1.15); }
      `}</style>
    </div>
  )
}
