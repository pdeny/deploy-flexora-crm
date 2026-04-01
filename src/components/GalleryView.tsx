'use client'

import { useRouter } from 'next/navigation'
import type { AppField } from '@/lib/types'
import { formatRelative } from '@/lib/utils'
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

function FieldValue({ value, field }: { value: unknown; field: AppField }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>
  }
  if (field.type === 'toggle') {
    return <span style={{ fontSize: 12, color: value ? 'var(--success)' : 'var(--text-disabled)' }}>{value ? '✓ Yes' : '✗ No'}</span>
  }
  if (field.type === 'category') {
    const opt = field.options?.find(o => o.id === value)
    if (!opt) return <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', borderRadius: 9999,
        fontSize: 11, fontWeight: 600,
        background: opt.color + '22', color: opt.color,
        border: `1px solid ${opt.color}33`,
      }}>{opt.label}</span>
    )
  }
  if (field.type === 'multiselect') {
    const ids = Array.isArray(value) ? value as string[] : []
    const opts = ids.map(id => field.options?.find(o => o.id === id)).filter(Boolean)
    if (opts.length === 0) return <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>—</span>
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {opts.map(opt => opt && (
          <span key={opt.id} style={{ padding: '1px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}33` }}>{opt.label}</span>
        ))}
      </div>
    )
  }
  if (field.type === 'rating') {
    const n = Number(value)
    return <span style={{ fontSize: 14, letterSpacing: 1, color: '#f59e0b' }}>{'★'.repeat(n)}{'☆'.repeat(Math.max(0,5-n))}</span>
  }
  if (field.type === 'progress') {
    const pct = Math.min(100, Math.max(0, Number(value)))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--bg-overlay)', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--brand-500)', borderRadius: 9999 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 28 }}>{pct}%</span>
      </div>
    )
  }
  if (field.type === 'date') {
    let dateStr: string
    try { dateStr = new Date(value as string).toLocaleDateString() }
    catch { dateStr = String(value) }
    return <span style={{ fontSize: 12 }}>{dateStr}</span>
  }
  if (field.type === 'url') {
    return (
      <a href={String(value)} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--brand-400)', fontSize: 12, textDecoration: 'none' }}
        onClick={e => e.stopPropagation()}
        className="truncate"
      >{String(value).replace(/^https?:\/\//, '').slice(0, 40)}</a>
    )
  }
  if (field.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={String(value)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} className="truncate">{String(value).slice(0, 60)}</span>
}

export default function GalleryView({ app, items, fields, workspaceId }: Props) {
  const { t } = useT()
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🖼</div>
        <p className="empty-state-title">{t('empty.gallery.noItems')}</p>
        <p className="empty-state-desc">{t('empty.gallery.desc')}</p>
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {items.map(item => {
        let data: Record<string, unknown> = {}
        try { data = JSON.parse(item.dataJson) } catch { /* ignore */ }

        const imageField = fields.find(f => f.type === 'image')
        const heroUrl = imageField ? String(data[imageField.id] ?? '') : ''

        const nonEmptyFields = fields.filter(f => {
          if (f.type === 'image') return false // shown as hero, not in field list
          const v = data[f.id]
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
        })

        return (
          <div
            key={item.id}
            className="gallery-card"
            onClick={() => router.push(`/dashboard/${workspaceId}/${app.id}/${item.id}`)}
          >
            {/* Hero image */}
            {heroUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroUrl} alt=""
                style={{ height: 140, objectFit: 'cover', borderRadius: '10px 10px 0 0', margin: '-20px -20px 16px', width: 'calc(100% + 40px)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

            {/* Title */}
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              marginBottom: 10, lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{item.title}</div>

            {/* Fields */}
            {nonEmptyFields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12, flex: 1 }}>
                {nonEmptyFields.slice(0, 6).map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)',
                      minWidth: 70, paddingTop: 1, flexShrink: 0,
                    }} className="truncate">{f.name}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <FieldValue value={data[f.id]} field={f} />
                    </div>
                  </div>
                ))}
                {nonEmptyFields.length > 6 && (
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{t('gallery.moreFields', { n: nonEmptyFields.length - 6 })}</span>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 10, borderTop: '1px solid var(--border-subtle)',
              marginTop: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>
                  {(item.creator.name ?? item.creator.email)[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }} className="truncate">
                  {item.creator.name ?? item.creator.email}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-disabled)', flexShrink: 0 }}>
                {item._count.comments > 0 && <span>💬 {item._count.comments}</span>}
                {item._count.tasks > 0 && <span>✓ {item._count.tasks}</span>}
                <span>{formatRelative(item.updatedAt)}</span>
              </div>
            </div>
          </div>
        )
      })}

      <style>{`
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
          padding: 16px;
          align-content: start;
          overflow-y: auto;
          flex: 1;
        }
        .gallery-card {
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 16px 17px;
          cursor: pointer;
          transition: all var(--transition-normal);
          min-height: 120px;
        }
        .gallery-card:hover {
          border-color: var(--border-strong);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  )
}
