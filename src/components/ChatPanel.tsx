'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'
import { Avatar } from '@/components/Avatar'

type ChatMessage = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string | null; email: string; avatarUrl: string | null }
}

type Member = { id: string; name: string | null; email: string; avatarUrl?: string | null }

type Props = {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  onClose: () => void
}

// ── Mention helpers ────────────────────────────────────────────────────────────

/** Render a message splitting plain text and @[name](id) tokens */
function renderContent(content: string, isMine: boolean) {
  const parts = content.split(/(@\[[^\]]*\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const m = part.match(/^@\[([^\]]*)\]\(([^)]+)\)$/)
    if (m) {
      return (
        <span
          key={i}
          style={{
            background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(99,102,241,0.15)',
            color: isMine ? '#fff' : 'var(--brand-400)',
            borderRadius: 4,
            padding: '0 4px',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          @{m[1]}
        </span>
      )
    }
    return part
  })
}

/** Find an active @query before the cursor. Returns {query, atIndex} or null. */
function findMentionAtCursor(value: string, cursor: number): { query: string; atIndex: number } | null {
  const before = value.slice(0, cursor)
  const lastAt = before.lastIndexOf('@')
  if (lastAt === -1) return null
  const afterAt = before.slice(lastAt + 1)
  // Stop if there's a space or an already-completed mention bracket
  if (afterAt.includes(' ') || afterAt.includes('[')) return null
  return { query: afterAt, atIndex: lastAt }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel({ workspaceId, workspaceName, currentUserId, onClose }: Props) {
  const { t } = useT()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionState, setMentionState] = useState<{ query: string; atIndex: number } | null>(null)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTimeRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Fetch / poll ──────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const qs = !initial && lastTimeRef.current
        ? `?since=${encodeURIComponent(lastTimeRef.current)}`
        : ''
      const res = await fetch(`/api/chat/${workspaceId}${qs}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.members) setMembers(data.members)
      if (data.messages?.length > 0) {
        setMessages(prev => initial ? data.messages : [...prev, ...data.messages])
        lastTimeRef.current = data.messages[data.messages.length - 1].createdAt
      }
    } catch { /* ignore */ }
  }, [workspaceId])

  useEffect(() => {
    fetchMessages(true)
    pollRef.current = setInterval(() => fetchMessages(), 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Mention autocomplete ──────────────────────────────────────────────────

  const filteredMembers = mentionState
    ? members
        .filter(m => {
          if (m.id === currentUserId) return false
          const label = (m.name ?? m.email).toLowerCase()
          return label.includes(mentionState.query.toLowerCase())
        })
        .slice(0, 6)
    : []

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const found = findMentionAtCursor(val, cursor)
    setMentionState(found)
    setMentionHighlight(0)
  }

  function insertMention(member: Member) {
    if (!mentionState) return
    const displayName = member.name ?? member.email
    const before = input.slice(0, mentionState.atIndex)
    const after = input.slice(mentionState.atIndex + 1 + mentionState.query.length)
    const token = `@[${displayName}](${member.id})`
    const newVal = before + token + ' ' + after
    setInput(newVal)
    setMentionState(null)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const pos = before.length + token.length + 1
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mentionState || filteredMembers.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionHighlight(h => (h + 1) % filteredMembers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionHighlight(h => (h - 1 + filteredMembers.length) % filteredMembers.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(filteredMembers[mentionHighlight])
    } else if (e.key === 'Escape') {
      setMentionState(null)
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    // If mention dropdown is open, pick the highlighted entry instead
    if (mentionState && filteredMembers.length > 0) {
      insertMention(filteredMembers[mentionHighlight])
      return
    }
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/chat/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        lastTimeRef.current = data.message.createdAt
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 320,
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 200,
      boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
    }}>
      {/* Header */}
      <div style={{
        padding: '0 16px',
        height: 48,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
          {workspaceName}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 5, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-disabled)',
            fontSize: 13,
            marginTop: 48,
            lineHeight: 1.8,
          }}>
            {t('chat.empty')}
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.user.id === currentUserId
          const prev = messages[i - 1]
          const showSender = !prev || prev.user.id !== msg.user.id
          const displayName = msg.user.name ?? msg.user.email
          const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const showTime = !messages[i + 1] || messages[i + 1].user.id !== msg.user.id

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isMine ? 'row-reverse' : 'row',
                gap: 8,
                alignItems: 'flex-end',
                marginTop: showSender ? 8 : 2,
              }}
            >
              {!isMine && (
                <div style={{ visibility: showSender ? 'visible' : 'hidden', flexShrink: 0 }}>
                  <Avatar name={msg.user.name} email={msg.user.email} avatarUrl={msg.user.avatarUrl} size={26} radius={7} />
                </div>
              )}

              <div style={{
                maxWidth: '75%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMine ? 'flex-end' : 'flex-start',
                gap: 2,
              }}>
                {showSender && !isMine && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, paddingLeft: 2 }}>
                    {displayName}
                  </span>
                )}
                <div style={{
                  padding: '7px 11px',
                  borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: isMine ? 'var(--brand-600)' : 'var(--bg-elevated)',
                  color: isMine ? '#fff' : 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  border: isMine ? 'none' : '1px solid var(--border-subtle)',
                }}>
                  {renderContent(msg.content, isMine)}
                </div>
                {showTime && (
                  <span style={{ fontSize: 10, color: 'var(--text-disabled)', paddingLeft: 2, paddingRight: 2 }}>
                    {time}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
        background: 'var(--bg-surface)',
        position: 'relative',
      }}>
        {/* @mention dropdown */}
        {mentionState && filteredMembers.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 12,
            right: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            marginBottom: 4,
          }}>
            <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
              {t('chat.mentionMembers')}
            </div>
            {filteredMembers.map((m, idx) => {
              const label = m.name ?? m.email
              return (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    background: idx === mentionHighlight ? 'var(--bg-hover)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={() => setMentionHighlight(idx)}
                >
                  <Avatar name={m.name} email={m.email} avatarUrl={m.avatarUrl} size={24} radius={6} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </div>
                    {m.name && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.email}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <form
          onSubmit={handleSend}
          style={{ padding: '10px 12px', display: 'flex', gap: 8 }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={t('chat.placeholder')}
            className="form-input"
            style={{ flex: 1, fontSize: 13 }}
            disabled={sending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              background: 'var(--brand-600)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: !input.trim() || sending ? 0.45 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
