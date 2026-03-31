import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import CreateAppButton from '@/components/CreateAppButton'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const { workspaceId } = await params

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      apps: { include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'asc' } },
      members: { include: { user: true } },
    },
  })
  if (!workspace) notFound()

  const isMember = workspace.members.some(m => m.userId === user.id)
  if (!isMember) redirect('/dashboard')

  const recentItems = await prisma.item.findMany({
    where: { app: { workspaceId } },
    include: { app: true, creator: true },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  })

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <div className="ws-page-title-row">
            <span className="ws-page-emoji">{workspace.iconEmoji}</span>
            <h1 className="page-title">{workspace.name}</h1>
          </div>
          {workspace.description && <p className="page-subtitle">{workspace.description}</p>}
        </div>
        <div className="page-header-actions">
          <CreateAppButton workspaceId={workspaceId} />
        </div>
      </div>

      {/* Stats row */}
      <div className="ws-stats-row">
        {[
          { label: 'Apps', value: workspace.apps.length, icon: '📱' },
          { label: 'Members', value: workspace.members.length, icon: '👥' },
          { label: 'Items', value: workspace.apps.reduce((s, a) => s + a._count.items, 0), icon: '📄' },
        ].map(stat => (
          <div key={stat.label} className="ws-stat-card">
            <span className="ws-stat-icon">{stat.icon}</span>
            <div>
              <div className="ws-stat-value">{stat.value}</div>
              <div className="ws-stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ws-content-grid">
        {/* Apps section */}
        <div className="ws-section">
          <div className="ws-section-header">
            <h2 className="ws-section-title">Apps</h2>
            <CreateAppButton workspaceId={workspaceId} compact />
          </div>
          {workspace.apps.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📱</div>
              <p className="empty-state-title">No apps yet</p>
              <p className="empty-state-desc">Create your first app to start organising data.</p>
            </div>
          ) : (
            <div className="apps-grid">
              {workspace.apps.map(app => (
                <Link key={app.id} href={`/dashboard/${workspaceId}/${app.id}`} className="app-card" style={{ '--app-color': app.color } as React.CSSProperties}>
                  <div className="app-card-top">
                    <div className="app-emoji-bg" style={{ background: `${app.color}22`, border: `1px solid ${app.color}44` }}>
                      <span className="app-emoji">{app.iconEmoji}</span>
                    </div>
                    <div className="app-item-count">{app._count.items} items</div>
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
          <h2 className="ws-section-title">Recent Activity</h2>
          {recentItems.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '20px 0' }}>No activity yet.</p>
          ) : (
            <div className="activity-feed">
              {recentItems.map(item => (
                <Link key={item.id} href={`/dashboard/${workspaceId}/${item.appId}/${item.id}`} className="activity-item">
                  <div className="activity-dot" style={{ background: item.app.color }} />
                  <div className="activity-body">
                    <div className="activity-title">{item.title}</div>
                    <div className="activity-meta">
                      <span className="activity-app">{item.app.iconEmoji} {item.app.name}</span>
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
        <h2 className="ws-section-title">Members ({workspace.members.length})</h2>
        <div className="members-row">
          {workspace.members.map(m => (
            <div key={m.id} className="member-chip">
              <div className="member-avatar">{(m.user.name ?? m.user.email)[0].toUpperCase()}</div>
              <div>
                <div className="member-name">{m.user.name ?? m.user.email}</div>
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
        @media (max-width: 900px) { .ws-content-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
