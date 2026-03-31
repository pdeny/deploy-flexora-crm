'use client'

import { useState, useTransition } from 'react'
import { createApiKey, deleteApiKey } from '@/lib/actions/apikeys'
import { formatRelative } from '@/lib/utils'

type KeyMeta = {
  id: string
  name: string
  prefix: string
  lastUsedAt: Date | null
  createdAt: Date
}

type Props = {
  workspaceId: string
  initialKeys: KeyMeta[]
}

export default function ApiKeysPanel({ workspaceId, initialKeys }: Props) {
  const [keys, setKeys] = useState<KeyMeta[]>(initialKeys)
  const [newName, setNewName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createApiKey(workspaceId, newName)
      if ('error' in res) { setError(res.error); return }
      const { key, id } = res
      setKeys(prev => [
        { id, name: newName.trim(), prefix: res.prefix, lastUsedAt: null, createdAt: new Date() },
        ...prev,
      ])
      setRevealedKey({ id, key })
      setNewName('')
    })
  }

  function handleDelete(keyId: string) {
    setDeletingId(keyId)
    startTransition(async () => {
      await deleteApiKey(keyId)
      setKeys(prev => prev.filter(k => k.id !== keyId))
      if (revealedKey?.id === keyId) setRevealedKey(null)
      setDeletingId(null)
    })
  }

  function copyKey() {
    if (!revealedKey) return
    navigator.clipboard.writeText(revealedKey.key).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>API Keys</div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>
          Use API keys to access this workspace&apos;s data programmatically via the REST API.
          Keys are scoped to this workspace. Keep them secret.
        </p>
      </div>

      {/* Create key form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Key name (e.g. Production, Zapier)"
          style={{ flex: 1 }}
          required
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending || !newName.trim()}>
          {isPending ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Creating…</> : '+ Generate'}
        </button>
      </form>
      {error && <p style={{ fontSize: 12, color: 'var(--error)', margin: '-12px 0 0' }}>{error}</p>}

      {/* Revealed key banner */}
      {revealedKey && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(16,185,129,0.07)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 10,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>
              Copy your key now — it won&apos;t be shown again.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{
              flex: 1, fontSize: 12, fontFamily: 'monospace',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 6, padding: '6px 10px', color: 'var(--brand-400)',
              wordBreak: 'break-all',
            }}>
              {revealedKey.key}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={copyKey} style={{ flexShrink: 0, fontSize: 11 }}>
              {copiedKey ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setRevealedKey(null)} style={{ flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div style={{
          padding: '28px 0', textAlign: 'center',
          color: 'var(--text-tertiary)', fontSize: 13,
          border: '1px dashed var(--border-subtle)', borderRadius: 10,
        }}>
          No API keys yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {keys.map(k => (
            <div
              key={k.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{k.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  <code style={{ fontFamily: 'monospace', color: 'var(--text-disabled)' }}>{k.prefix}…</code>
                  {' · '}created {formatRelative(k.createdAt)}
                  {k.lastUsedAt && <> · last used {formatRelative(k.lastUsedAt)}</>}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => handleDelete(k.id)}
                disabled={deletingId === k.id}
                style={{ color: 'var(--error)', opacity: 0.7 }}
                title="Revoke key"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* API reference */}
      <div style={{
        padding: '16px 18px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.7,
        color: 'var(--text-tertiary)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Quick reference</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['GET', `/api/v1/workspaces/{workspaceId}/apps`, 'List apps'],
            ['GET', `/api/v1/apps/{appId}/items`, 'List items (limit, offset)'],
            ['POST', `/api/v1/apps/{appId}/items`, 'Create item {title, data}'],
            ['GET', `/api/v1/apps/{appId}/items/{itemId}`, 'Get item'],
            ['PATCH', `/api/v1/apps/{appId}/items/{itemId}`, 'Update item {title?, data?}'],
            ['DELETE', `/api/v1/apps/{appId}/items/{itemId}`, 'Delete item'],
          ].map(([method, path, desc]) => (
            <div key={path} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 10, fontWeight: 800,
                color: method === 'GET' ? '#06b6d4' : method === 'POST' ? '#10b981' : method === 'PATCH' ? '#f59e0b' : '#ef4444',
                minWidth: 44,
              }}>{method}</span>
              <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--brand-300)', flex: 1 }}>{path}</code>
              <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{desc}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-disabled)' }}>
          All endpoints require: <code style={{ fontFamily: 'monospace' }}>Authorization: Bearer &lt;api_key&gt;</code>
        </div>
      </div>
    </div>
  )
}
