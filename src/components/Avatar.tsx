type AvatarProps = {
  name: string | null
  email: string
  avatarUrl?: string | null
  size?: number
  radius?: number
}

/**
 * Displays a user's avatar photo, falling back to initials if no photo is set.
 * Works in both server and client components.
 */
export function Avatar({ name, email, avatarUrl, size = 28, radius = 8 }: AvatarProps) {
  const initial = (name ?? email)[0].toUpperCase()
  const fontSize = Math.round(size * 0.4)

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? email}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(135deg, var(--brand-600), var(--accent-violet))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}
