'use client'
import { useEffect, useRef, useState } from 'react'
import type { CategoryOption } from '@/lib/types'

export function MultiselectCombobox({
  options,
  value,
  onChange,
}: {
  options: CategoryOption[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.filter(o => value.includes(o.id))

  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id]
    onChange(next)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          minHeight: 36,
          padding: '4px 8px 4px 8px',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          background: 'var(--bg-overlay)',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          textAlign: 'left',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>Scegli…</span>
        ) : (
          selected.map(o => (
            <span key={o.id} style={{
              padding: '1px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
              background: o.color + '22', color: o.color,
            }}>{o.label}</span>
          ))
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-disabled)', fontSize: 10, flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 300,
          marginTop: 4, minWidth: '100%',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          padding: '4px 0',
        }}>
          {options.map(o => {
            const active = value.includes(o.id)
            return (
              <label key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', cursor: 'pointer',
                background: active ? o.color + '11' : 'transparent',
                transition: 'background 80ms',
              }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(o.id)}
                  style={{ accentColor: o.color, width: 14, height: 14, flexShrink: 0 }}
                />
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', background: o.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{o.label}</span>
              </label>
            )
          })}
          {options.length === 0 && (
            <span style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-disabled)', display: 'block' }}>
              Nessuna opzione
            </span>
          )}
        </div>
      )}
    </div>
  )
}
