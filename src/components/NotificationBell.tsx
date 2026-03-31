'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications'
import { formatRelative } from '@/lib/utils'

type NotificationItem = {
  id: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: Date
}

type Props = {
  notifications: NotificationItem[]
  unreadCount: number
}

export default function NotificationBell({ notifications, unreadCount }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleNotifClick(notif: NotificationItem) {
    startTransition(async () => {
      if (!notif.isRead) await markNotificationRead(notif.id)
    })
    setOpen(false)
    if (notif.link) router.push(notif.link)
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notif-count-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleMarkAll}
                disabled={isPending}
                style={{ fontSize: 11, color: 'var(--brand-400)', padding: '3px 8px' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  className={`notif-item${notif.isRead ? '' : ' unread'}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  {!notif.isRead && <span className="notif-unread-dot" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: notif.isRead ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 2 }} className="truncate">
                      {notif.title}
                    </div>
                    {notif.body && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {notif.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 4 }}>
                      {formatRelative(notif.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .notif-bell-btn {
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .notif-bell-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .notif-count-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: var(--accent-rose);
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 8px rgba(244,63,94,0.6);
        }
        .notif-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 340px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          z-index: 300;
          overflow: hidden;
          animation: slideUp 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .notif-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
        }
        .notif-list {
          max-height: 380px;
          overflow-y: auto;
        }
        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          padding: 11px 14px;
          text-align: left;
          background: none;
          border: none;
          border-bottom: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: background var(--transition-fast);
          color: inherit;
          font-family: inherit;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--bg-elevated); }
        .notif-item.unread { background: rgba(99,102,241,0.04); }
        .notif-unread-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--brand-500);
          flex-shrink: 0;
          margin-top: 5px;
        }
      `}</style>
    </div>
  )
}
