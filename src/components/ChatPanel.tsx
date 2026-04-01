'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'

type ChatMessage = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string | null; email: string }
}

type Props = {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  onClose: () => void
}

export function ChatPanel({ workspaceId, workspaceName, currentUserId, onClose }: Props) {
  const { t } = useT()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTimeRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const qs = !initial && lastTimeRef.current
        ? `?since=${encodeURIComponent(lastTimeRef.current)}`
        : ''
      const res = await fetch(`/api/chat/${workspaceId}${qs}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.messages?.length > 0) {
        setMessages(prev => initial ? data.messages : [...prev, ...data.messages])
        lastTimeRef.current = data.messages[data.messages.length - 1].createdAt
      }
    } catch { /* ignore network errors */ }
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
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

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 199,
          display: 'none',
        }}
        className="chat-backdrop"
      />

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
              transition: 'color 150ms, background 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = 'none' }}
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
              lineHeight: 1.6,
            }}>
              {t('chat.empty')}
            </div>
          )}

          {messages.map((msg, i) => {
            const isMine = msg.user.id === currentUserId
            const prev = messages[i - 1]
            const showSender = !prev || prev.user.id !== msg.user.id
            const displayName = msg.user.name ?? msg.user.email
            const initial = displayName[0].toUpperCase()
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
                {/* Avatar (only other users, only on first message of a group) */}
                {!isMine && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                    flexShrink: 0,
                    visibility: showSender ? 'visible' : 'hidden',
                  }}>
                    {initial}
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
                    {msg.content}
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

        {/* Input */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
            background: 'var(--bg-surface)',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="form-input"
            style={{ flex: 1, fontSize: 13 }}
            disabled={sending}
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
    </>
  )
}
