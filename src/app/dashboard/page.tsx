import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateWorkspaceButton from '@/components/CreateWorkspaceButton'
import { formatRelative } from '@/lib/utils'

export default async function DashboardPage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const [memberships, recentItems] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: { include: { apps: { include: { _count: { select: { items: true } } } }, members: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.item.findMany({
      where: { app: { workspace: { members: { some: { userId: user.id } } } } },
      include: { app: { include: { workspace: true } }, creator: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ])

  const totalApps  = memberships.reduce((s, m) => s + m.workspace.apps.length, 0)
  const totalItems = memberships.reduce((s, m) => s + m.workspace.apps.reduce((ss, a) => ss + a._count.items, 0), 0)

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user.name?.split(' ')[0] ?? 'there'} 👋</h1>
          <p className="page-subtitle">Here&apos;s an overview of your workspaces.</p>
        </div>
        <div className="page-header-actions">
          <CreateWorkspaceButton />
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏗️</div>
          <h2 className="empty-state-title">No workspaces yet</h2>
          <p className="empty-state-desc">Create your first workspace to start building apps and managing data.</p>
          <CreateWorkspaceButton />
        </div>
      ) : (
        <>
          {/* Global stats */}
          <div className="dash-stats-row">
            {[
              { icon: '🏢', label: 'Workspaces', value: memberships.length },
              { icon: '📱', label: 'Apps',        value: totalApps },
              { icon: '📄', label: 'Items',       value: totalItems },
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
              <h2 className="dash-section-title">Workspaces</h2>
              <div className="grid-auto">
                {memberships.map(({ workspace, role }) => (
                  <Link key={workspace.id} href={`/dashboard/${workspace.id}`} className="workspace-card" style={{ '--ws-color': workspace.color } as React.CSSProperties}>
                    <div className="ws-card-header">
                      <div className="ws-emoji">{workspace.iconEmoji}</div>
                      <span className="badge badge-default">{role}</span>
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
                <h2 className="dash-section-title">Recent Items</h2>
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
      `}</style>
    </div>
  )
}
