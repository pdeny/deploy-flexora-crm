'use client'

import Link from 'next/link'
import CreateAppButton from '@/components/CreateAppButton'
import { formatRelative } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'

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
}: Props) {
  const { t } = useT()

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
        <div className="page-header-actions">
          <CreateAppButton workspaceId={workspaceId} />
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
                    <div className="app-item-count">{t('ws.itemCount', { n: app.itemCount })}</div>
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

      <style>{`
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
