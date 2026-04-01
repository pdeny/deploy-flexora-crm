'use client'

import React, { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateItem, addComment, createTask, updateTaskStatus } from '@/lib/actions/workspace'
import { useT } from '@/contexts/LanguageContext'
import type { AppField } from '@/lib/types'
import { formatRelative } from '@/lib/utils'
import { evalFormula, formatFormulaResult } from '@/lib/formula'
import { computeFieldFromLinkedItems } from '@/lib/rollup'
import { Avatar } from '@/components/Avatar'
import RelationField from '@/components/RelationField'
import { MultiselectCombobox } from '@/components/MultiselectCombobox'

type CommentType = {
  id: string
  content: string
  createdAt: Date
  author: { name: string | null; email: string }
}
type TaskType = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  createdAt: Date
  creator: { name: string | null; email: string }
  assignee: { name: string | null; email: string } | null
}
type ItemType = {
  id: string
  title: string
  dataJson: string
  createdAt: Date
  updatedAt: Date
  appId: string
  creator: { name: string | null; email: string }
  app: { name: string; iconEmoji: string; workspaceId: string }
  comments: CommentType[]
  tasks: TaskType[]
}
type UserType = { id: string; name: string | null; email: string }
type MemberType = { id: string; name: string | null; email: string }
type ActivityLogType = {
  id: string
  action: string
  metaJson: string
  createdAt: Date
  user: { name: string | null; email: string }
}

type Props = {
  item: ItemType
  workspaceApps?: { id: string; name: string; iconEmoji: string; fieldsJson?: string }[]
  linkedByField?: Record<string, { id: string; title: string; dataJson: string }[]>
  fields: AppField[]
  user: UserType
  workspaceId: string
  workspaceMembers?: MemberType[]
  activityLogs?: ActivityLogType[]
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: AppField
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (field.type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--brand-500)' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {Boolean(value) ? 'Yes' : 'No'}
        </span>
      </label>
    )
  }
  if (field.type === 'category' && field.options) {
    const selected = field.options.find(o => o.id === value)
    return (
      <div style={{ position: 'relative' }}>
        <select
          className="form-input form-select"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          style={{ paddingLeft: selected ? 30 : undefined }}
        >
          <option value="">—</option>
          {field.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {selected && (
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            width: 10, height: 10, borderRadius: '50%', background: selected.color,
            pointerEvents: 'none',
          }} />
        )}
      </div>
    )
  }
  if (field.type === 'multiselect' && field.options) {
    const cur: string[] = Array.isArray(value) ? value as string[] : []
    return (
      <MultiselectCombobox
        options={field.options}
        value={cur}
        onChange={onChange}
      />
    )
  }
  if (field.type === 'rating') {
    const cur = Number(value ?? 0)
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n === cur ? 0 : n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: n <= cur ? '#f59e0b' : 'var(--text-disabled)', padding: '0 2px', transition: 'color 100ms' }}>★</button>
        ))}
      </div>
    )
  }
  if (field.type === 'progress') {
    const cur = Number(value ?? 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="range" min={0} max={100} value={cur}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--brand-500)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 36 }}>{cur}%</span>
      </div>
    )
  }
  if (field.type === 'image') {
    const url = String(value ?? '')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        )}
        <input type="url" className="form-input" value={url} onChange={e => onChange(e.target.value)} placeholder="https://example.com/image.jpg" />
      </div>
    )
  }
  const typeMap: Record<string, string> = {
    date: 'date', number: 'number', email: 'email', url: 'url', phone: 'tel',
  }
  return (
    <input
      type={typeMap[field.type] ?? 'text'}
      className="form-input"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
    />
  )
}

type ActivityEvent =
  | { kind: 'created'; date: Date; user: { name: string | null; email: string } }
  | { kind: 'comment'; date: Date; comment: CommentType }
  | { kind: 'task'; date: Date; task: TaskType }
  | { kind: 'log'; date: Date; log: ActivityLogType }

