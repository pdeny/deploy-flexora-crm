'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CreateAppButton from '@/components/CreateAppButton'
import { duplicateApp, importAppFromCSV } from '@/lib/actions/workspace'
import { formatRelative } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import type { PermissionMap } from '@/lib/permissions'
import type { FieldType } from '@/lib/types'

type AppSummary = {
  id: string
  name: string
  iconEmoji: string
  color: string
  description: string | null
  itemCount: number
}

type RecentItem = {
  id: string
  title: string
  appId: string
  appName: string
  appEmoji: string
  appColor: string
  updatedAt: Date
}

type Member = {
  id: string
  role: string
  userName: string
  userEmail: string
}

type Props = {
  workspaceId: string
  workspaceName: string
  workspaceEmoji: string
  workspaceDescription: string | null
  apps: AppSummary[]
  members: Member[]
  recentItems: RecentItem[]
  doneTasks: number
  totalTasks: number
  taskCompletionPct: number | null
  can?: PermissionMap
}

export default function WorkspaceContent({
  workspaceId,
  workspaceName,
  workspaceEmoji,
  workspaceDescription,
  apps,
  members,
  recentItems,
  doneTasks,
  totalTasks,
  taskCompletionPct,
  can = {},
}: Props) {
  const { t } = useT()
  const router = useRouter()
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // CSV import state
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [csvParsed, setCsvParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [csvAppName, setCsvAppName] = useState('')
  const [csvTitleCol, setCsvTitleCol] = useState(0)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvDragOver, setCsvDragOver] = useState(false)
  const [csvSeparator, setCsvSeparator] = useState<',' | ';' | '.'>(',')
  const [csvRawText, setCsvRawText] = useState('')
  const csvFileRef = useRef<HTMLInputElement>(null)

  const FIELD_TYPE_LABELS: Record<FieldType, string> = {
    text: 'Text', number: 'Number', date: 'Date', category: 'Category',
    multiselect: 'Multi-select', rating: 'Rating', progress: 'Progress',
    email: 'Email', url: 'URL', phone: 'Phone', toggle: 'Toggle',
    image: 'Image', relation: 'Relation', calculation: 'Formula',
    lookup: 'Lookup', rollup: 'Rollup',
  }

  function parseCSV(text: string, sep: string = ','): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split(/\r?\n/)
    function parseLine(line: string): string[] {
      const cells: string[] = []; let cur = ''; let inQ = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
          else inQ = !inQ
        } else if (c === sep && !inQ) { cells.push(cur); cur = '' }
        else cur += c
      }
      cells.push(cur)
      return cells
    }
    const headers = parseLine(lines[0] ?? '')
    const rows = lines.slice(1).filter(l => l.trim()).map(parseLine)
    return { headers, rows }
  }

  function detectSeparator(text: string): ',' | ';' | '.' {
    const firstLine = text.split(/\r?\n/)[0] ?? ''
    const commas = (firstLine.match(/,/g) ?? []).length
    const semicolons = (firstLine.match(/;/g) ?? []).length
    const dots = (firstLine.match(/\./g) ?? []).length
    if (semicolons > commas && semicolons > dots) return ';'
    if (dots > commas && dots > semicolons) return '.'
    return ','
  }

  function inferFieldTypeClient(values: string[]): FieldType {
    const samples = values.filter(v => v.trim() !== '').slice(0, 50)
    if (samples.length === 0) return 'text'
    const allMatch = (test: (v: string) => boolean) => samples.every(test)
    if (allMatch(v => /^(yes|no|true|false|si|sì|1|0)$/i.test(v.trim()))) return 'toggle'
    if (allMatch(v => /^-?\d+([.,]\d+)?$/.test(v.trim().replace(/\s/g, '')))) return 'number'
    if (allMatch(v => !isNaN(Date.parse(v.trim())) && /\d/.test(v))) return 'date'
    if (allMatch(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))) return 'email'
    if (allMatch(v => /^https?:\/\/.+/i.test(v.trim()))) return 'url'
    if (allMatch(v => /^\+?[\d\s\-().]{7,}$/.test(v.trim()))) return 'phone'
    if (allMatch(v => /^[1-5]$/.test(v.trim()))) return 'rating'
    const unique = new Set(samples.map(v => v.trim().toLowerCase()))
    if (unique.size <= 15 && unique.size < samples.length * 0.6) return 'category'
    return 'text'
  }

  function reparseCSV(text: string, sep: ',' | ';' | '.') {
    const parsed = parseCSV(text, sep)
    setCsvParsed(parsed)
    const titleIdx = parsed.headers.findIndex(h => /^(title|name|nome|titolo)$/i.test(h.trim()))
    setCsvTitleCol(titleIdx >= 0 ? titleIdx : 0)
  }

  const handleCSVFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvRawText(text)
      const detectedSep = detectSeparator(text)
      setCsvSeparator(detectedSep)
      const parsed = parseCSV(text, detectedSep)
      setCsvParsed(parsed)
      const titleIdx = parsed.headers.findIndex(h => /^(title|name|nome|titolo)$/i.test(h.trim()))
      setCsvTitleCol(titleIdx >= 0 ? titleIdx : 0)
      setCsvAppName(file.name.replace(/\.csv$/i, '').replace(/[-_]/g, ' '))
    }
    reader.readAsText(file)
  }, [])

  async function handleCSVImport() {
    if (!csvParsed || !csvAppName.trim()) return
    setCsvImporting(true)
    const result = await importAppFromCSV({
      workspaceId,
      appName: csvAppName,
      headers: csvParsed.headers,
      rows: csvParsed.rows,
      titleColumnIndex: csvTitleCol,
    })
    setCsvImporting(false)
    if ('error' in result) {
      alert(result.error)
      return
    }
    setShowCSVImport(false)
    setCsvParsed(null)
    setCsvAppName('')
    if (result.app) {
      router.push(`/dashboard/${workspaceId}/${result.app.id}`)
    }
  }

  function handleDuplicateApp(e: React.MouseEvent, appId: string) {
    e.preventDefault()
    e.stopPropagation()
    setDuplicatingId(appId)
    startTransition(async () => {
      const result = await duplicateApp(appId)
      setDuplicatingId(null)
      if ('app' in result && result.app) {
        router.push(`/dashboard/${workspaceId}/${result.app.id}`)
      }
    })
  }

  const stats = [
    { label: t('ws.stat.apps'), value: apps.length, icon: '📱' },
    { label: t('ws.stat.members'), value: members.length, icon: '👥' },
    { label: t('ws.stat.items'), value: apps.reduce((s, a) => s + a.itemCount, 0), icon: '📄' },
  ]

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <div className="ws-page-title-row">
            <span className="ws-page-emoji">{workspaceEmoji}</span>
            <h1 className="page-title">{workspaceName}</h1>
          </div>
          {workspaceDescription && <p className="page-subtitle">{workspaceDescription}</p>}
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          {can['app:create'] && <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCSVImport(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {t('ws.importCSV')}
            </button>
            <CreateAppButton workspaceId={workspaceId} />
          </>}
        </div>
      </div>

      {/* Stats row */}
      <div className="ws-stats-row">
        {stats.map(stat => (
          <div key={stat.label} className="ws-stat-card">
            <span className="ws-stat-icon">{stat.icon}</span>
            <div>
              <div className="ws-stat-value">{stat.value}</div>
              <div className="ws-stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics mini-charts */}
      {apps.length > 0 && (
        <div className="ws-analytics-row">
          {/* Items per app bar chart */}
          <div className="ws-chart-card">
            <div className="ws-chart-title">{t('ws.chart.itemsPerApp')}</div>
            <div className="ws-bar-chart">
              {(() => {
                const maxCount = Math.max(1, ...apps.map(a => a.itemCount))
                return apps.map(app => (
                  <div key={app.id} className="ws-bar-item" title={`${app.name}: ${app.itemCount} ${t('ws.stat.items').toLowerCase()}`}>
                    <div className="ws-bar-track">
                      <div
                        className="ws-bar-fill"
                        style={{
                          height: `${Math.max(4, (app.itemCount / maxCount) * 100)}%`,
                          background: app.color,
                        }}
                      />
                    </div>
                    <div className="ws-bar-label">{app.iconEmoji}</div>
                    <div className="ws-bar-count">{app.itemCount}</div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Task completion donut */}
          {taskCompletionPct !== null && (
            <div className="ws-chart-card">
              <div className="ws-chart-title">{t('ws.chart.taskCompletion')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  {(() => {
                    const r = 32
                    const cx = 40, cy = 40
                    const circ = 2 * Math.PI * r
                    const pct = taskCompletionPct / 100
                    return (
                      <>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="10" />
                        <circle
                          cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke="var(--success)"
                          strokeWidth="10"
                          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
                          strokeDashoffset={circ * 0.25}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                        <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="800">{taskCompletionPct}%</text>
                      </>
                    )
                  })()}
                </svg>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div><span style={{ color: 'var(--success)', fontWeight: 700 }}>{doneTasks}</span> {t('ws.chart.done')}</div>
                    <div><span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{totalTasks - doneTasks}</span> {t('ws.chart.remaining')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>{t('ws.chart.totalTasks', { n: totalTasks })}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ws-content-grid">
        {/* Apps section */}
        <div className="ws-section">
          <div className="ws-section-header">
            <h2 className="ws-section-title">{t('ws.apps')}</h2>
            <CreateAppButton workspaceId={workspaceId} compact />
          </div>
          {apps.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📱</div>
              <p className="empty-state-title">{t('ws.noApps')}</p>
              <p className="empty-state-desc">{t('ws.noAppsDesc')}</p>
            </div>
          ) : (
            <div className="apps-grid">
              {apps.map(app => (
                <Link key={app.id} href={`/dashboard/${workspaceId}/${app.id}`} className="app-card" style={{ '--app-color': app.color } as React.CSSProperties}>
                  <div className="app-card-top">
                    <div className="app-emoji-bg" style={{ background: `${app.color}22`, border: `1px solid ${app.color}44` }}>
                      <span className="app-emoji">{app.iconEmoji}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {can['app:duplicate'] && <button
                        className="app-dup-btn"
                        title={t('ws.duplicateApp')}
                        onClick={(e) => handleDuplicateApp(e, app.id)}
                        disabled={isPending && duplicatingId === app.id}
                      >
                        {isPending && duplicatingId === app.id ? (
                          <span className="spinner" style={{ width: 12, height: 12 }} />
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                      </button>}
                      <div className="app-item-count">{t('ws.itemCount', { n: app.itemCount })}</div>
                    </div>
                  </div>
                  <div className="app-name">{app.name}</div>
                  {app.description && <div className="app-desc">{app.description}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="ws-section">
          <h2 className="ws-section-title">{t('ws.activity')}</h2>
          {recentItems.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '20px 0' }}>{t('ws.noActivity')}</p>
          ) : (
            <div className="activity-feed">
              {recentItems.map(item => (
                <Link key={item.id} href={`/dashboard/${workspaceId}/${item.appId}/${item.id}`} className="activity-item">
                  <div className="activity-dot" style={{ background: item.appColor }} />
                  <div className="activity-body">
                    <div className="activity-title">{item.title}</div>
                    <div className="activity-meta">
                      <span className="activity-app">{item.appEmoji} {item.appName}</span>
                      <span className="activity-time">{formatRelative(item.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="ws-section" style={{ marginTop: 28 }}>
        <h2 className="ws-section-title">{t('ws.members', { n: members.length })}</h2>
        <div className="members-row">
          {members.map(m => (
            <div key={m.id} className="member-chip">
              <div className="member-avatar">{(m.userName ?? m.userEmail)[0].toUpperCase()}</div>
              <div>
                <div className="member-name">{m.userName ?? m.userEmail}</div>
                <div className="member-role">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="modal-overlay" onClick={() => !csvImporting && setShowCSVImport(false)}>
          <div className="modal-content" style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('ws.importCSVTitle')}</h2>
              <button className="modal-close" onClick={() => !csvImporting && setShowCSVImport(false)}>&times;</button>
            </div>

            {!csvParsed ? (
              <div
                className={`csv-dropzone ${csvDragOver ? 'csv-dropzone-active' : ''}`}
                onDragOver={e => { e.preventDefault(); setCsvDragOver(true) }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={e => { e.preventDefault(); setCsvDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f) }}
                onClick={() => csvFileRef.current?.click()}
              >
                <input ref={csvFileRef} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f) }} />
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 10 }}>{t('ws.importCSVDrop')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 8px' }}>
                {/* App name + separator + title column */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label className="form-label">{t('ws.importCSVAppName')}</label>
                    <input className="form-input" value={csvAppName} onChange={e => setCsvAppName(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label className="form-label">{t('ws.importCSVSeparator')}</label>
                    <div className="csv-sep-group">
                      {([',', ';', '.'] as const).map(sep => (
                        <button
                          key={sep}
                          className={`csv-sep-btn ${csvSeparator === sep ? 'csv-sep-active' : ''}`}
                          onClick={() => { setCsvSeparator(sep); reparseCSV(csvRawText, sep) }}
                        >
                          {sep === ',' ? t('ws.importCSVSepComma') : sep === ';' ? t('ws.importCSVSepSemicolon') : t('ws.importCSVSepDot')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label className="form-label">{t('ws.importCSVTitleCol')}</label>
                    <select className="form-input" value={csvTitleCol} onChange={e => setCsvTitleCol(Number(e.target.value))}>
                      {csvParsed.headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>{t('ws.importCSVRows', { n: csvParsed.rows.length })}</span>
                  <span>{t('ws.importCSVCols', { n: csvParsed.headers.length })}</span>
                </div>

                {/* Detected fields */}
                <div>
                  <label className="form-label">{t('ws.importCSVFields')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {csvParsed.headers.map((h, i) => {
                      if (i === csvTitleCol) return (
                        <span key={i} className="csv-field-tag csv-field-title">Title: {h}</span>
                      )
                      const colValues = csvParsed!.rows.map(row => row[i] ?? '')
                      const type = inferFieldTypeClient(colValues)
                      return (
                        <span key={i} className="csv-field-tag">
                          {h} <span className="csv-field-type">{FIELD_TYPE_LABELS[type]}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Preview table */}
                <div>
                  <label className="form-label">{t('ws.importCSVPreview')}</label>
                  <div className="csv-preview-wrap">
                    <table className="csv-preview-table">
                      <thead>
                        <tr>
                          {csvParsed.headers.map((h, i) => (
                            <th key={i} className={i === csvTitleCol ? 'csv-title-col' : ''}>{h || `Col ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvParsed.rows.slice(0, 8).map((row, ri) => (
                          <tr key={ri}>
                            {csvParsed!.headers.map((_, ci) => (
                              <td key={ci} className={ci === csvTitleCol ? 'csv-title-col' : ''}>{row[ci] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvParsed.rows.length > 8 && (
                      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-disabled)', padding: '8px 0' }}>
                        … +{csvParsed.rows.length - 8} more rows
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => { setCsvParsed(null); setCsvAppName('') }}>
                    {t('common.back')}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCSVImport}
                    disabled={csvImporting || !csvAppName.trim()}
                  >
                    {csvImporting ? t('ws.importCSVImporting') : t('ws.importCSVImport')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .csv-dropzone {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 48px 24px; margin: 8px 0 12px;
          border: 2px dashed var(--border-default); border-radius: var(--radius-lg);
          cursor: pointer; transition: all var(--transition-fast);
        }
        .csv-dropzone:hover, .csv-dropzone-active {
          border-color: var(--brand-500); background: var(--brand-500)08;
        }
        .csv-field-tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; font-size: 12px; font-weight: 500;
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full); color: var(--text-primary);
        }
        .csv-field-title {
          background: var(--brand-500)15; border-color: var(--brand-500)33; color: var(--brand-600); font-weight: 700;
        }
        .csv-field-type {
          font-size: 10px; font-weight: 600; color: var(--text-tertiary);
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .csv-preview-wrap {
          border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
          overflow: auto; max-height: 260px;
        }
        .csv-preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .csv-preview-table th {
          background: var(--bg-elevated); position: sticky; top: 0; z-index: 1;
          padding: 6px 10px; text-align: left; font-weight: 700; font-size: 11px;
          color: var(--text-secondary); border-bottom: 1px solid var(--border-default);
          white-space: nowrap;
        }
        .csv-preview-table td {
          padding: 5px 10px; border-bottom: 1px solid var(--border-subtle);
          max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--text-primary);
        }
        .csv-sep-group {
          display: flex; border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden;
        }
        .csv-sep-btn {
          flex: 1; padding: 7px 4px; font-size: 12px; font-weight: 600;
          background: var(--bg-surface); border: none; color: var(--text-secondary);
          cursor: pointer; transition: all var(--transition-fast);
          border-right: 1px solid var(--border-subtle);
        }
        .csv-sep-btn:last-child { border-right: none; }
        .csv-sep-btn:hover { background: var(--bg-hover); }
        .csv-sep-active { background: var(--brand-500); color: #fff; }
        .csv-sep-active:hover { background: var(--brand-600); }
        .csv-title-col { background: var(--brand-500)08; }
        .ws-page-title-row { display: flex; align-items: center; gap: 12px; }
        .ws-page-emoji { font-size: 28px; }
        .ws-stats-row { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
        .ws-stat-card {
          flex: 1; min-width: 140px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
          display: flex; align-items: center; gap: 14px;
        }
        .ws-stat-icon { font-size: 24px; }
        .ws-stat-value { font-size: 24px; font-weight: 800; line-height: 1; }
        .ws-stat-label { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
        .ws-content-grid { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
        .ws-section { display: flex; flex-direction: column; gap: 14px; }
        .ws-section-header { display: flex; align-items: center; justify-content: space-between; }
        .ws-section-title { font-size: 15px; font-weight: 700; }
        .apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .app-card {
          display: flex; flex-direction: column; gap: 10px;
          padding: 16px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none; color: inherit;
          transition: all var(--transition-normal);
          cursor: pointer;
        }
        .app-card:hover {
          border-color: var(--app-color, var(--brand-500));
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          transform: translateY(-1px);
        }
        .app-card-top { display: flex; align-items: center; justify-content: space-between; }
        .app-emoji-bg { width: 38px; height: 38px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; }
        .app-emoji { font-size: 20px; }
        .app-item-count { font-size: 11px; color: var(--text-tertiary); }
        .app-dup-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
          opacity: 0;
        }
        .app-card:hover .app-dup-btn { opacity: 1; }
        .app-dup-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-subtle); }
        .app-name { font-size: 14px; font-weight: 700; }
        .app-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .activity-feed { display: flex; flex-direction: column; gap: 2px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; }
        .activity-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; text-decoration: none; color: inherit; transition: background var(--transition-fast); }
        .activity-item:hover { background: var(--bg-elevated); }
        .activity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .activity-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
        .activity-meta { display: flex; gap: 10px; margin-top: 2px; }
        .activity-app { font-size: 11px; color: var(--text-tertiary); }
        .activity-time { font-size: 11px; color: var(--text-disabled); }
        .members-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .member-chip { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-full); }
        .member-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-500), var(--accent-violet)); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .member-name { font-size: 13px; font-weight: 600; }
        .member-role { font-size: 11px; color: var(--text-tertiary); text-transform: capitalize; }
        .ws-analytics-row { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
        .ws-chart-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 16px 20px; flex: 1; min-width: 220px; }
        .ws-chart-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px; }
        .ws-bar-chart { display: flex; gap: 8px; align-items: flex-end; height: 80px; }
        .ws-bar-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: 20px; max-width: 48px; }
        .ws-bar-track { width: 100%; flex: 1; display: flex; align-items: flex-end; }
        .ws-bar-fill { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s ease; }
        .ws-bar-label { font-size: 14px; }
        .ws-bar-count { font-size: 10px; color: var(--text-tertiary); font-weight: 600; }
        @media (max-width: 900px) { .ws-content-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
