import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateWorkspaceButton from '@/components/CreateWorkspaceButton'

export default async function DashboardPage() {
  let user
  try { user = await requireUser() } catch { redirect('/login') }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { apps: true, members: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user.name?.split(' ')[0] ?? 'there'} 👋</h1>
          <p className="page-subtitle">Select a workspace to get started, or create a new one.</p>
        </div>
        <div className="page-header-actions">
          <CreateWorkspaceButton />
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏗️</div>
          <h2 className="empty-state-title">No workspaces yet</h2>
          <p className="empty-state-desc">Create your first workspace to start building apps, managing data, and collaborating with your team.</p>
          <CreateWorkspaceButton />
        </div>
      ) : (
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
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .workspace-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
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
        .ws-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ws-emoji {
          width: 44px; height: 44px;
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          border: 1px solid var(--border-subtle);
        }
        .ws-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .ws-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ws-stats {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: auto;
        }
      `}</style>
    </div>
  )
}
