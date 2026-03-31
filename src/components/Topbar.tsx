'use client'

import type { User } from '@/generated/prisma'

export default function Topbar({ user }: { user: User }) {
  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <span className="crumb-active" style={{ fontWeight: 700, letterSpacing: '-0.2px' }}>Flexora</span>
      </div>
      <div className="topbar-actions">
        <div className="topbar-avatar" title={user.name ?? user.email}>
          {(user.name ?? user.email)[0].toUpperCase()}
        </div>
      </div>
    </header>
  )
}
