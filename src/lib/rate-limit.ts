const hits = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of hits) {
    if (val.resetAt < now) hits.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Simple in-memory rate limiter.
 * Returns { success: true } if allowed, { success: false, retryAfter } if exceeded.
 */
export function rateLimit(
  key: string,
  { limit = 60, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { success: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true }
  }

  entry.count++
  if (entry.count > limit) {
    return { success: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  return { success: true }
}
