'use client'

import Link from 'next/link'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  workspaceId: string
  workspaceEmoji: string
  workspaceName: string
}

export default function SettingsPageHeader({ workspaceId, workspaceEmoji, workspaceName }: Props) {
  const { t } = useT()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Link
          href={`/dashboard/${workspaceId}`}
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {workspaceEmoji} {workspaceName}
        </Link>
        <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('settings.breadcrumb')}</span>
      </div>
      <h1 className="page-title">{t('settings.wsTitle')}</h1>
    </div>
  )
}
