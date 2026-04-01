'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CreateWorkspaceButton from '@/components/CreateWorkspaceButton'
import { duplicateWorkspace } from '@/lib/actions/workspace'
import { formatRelative } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'

type WorkspaceData = {
  id: string
  name: string
  description: string | null
  color: string
  iconEmoji: string
  apps: { _count: { items: number } }[]
  members: { id: string }[]
}

type RecentItem = {
  id: string
  title: string
  appId: string
  updatedAt: Date
  app: {
    name: string
    iconEmoji: string
    color: string
    workspace: { id: string; name: string }
  }
}

type Props = {
  userName: string
  memberships: { workspace: WorkspaceData; role: string }[]
  recentItems: RecentItem[]
  totalApps: number
  totalItems: number
}

export default function DashboardContent({ userName, memberships, recentItems, totalApps, totalItems }: Props) {
  const { t } = useT()
  const router = useRouter()
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDuplicate(e: React.MouseEvent, workspaceId: string) {
    e.preventDefault()
    e.stopPropagation()
    setDuplicatingId(workspaceId)
    startTransition(async () => {
      const result = await duplicateWorkspace(workspaceId)
      setDuplicatingId(null)
      if ('workspace' in result && result.workspace) {
        router.push(`/dashboard/${result.workspace.id}`)
      }
    })
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.welcome', { name: userName })}</h1>
          <p className="page-subtitle">{t('dashboard.overview')}</p>
        </div>
        <div className="page-header-actions">
          <CreateWorkspaceButton />
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏗️</div>
          <h2 className="empty-state-title">{t('dashboard.noWorkspaces')}</h2>
          <p className="empty-state-desc">{t('dashboard.noWorkspacesDesc')}</p>
          <CreateWorkspaceButton />
        </div>
      ) : (
        <>
          {/* Global stats */}
          <div className="dash-stats-row">
            {[
              { icon: '🏢', label: t('dashboard.stat.workspaces'), value: memberships.length },
              { icon: '📱', label: t('dashboard.stat.apps'),       value: totalApps },
              { icon: '📄', label: t('dashboard.stat.items'),      value: totalItems },
            ].map(s => (
              <div key={s.label} className="dash-stat-card">
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="dash-content-grid">
            {/* Workspace cards */}
            <div>
              <h2 className="dash-section-title">{t('dashboard.section.workspaces')}</h2>
              <div className="grid-auto">
                {memberships.map(({ workspace, role }) => (
                  <Link key={workspace.id} href={`/dashboard/${workspace.id}`} className="workspace-card" style={{ '--ws-color': workspace.color } as React.CSSProperties}>
                    <div className="ws-card-header">
                      <div className="ws-emoji">{workspace.iconEmoji}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="ws-dup-btn"
                          title={t('dashboard.duplicateWorkspace')}
                          onClick={(e) => handleDuplicate(e, workspace.id)}
                          disabled={isPending && duplicatingId === workspace.id}
                        >
                          {isPending && duplicatingId === workspace.id ? (
                            <span className="spinner" style={{ width: 12, height: 12 }} />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                        <span className="badge badge-default">{role}</span>
                      </div>
                    </div>
                    <h3 className="ws-name">{workspace.name}</h3>
                    {workspace.description && <p className="ws-desc">{workspace.description}</p>}
                    <div className="ws-stats">
                      <span>📱 {workspace.apps.length} apps</span>
                      <span>👥 {workspace.members.length} members</span>
                      <span>📄 {workspace.apps.reduce((s, a) => s + a._count.items, 0)} items</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent items */}
            {recentItems.length > 0 && (
              <div>
                <h2 className="dash-section-title">{t('dashboard.section.recent')}</h2>
                <div className="dash-recent-list">
                  {recentItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/dashboard/${item.app.workspace.id}/${item.appId}/${item.id}`}
                      className="dash-recent-item"
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: item.app.color + '20', border: `1px solid ${item.app.color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>{item.app.iconEmoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{item.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {item.app.workspace.name} · {item.app.name} · {formatRelative(item.updatedAt)}
                        </div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-disabled)', flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .dash-stats-row {
          display: flex;
          gap: 14px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .dash-stat-card {
          flex: 1;
          min-width: 130px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .dash-content-grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .dash-section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        .dash-recent-list {
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .dash-recent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          text-decoration: none;
          color: inherit;
          transition: background var(--transition-fast);
          border-bottom: 1px solid var(--border-subtle);
        }
        .dash-recent-item:last-child { border-bottom: none; }
        .dash-recent-item:hover { background: var(--bg-elevated); }
        .workspace-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 20px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-normal);
          cursor: pointer;
        }
        .workspace-card:hover {
          border-color: var(--ws-color, var(--brand-500));
          box-shadow: 0 0 0 1px var(--ws-color, var(--brand-500)), 0 8px 30px rgba(0,0,0,0.3);
          transform: translateY(-2px);
        }
        .ws-card-header { display: flex; align-items: center; justify-content: space-between; }
        .ws-emoji { width: 44px; height: 44px; background: var(--bg-elevated); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 22px; border: 1px solid var(--border-subtle); }
        .ws-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
        .ws-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ws-stats { display: flex; gap: 14px; font-size: 12px; color: var(--text-tertiary); margin-top: auto; flex-wrap: wrap; }
        .ws-dup-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
          opacity: 0;
        }
        .workspace-card:hover .ws-dup-btn { opacity: 1; }
        .ws-dup-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-subtle); }
      `}</style>
    </div>
  )
}
