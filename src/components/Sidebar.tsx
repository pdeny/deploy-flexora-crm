'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/auth'
import type { Workspace, User } from '@/generated/prisma'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useT } from '@/contexts/LanguageContext'
import { ChatPanel } from '@/components/ChatPanel'

export default function Sidebar({ user, workspaces }: { user: User; workspaces: Workspace[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useT()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatWorkspaceId, setChatWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    const toggle = () => setMobileOpen(o => !o)
    document.addEventListener('toggle-sidebar', toggle)
    return () => document.removeEventListener('toggle-sidebar', toggle)
  }, [])

  // Close sidebar on route change on mobile
  useEffect(() => {
    const t = setTimeout(() => setMobileOpen(false), 0)
    return () => clearTimeout(t)
  }, [pathname])

  const activeWorkspace = workspaces.find(ws => pathname.startsWith(`/dashboard/${ws.id}`))
  const chatWorkspace = chatWorkspaceId ? workspaces.find(ws => ws.id === chatWorkspaceId) : null

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-mobile-backdrop" onClick={() => setMobileOpen(false)} />
      )}
      {chatWorkspace && (
        <ChatPanel
          workspaceId={chatWorkspace.id}
          workspaceName={chatWorkspace.name}
          currentUserId={user.id}
          onClose={() => setChatWorkspaceId(null)}
        />
      )}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <Link href="/dashboard" className="sidebar-logo">
          <div className="sidebar-logo-mark">✦</div>
          <span className="sidebar-logo-text">Flexora</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/dashboard"
          className={`sidebar-link ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          <span className="link-icon" style={{ fontSize: 15 }}>⊞</span>
          {t('sidebar.allWorkspaces')}
        </Link>

        {workspaces.length > 0 && (
          <>
            <div className="sidebar-section-label">{t('sidebar.workspaces')}</div>
            {workspaces.map(ws => {
              const isActive = pathname.startsWith(`/dashboard/${ws.id}`)
              return (
                <div key={ws.id}>
                  <Link
                    href={`/dashboard/${ws.id}`}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    style={{ '--ws-color': ws.color } as React.CSSProperties}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{ws.iconEmoji}</span>
                    <span className="truncate">{ws.name}</span>
                    {isActive && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ws.color, marginLeft: 'auto', flexShrink: 0 }} />
                    )}
                  </Link>
                  {isActive && (
                    <>
                      <Link
                        href={`/dashboard/${ws.id}/settings`}
                        className={`sidebar-link sidebar-sub-link ${pathname === `/dashboard/${ws.id}/settings` ? 'active' : ''}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }}>
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M12 2v2M12 20v2M2 12h2M20 12h2"/>
                        </svg>
                        <span style={{ fontSize: 12 }}>{t('sidebar.settings')}</span>
                      </Link>
                      <button
                        onClick={() => setChatWorkspaceId(chatWorkspaceId === ws.id ? null : ws.id)}
                        className={`sidebar-link sidebar-sub-link${chatWorkspaceId === ws.id ? ' active' : ''}`}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span style={{ fontSize: 12 }}>{t('sidebar.chat')}</span>
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => router.push('/dashboard/profile')} style={{ cursor: 'pointer' }} title={t('sidebar.profile')}>
          <div className="sidebar-avatar">
            {(user.name ?? user.email)[0].toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name truncate">{user.name ?? user.email}</div>
            <div className="sidebar-user-email truncate">{user.email}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title={t('sidebar.signOut')}
              className="sidebar-logout-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .sidebar-footer {
          padding: 10px 12px;
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }
        .sidebar-user:hover { background: var(--bg-hover); }
        .sidebar-avatar {
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
          letter-spacing: 0;
        }
        .sidebar-user-info {
          flex: 1;
          min-width: 0;
        }
        .sidebar-user-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .sidebar-user-email {
          font-size: 11px;
          color: var(--text-tertiary);
          line-height: 1.3;
        }
        .sidebar-logout-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast), background var(--transition-fast);
          flex-shrink: 0;
        }
        .sidebar-logout-btn:hover {
          color: var(--text-primary);
          background: var(--bg-overlay);
        }
        .sidebar-sub-link {
          padding-left: 28px !important;
          font-size: 12px !important;
        }
      `}</style>
    </aside>
    </>
  )
}