function buildTimeline(item: ItemType, activityLogs: ActivityLogType[] = []): ActivityEvent[] {
  const events: ActivityEvent[] = [
    { kind: 'created', date: new Date(item.createdAt), user: item.creator },
    ...item.comments.map(c => ({ kind: 'comment' as const, date: new Date(c.createdAt), comment: c })),
    ...item.tasks.map(t => ({ kind: 'task' as const, date: new Date(t.createdAt), task: t })),
    ...activityLogs.map(l => ({ kind: 'log' as const, date: new Date(l.createdAt), log: l })),
  ]
  return events.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function renderInline(text: string, baseKey: string): React.ReactNode[] {
  // Tokenize: **bold**, *italic*, `code`, @mention
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|@[\w.-]+)/g)
  return tokens.map((tok, i) => {
    const key = `${baseKey}-${i}`
    if (tok.startsWith('**') && tok.endsWith('**'))
      return <strong key={key} style={{ color: 'var(--text-primary)' }}>{tok.slice(2, -2)}</strong>
    if (tok.startsWith('*') && tok.endsWith('*'))
      return <em key={key}>{tok.slice(1, -1)}</em>
    if (tok.startsWith('`') && tok.endsWith('`'))
      return <code key={key} style={{ background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{tok.slice(1, -1)}</code>
    if (tok.startsWith('@'))
      return <span key={key} style={{ color: 'var(--brand-400)', fontWeight: 600 }}>{tok}</span>
    return tok
  })
}

function renderWithMentions(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} style={{ paddingLeft: 18, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>{listItems}</ul>)
      listItems = []
    }
  }

  lines.forEach((line, li) => {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      listItems.push(<li key={li} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{renderInline(line.slice(2), `li-${li}`)}</li>)
    } else {
      flushList()
      if (line === '') {
        elements.push(<br key={`br-${li}`} />)
      } else {
        elements.push(<span key={`ln-${li}`} style={{ display: 'block' }}>{renderInline(line, `line-${li}`)}</span>)
      }
    }
  })
  flushList()
  return <>{elements}</>
}

function TaskRow({ task }: { task: TaskType }) {
  const [status, setStatus] = useState(task.status)
  const [isPending, start] = useTransition()

  const priorityDot: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }

  function toggle() {
    const next = status === 'done' ? 'todo' : 'done'
    start(async () => {
      await updateTaskStatus(task.id, next)
      setStatus(next)
    })
  }

  return (
    <div className="task-row-item">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`task-check ${status === 'done' ? 'done' : ''}`}
        aria-label={status === 'done' ? 'Mark undone' : 'Mark done'}
      >
        {status === 'done' && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 13,
        textDecoration: status === 'done' ? 'line-through' : 'none',
        color: status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
      }}>{task.title}</span>
      <span
        style={{ width: 7, height: 7, borderRadius: '50%', background: priorityDot[task.priority] ?? '#888', flexShrink: 0 }}
        title={`Priority: ${task.priority}`}
      />
      {task.dueDate && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {new Date(task.dueDate).toLocaleDateString()}
        </span>
      )}
    </div>
  )
}

