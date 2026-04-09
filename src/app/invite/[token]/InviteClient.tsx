'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from '@/lib/actions/settings'

type Props =
  | { status: 'expired' }
  | { status: 'wrong-email'; inviteEmail: string }
  | { status: 'pending'; token: string; workspaceName: string; workspaceEmoji: string; invitedByName: string }

export default function InviteClient(props: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    if (props.status !== 'pending') return
    setError('')
    startTransition(async () => {
      const result = await acceptInvite(props.token)
      if ('error' in result) {
        setError(result.error ?? 'Unknown error')
      } else {
        router.push(`/dashboard/${result.workspaceId}`)
      }
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-base)',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: '40px 36px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}>
        {props.status === 'expired' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Invite Expired</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This invite link is no longer valid. Please ask the workspace admin to send a new one.
            </p>
            <a href="/login" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
              Go to Login
            </a>
          </>
        )}

        {props.status === 'wrong-email' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Wrong Account</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This invite was sent to <strong>{props.inviteEmail}</strong>. Please log in with that email to accept.
            </p>
            <a href="/login" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
              Switch Account
            </a>
          </>
        )}

        {props.status === 'pending' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{props.workspaceEmoji}</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
              Join {props.workspaceName}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              <strong>{props.invitedByName}</strong> has invited you to collaborate on this workspace.
            </p>
            {error && <p style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{error}</p>}
            <button
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={isPending}
              style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '10px 20px' }}
            >
              {isPending ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Joining…</>
              ) : (
                'Accept Invite'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
