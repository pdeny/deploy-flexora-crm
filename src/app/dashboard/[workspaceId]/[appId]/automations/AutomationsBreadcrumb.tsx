'use client'

import Link from 'next/link'
import { useT } from '@/contexts/LanguageContext'

type Props = {
  workspaceId: string
  appId: string
  workspaceName: string
  appEmoji: string
  appName: string
}

export default function AutomationsBreadcrumb({ workspaceId, appId, workspaceName, appEmoji, appName }: Props) {
  const { t } = useT()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px',
      borderBottom: '1px solid var(--border-subtle)', fontSize: 13,
      color: 'var(--text-tertiary)', flexShrink: 0,
    }}>
      <Link href={`/dashboard/${workspaceId}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
        {workspaceName}
      </Link>
      <span>/</span>
      <Link href={`/dashboard/${workspaceId}/${appId}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
        {appEmoji} {appName}
      </Link>
      <span>/</span>
      <span style={{ color: 'var(--text-secondary)' }}>{t('auto.title')}</span>
    </div>
  )
}
