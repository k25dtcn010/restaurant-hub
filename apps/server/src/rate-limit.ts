/**
 * T143: Rate Limiting for Public Endpoints
 * Reference: Constitution security standards
 *
 * Prevents abuse of public endpoints (e.g., orders.create)
 * Uses in-memory store for simplicity (suitable for single-instance deployment)
 * For production with multiple instances, use Redis-backed rate limiter
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const key in store) {
      if (store[key].resetTime < now) {
        delete store[key]
      }
    }
  },
  5 * 60 * 1000
)

/**
 * Rate limiter middleware
 * @param max Maximum requests allowed in window
 * @param windowMs Time window in milliseconds
 * @returns Middleware function
 */
export function rateLimit(max: number = 100, windowMs: number = 60000) {
  return async (c: any, next: () => Promise<void>) => {
    // Use IP address as identifier
    const identifier = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"

    const key = `${identifier}:${c.req.path}`
    const now = Date.now()

    // Initialize or get existing record
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      }
    } else {
      store[key].count++
    }

    // Check if limit exceeded
    const record = store[key]
    if (record && record.count > max) {
      c.status(429)
      return c.json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      })
    }

    // Add rate limit headers
    c.header("X-RateLimit-Limit", max.toString())
    c.header("X-RateLimit-Remaining", (max - store[key].count).toString())
    c.header("X-RateLimit-Reset", Math.ceil(store[key].resetTime / 1000).toString())

    await next()
  }
}

/**
 * Public endpoint rate limiter (stricter limits)
 */
export const publicRateLimit = rateLimit(
  Number(process.env.RATE_LIMIT_MAX) || 100,
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000
)

/**
 * Authenticated endpoint rate limiter (more generous limits)
 */
export const authRateLimit = rateLimit(
  Number(process.env.AUTH_RATE_LIMIT_MAX) || 300,
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000
)
