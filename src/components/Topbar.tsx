'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/generated/prisma'
import NotificationBell from '@/components/NotificationBell'
import SearchModal from '@/components/SearchModal'

type NotificationItem = {
  id: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: Date
}

type Props = {
  user: User
  notifications: NotificationItem[]
  unreadCount: number
}

export default function Topbar({ user, notifications, unreadCount }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('flexora-theme') as 'dark' | 'light' | null) ?? 'dark'
  })

  // Sync data-theme attribute whenever theme changes
  useEffect(() => {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('flexora-theme', next)
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }

  return (
    <header className="topbar">
      <button
        className="topbar-hamburger"
        aria-label="Toggle sidebar"
        onClick={() => document.dispatchEvent(new CustomEvent('toggle-sidebar'))}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="topbar-breadcrumb">
        <span className="crumb-active" style={{ fontWeight: 700, letterSpacing: '-0.2px' }}>Flexora</span>
      </div>
      <div className="topbar-actions">
        <SearchModal />
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <button
          className="btn btn-ghost btn-sm btn-icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ color: 'var(--text-tertiary)', width: 28, height: 28 }}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          title="Keyboard shortcuts (?)"
          style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 700, width: 28, height: 28 }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
        >?</button>
        <div className="topbar-avatar" title={user.name ?? user.email}>
          {(user.name ?? user.email)[0].toUpperCase()}
        </div>
      </div>
    </header>
  )
}
