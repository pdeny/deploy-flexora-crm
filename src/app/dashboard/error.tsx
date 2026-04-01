'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      gap: '1rem',
      textAlign: 'center',
    }}>
      <div style={{
        width: '3rem',
        height: '3rem',
        borderRadius: '50%',
        background: 'rgba(244,63,94,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
      }}>
        !
      </div>
      <h2 style={{
        fontFamily: 'var(--font-heading, Syne, sans-serif)',
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
      }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '24rem' }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1.25rem',
          background: 'var(--brand-500)',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Try again
      </button>
    </div>
  )
}
