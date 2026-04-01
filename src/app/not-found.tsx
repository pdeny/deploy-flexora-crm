import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      gap: '1rem',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-heading, Syne, sans-serif)',
        fontSize: '4rem',
        fontWeight: 800,
        background: 'linear-gradient(135deg, var(--brand-400), var(--accent-violet))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        404
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>
        Page not found
      </p>
      <Link
        href="/dashboard"
        style={{
          marginTop: '0.5rem',
          padding: '0.625rem 1.5rem',
          background: 'var(--brand-500)',
          color: '#fff',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