export default function ItemDetail({ item, fields, user, workspaceMembers = [], activityLogs = [], workspaceApps = [], linkedByField = {} }: Props) {
  const { t } = useT()
  const router = useRouter()
  const [title, setTitle]   = useState(item.title)
  const [data, setData]     = useState<Record<string, unknown>>(() => {
    try { return JSON.parse(item.dataJson) } catch { return {} }
  })
  const [dirty, setDirty]   = useState(false)
  const [isSaving, startSave] = useTransition()

  const [commentText, setCommentText] = useState('')
  const [isCommenting, startComment]  = useTransition()
  const commentRef = useRef<HTMLTextAreaElement>(null)

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null) // null = closed
  const [mentionAnchor, setMentionAnchor] = useState(0) // index of @ char in commentText
  const [mentionIdx, setMentionIdx] = useState(0)

  const filteredMembers = mentionQuery !== null
    ? workspaceMembers.filter(m => {
        const q = mentionQuery.toLowerCase()
        return (m.name ?? m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      }).slice(0, 6)
    : []

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setCommentText(val)
    const cursor = e.target.selectionStart ?? val.length
    // Find the @ before the cursor
    const before = val.slice(0, cursor)
    const match = before.match(/@([\w.]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionAnchor(cursor - match[0].length)
      setMentionIdx(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(member: MemberType) {
    const slug = (member.name ?? member.email).toLowerCase().replace(/\s+/g, '.')
    const before = commentText.slice(0, mentionAnchor)
    const after = commentText.slice(mentionAnchor + 1 + (mentionQuery?.length ?? 0))
    const newText = `${before}@${slug} ${after}`
    setCommentText(newText)
    setMentionQuery(null)
    setTimeout(() => {
      const pos = before.length + slug.length + 2
      commentRef.current?.setSelectionRange(pos, pos)
      commentRef.current?.focus()
    }, 0)
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMembers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIdx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (commentText.trim()) submitComment(e as unknown as React.FormEvent)
    }
  }

  // Description stored in dataJson under __description__
  const [descEdit, setDescEdit] = useState(false)
  const description = (data['__description__'] as string) ?? ''

  const [taskTitle, setTaskTitle] = useState('')
  const [isAddingTask, startTask] = useTransition()

  const [sidebarTab, setSidebarTab] = useState<'tasks' | 'activity'>('tasks')

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    setDirty(true)
  }

  function handleFieldChange(id: string, v: unknown) {
    setData(d => ({ ...d, [id]: v }))
    setDirty(true)
  }

  function save() {
    startSave(async () => {
      await updateItem(item.id, { title, dataJson: JSON.stringify(data) })
      setDirty(false)
    })
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    const fd = new FormData()
    fd.set('itemId', item.id)
    fd.set('content', commentText)
    startComment(async () => {
      await addComment(fd)
      setCommentText('')
    })
  }

  function submitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    const fd = new FormData()
    fd.set('itemId', item.id)
    fd.set('title', taskTitle)
    startTask(async () => {
      await createTask(fd)
      setTaskTitle('')
    })
  }

  return (
    <div className="item-detail-root">
      {/* Top bar */}
      <div className="item-detail-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('common.back')}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {item.app.iconEmoji} {item.app.name}
        </span>
        {dirty && (
          <button className="btn btn-primary btn-sm" onClick={save} disabled={isSaving}>
            {isSaving
              ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {t('common.saving')}</>
              : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  {t('common.save')}
                </>
            }
          </button>
        )}
      </div>

      {/* Content */}
      <div className="item-detail-body">
        {/* ── Main column ── */}
        <div className="item-detail-main">
          <input
            className="item-title-input"
            value={title}
            onChange={handleTitleChange}
            placeholder={t('detail.itemTitlePlaceholder')}
          />

          {/* Description */}
          {descEdit ? (
            <textarea
              autoFocus
              className="form-input form-textarea"
              value={description}
              onChange={e => { setData(d => ({ ...d, __description__: e.target.value })); setDirty(true) }}
              onBlur={() => setDescEdit(false)}
              placeholder={t('detail.descPlaceholder')}
              rows={5}
              style={{ fontSize: 13, minHeight: 90, marginBottom: 16, lineHeight: 1.6, resize: 'vertical' }}
            />
          ) : (
            <div
              onClick={() => setDescEdit(true)}
              style={{
                marginBottom: 16, minHeight: 36, cursor: 'text',
                padding: '8px 10px', borderRadius: 8,
                border: '1px solid transparent',
                transition: 'all var(--transition-fast)',
              }}
              className="desc-placeholder-area"
              title="Click to add description"
            >
              {description ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {renderWithMentions(description)}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                  {t('detail.descPlaceholder')}
                </span>
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="item-meta-row">
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>{t('detail.createdBy')}</span>
              <strong>{item.creator.name ?? item.creator.email}</strong>
            </div>
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>{t('detail.created')}</span>
              <strong>{new Date(item.createdAt).toLocaleDateString()}</strong>
            </div>
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>{t('detail.updated')}</span>
              <strong>{formatRelative(item.updatedAt)}</strong>
            </div>
          </div>

          {/* Fields */}
          {fields.length > 0 && (
            <div className="item-fields-card">
              <div className="item-section-label">{t('detail.fields')}</div>
              <div className="item-fields-list">
                {fields.map(f => (
                  <div key={f.id} className="item-field-row">
                    <label className="item-field-name">
                      {f.name}
                      {f.required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
                      {f.type === 'calculation' && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>{t('detail.formula')}</span>
                      )}
                      {f.type === 'lookup' && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>{t('detail.lookup')}</span>
                      )}
                      {f.type === 'rollup' && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-disabled)', fontWeight: 400 }}>{t('detail.rollup')}</span>
                      )}
                    </label>
                    <div className="item-field-value">
                      {(f.type === 'lookup' || f.type === 'rollup') ? (() => {
                        const linked = (linkedByField?.[f.linkedFieldId ?? ''] ?? [])
                        const computed = computeFieldFromLinkedItems(f, linked)
                        const label = f.type === 'rollup' ? `${f.rollupFunction ?? 'COUNT'} ` : ''
                        return (
                          <span style={{
                            fontSize: 14, fontWeight: 600,
                            fontFamily: f.type === 'rollup' ? 'monospace' : undefined,
                            color: 'var(--text-primary)',
                            padding: '6px 10px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 6,
                            display: 'inline-block',
                          }}>
                            {computed === null ? '—' : `${label}${computed}`}
                          </span>
                        )
                      })() : f.type === 'relation' ? (() => {
                        const relatedApp = workspaceApps.find(a => a.id === f.relatedAppId)
                        if (!f.relatedAppId || !relatedApp) {
                          return <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{t('detail.noLinkedApp')}</span>
                        }
                        return (
                          <RelationField
                            fieldId={f.id}
                            fromItemId={item.id}
                            relatedAppId={f.relatedAppId}
                            relatedAppName={`${relatedApp.iconEmoji} ${relatedApp.name}`}
                            initialLinked={linkedByField[f.id] ?? []}
                          />
                        )
                      })() : f.type === 'calculation' ? (() => {
                        const { result, error } = evalFormula(f.calcFormula ?? '', fields, data)
                        return (
                          <span style={{
                            fontSize: 14, fontFamily: 'monospace', fontWeight: 600,
                            color: error ? 'var(--error)' : 'var(--text-primary)',
                            padding: '6px 10px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 6,
                            display: 'inline-block',
                          }} title={error ?? f.calcFormula}>
                            {error ? `⚠ ${error}` : formatFormulaResult(result)}
                          </span>
                        )
                      })() : (
                        <FieldEditor field={f} value={data[f.id]} onChange={v => handleFieldChange(f.id, v)} />
                      )}
                      {f.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4, lineHeight: 1.4 }}>
                          {f.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fields.length === 0 && (
            <div style={{ padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              {t('detail.noFields')}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="item-detail-sidebar">
          {/* Tab switcher */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setSidebarTab('tasks')}
            >
              {t('detail.tabs.tasks')}
              {item.tasks.length > 0 && <span className="item-count-badge">{item.tasks.length}</span>}
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'activity' ? 'active' : ''}`}
              onClick={() => setSidebarTab('activity')}
            >
              {t('detail.tabs.activity')}
              {(item.comments.length + activityLogs.length) > 0 && (
                <span className="item-count-badge">{item.comments.length + activityLogs.length}</span>
              )}
            </button>
          </div>

          {sidebarTab === 'tasks' && (
            <div className="item-sidebar-block">
              <form onSubmit={submitTask} className="item-quick-add">
                <input
                  className="form-input"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder={t('detail.taskPlaceholder')}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button type="submit" className="btn btn-secondary btn-sm btn-icon" disabled={isAddingTask || !taskTitle.trim()} title="Add task">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {item.tasks.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--text-disabled)', paddingTop: 4 }}>{t('detail.noTasks')}</p>
                  : item.tasks.map(task => <TaskRow key={task.id} task={task} />)
                }
              </div>
            </div>
          )}

          {sidebarTab === 'activity' && (
            <div className="item-sidebar-block" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Timeline */}
              <div className="activity-timeline">
                {buildTimeline(item, activityLogs).map((event, i) => {
                  if (event.kind === 'created') {
                    return (
                      <div key={`created-${i}`} className="activity-event">
                        <div className="activity-event-dot" style={{ background: 'var(--brand-500)' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="activity-event-body">
                          <span className="activity-event-who">{event.user.name ?? event.user.email}</span>
                          {' '}<span className="activity-event-action">created this item</span>
                          <div className="activity-event-time">{formatRelative(event.date)}</div>
                        </div>
                      </div>
                    )
                  }
                  if (event.kind === 'task') {
                    return (
                      <div key={`task-${event.task.id}`} className="activity-event">
                        <div className="activity-event-dot" style={{ background: 'var(--accent-violet)' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div className="activity-event-body">
                          <span className="activity-event-who">{event.task.creator.name ?? event.task.creator.email}</span>
                          {' '}<span className="activity-event-action">{t('detail.addedTask')}</span>{' '}
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>&quot;{event.task.title}&quot;</span>
                          <div className="activity-event-time">{formatRelative(event.date)}</div>
                        </div>
                      </div>
                    )
                  }
                  if (event.kind === 'log') {
                    let meta: { fieldName?: string; oldValue?: string; newValue?: string } = {}
                    try { meta = JSON.parse(event.log.metaJson) } catch { /* ignore */ }
                    const isTitle = event.log.action === 'title_updated'
                    return (
                      <div key={`log-${event.log.id}`} className="activity-event">
                        <div className="activity-event-dot" style={{ background: 'var(--text-tertiary)' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </div>
                        <div className="activity-event-body">
                          <span className="activity-event-who">{event.log.user.name ?? event.log.user.email}</span>
                          {' '}<span className="activity-event-action">{t('detail.changed')}</span>{' '}
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>
                            {isTitle ? 'title' : meta.fieldName}
                          </span>
                          {meta.oldValue !== undefined && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
                              <span style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', padding: '1px 5px', borderRadius: 4, marginRight: 4 }}>
                                {meta.oldValue || '(empty)'}
                              </span>
                              →
                              <span style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>
                                {meta.newValue || '(empty)'}
                              </span>
                            </div>
                          )}
                          <div className="activity-event-time">{formatRelative(event.date)}</div>
                        </div>
                      </div>
                    )
                  }
                  // comment
                  return (
                    <div key={`comment-${event.comment.id}`} className="activity-event comment-event">
                      <div className="comment-avatar" style={{ width: 24, height: 24, flexShrink: 0, overflow: 'hidden' }}>
                        <Avatar name={event.comment.author.name} email={event.comment.author.email} avatarUrl={(event.comment.author as { avatarUrl?: string | null }).avatarUrl} size={24} radius={8} />
                      </div>
                      <div className="activity-event-body">
                        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                          <span className="activity-event-who">
                            {event.comment.author.name ?? event.comment.author.email}
                            {event.comment.author.email === user.email && (
                              <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>you</span>
                            )}
                          </span>
                          <span className="activity-event-time">{formatRelative(event.date)}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4, wordBreak: 'break-word' }}>
                          {renderWithMentions(event.comment.content)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Comment form */}
              <form onSubmit={submitComment} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14, position: 'relative' }}>
                {/* @mention autocomplete dropdown */}
                {mentionQuery !== null && filteredMembers.length > 0 && (
                  <div className="mention-dropdown">
                    {filteredMembers.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`mention-option${i === mentionIdx ? ' active' : ''}`}
                        onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                      >
                        <div className="mention-avatar">{(m.name ?? m.email)[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name ?? m.email}</div>
                          {m.name && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.email}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={commentRef}
                  className="form-input form-textarea"
                  value={commentText}
                  onChange={handleCommentChange}
                  placeholder={t('detail.commentPlaceholder')}
                  rows={3}
                  style={{ fontSize: 13, minHeight: 72 }}
                  onKeyDown={handleCommentKeyDown}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>⌘↩ to send · @ to mention</span>
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={isCommenting || !commentText.trim()}>
                    {t('detail.send')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .item-detail-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg-base);
        }
        .item-detail-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          flex-shrink: 0;
          min-height: 50px;
        }
        .item-detail-body {
          display: grid;
          grid-template-columns: 1fr 300px;
          flex: 1;
          overflow: hidden;
        }
        .item-detail-main {
          padding: 36px 44px;
          overflow-y: auto;
        }
        .item-detail-sidebar {
          padding: 0;
          border-left: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .sidebar-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          background: var(--bg-elevated);
        }
        .sidebar-tab {
          flex: 1;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: -1px;
        }
        .sidebar-tab:hover { color: var(--text-secondary); }
        .sidebar-tab.active { color: var(--brand-400); border-bottom-color: var(--brand-500); }
        .item-sidebar-block {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }
        .activity-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .activity-event {
          display: flex;
          gap: 10px;
          padding: 8px 0;
          position: relative;
        }
        .activity-event::before {
          content: '';
          position: absolute;
          left: 11px;
          top: 28px;
          bottom: -8px;
          width: 1px;
          background: var(--border-subtle);
        }
        .activity-event:last-child::before { display: none; }
        .activity-event-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }
        .comment-event .activity-event-dot { background: transparent !important; }
        .activity-event-body {
          flex: 1;
          min-width: 0;
          padding-top: 2px;
        }
        .activity-event-who {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .activity-event-action {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .activity-event-time {
          font-size: 11px;
          color: var(--text-disabled);
          margin-top: 2px;
        }
        .item-title-input {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.7px;
          line-height: 1.2;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          margin-bottom: 16px;
          border-bottom: 2px solid transparent;
          transition: border-color var(--transition-fast);
          padding-bottom: 6px;
        }
        .item-title-input:focus { border-bottom-color: var(--brand-500); }
        .item-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 28px;
        }
        .item-meta-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary);
          padding: 4px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
        }
        .item-fields-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 20px 22px;
        }
        .item-section-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .item-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: var(--bg-overlay);
          border-radius: 9px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary);
        }
        .item-fields-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .item-field-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          align-items: center;
          gap: 14px;
        }
        .item-field-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-sidebar-block {
          display: flex;
          flex-direction: column;
        }
        .item-quick-add {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .comment-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .comment-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--brand-600), var(--accent-violet));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
        }
        .task-row-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          transition: border-color var(--transition-fast);
        }
        .task-row-item:hover { border-color: var(--border-default); }
        .task-check {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 2px solid var(--border-strong);
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all var(--transition-fast);
          color: #fff;
        }
        .task-check.done {
          background: var(--success);
          border-color: var(--success);
        }
        .task-check:hover:not(.done) {
          border-color: var(--success);
        }
        .task-check:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 860px) {
          .item-detail-body { grid-template-columns: 1fr; }
          .item-detail-sidebar { border-left: none; border-top: 1px solid var(--border-subtle); }
          .item-detail-main { padding: 24px 20px; }
        }
        .desc-placeholder-area:hover {
          border-color: var(--border-default) !important;
          background: var(--bg-elevated);
        }
        .mention-dropdown {
          position: absolute;
          bottom: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--bg-overlay);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
          overflow: hidden;
          z-index: 100;
          animation: fadeIn 80ms ease;
        }
        .mention-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          color: var(--text-primary);
          font-family: inherit;
          transition: background var(--transition-fast);
        }
        .mention-option:hover, .mention-option.active { background: var(--bg-hover); }
        .mention-avatar {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, var(--brand-600), var(--accent-violet));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
