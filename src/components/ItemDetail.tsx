'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateItem, addComment, createTask, updateTaskStatus } from '@/lib/actions/workspace'
import type { AppField } from '@/lib/types'

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

type Props = {
  item: ItemType
  fields: AppField[]
  user: UserType
  workspaceId: string
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

function formatRelative(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ItemDetail({ item, fields, user, workspaceId }: Props) {
  const router = useRouter()
  const [title, setTitle]   = useState(item.title)
  const [data, setData]     = useState<Record<string, unknown>>(() => {
    try { return JSON.parse(item.dataJson) } catch { return {} }
  })
  const [dirty, setDirty]   = useState(false)
  const [isSaving, startSave] = useTransition()

  const [commentText, setCommentText] = useState('')
  const [isCommenting, startComment]  = useTransition()

  const [taskTitle, setTaskTitle] = useState('')
  const [isAddingTask, startTask] = useTransition()

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
          Back
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {item.app.iconEmoji} {item.app.name}
        </span>
        {dirty && (
          <button className="btn btn-primary btn-sm" onClick={save} disabled={isSaving}>
            {isSaving
              ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Saving…</>
              : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save
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
            placeholder="Item title"
          />

          {/* Meta info */}
          <div className="item-meta-row">
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>Created by</span>
              <strong>{item.creator.name ?? item.creator.email}</strong>
            </div>
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>Created</span>
              <strong>{new Date(item.createdAt).toLocaleDateString()}</strong>
            </div>
            <div className="item-meta-chip">
              <span style={{ opacity: 0.5 }}>Updated</span>
              <strong>{formatRelative(item.updatedAt)}</strong>
            </div>
          </div>

          {/* Fields */}
          {fields.length > 0 && (
            <div className="item-fields-card">
              <div className="item-section-label">Fields</div>
              <div className="item-fields-list">
                {fields.map(f => (
                  <div key={f.id} className="item-field-row">
                    <label className="item-field-name">{f.name}</label>
                    <div className="item-field-value">
                      <FieldEditor field={f} value={data[f.id]} onChange={v => handleFieldChange(f.id, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fields.length === 0 && (
            <div style={{ padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No custom fields. Add fields from the app header.
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="item-detail-sidebar">
          {/* Tasks */}
          <div className="item-sidebar-block">
            <div className="item-section-label">
              Tasks
              <span className="item-count-badge">{item.tasks.length}</span>
            </div>
            <form onSubmit={submitTask} className="item-quick-add">
              <input
                className="form-input"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="Add a task…"
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
                ? <p style={{ fontSize: 12, color: 'var(--text-disabled)', paddingTop: 4 }}>No tasks yet.</p>
                : item.tasks.map(t => <TaskRow key={t.id} task={t} />)
              }
            </div>
          </div>

          {/* Comments */}
          <div className="item-sidebar-block">
            <div className="item-section-label">
              Comments
              <span className="item-count-badge">{item.comments.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
              {item.comments.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>No comments yet. Be the first!</p>
                : item.comments.map(c => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-avatar">
                        {(c.author.name ?? c.author.email)[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {c.author.name ?? c.author.email}
                            {c.author.email === user.email && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>you</span>
                            )}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{formatRelative(c.createdAt)}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, wordBreak: 'break-word' }}>{c.content}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
            <form onSubmit={submitComment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                className="form-input form-textarea"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={`Comment as ${user.name ?? user.email}…`}
                rows={3}
                style={{ fontSize: 13, minHeight: 72 }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    if (commentText.trim()) submitComment(e as unknown as React.FormEvent)
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>⌘↩ to send</span>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={isCommenting || !commentText.trim()}
                >
                  {isCommenting ? 'Sending…' : 'Comment'}
                </button>
              </div>
            </form>
          </div>
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
          padding: 24px 18px;
          border-left: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
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
      `}</style>
    </div>
  )
}
