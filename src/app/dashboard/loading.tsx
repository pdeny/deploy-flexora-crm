export default function DashboardLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      gap: '0.75rem',
    }}>
      <div
        className="spinner"
        style={{
          width: '1.5rem',
          height: '1.5rem',
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--brand-500)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }}
      />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
