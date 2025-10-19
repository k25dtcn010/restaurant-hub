import "dotenv/config"

import { trpcServer } from "@hono/trpc-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { auth } from "@/auth"

import { createContext } from "@/api/context"
import { appRouter } from "@/api/routers"

import { publicRateLimit } from "./rate-limit"
import {
  createWebSocketHandler,
  getConnectionStats,
  notifyKitchen,
  notifyOrderStatusChanged,
  websocket,
} from "./websocket"

export type { AppRouter } from "@/api/routers"

/**
 * RestaurantHub Backend Server
 * Hono 4.8+ with tRPC 11.5+ integration
 * Reference: plan.md Task 1.6 - Setup tRPC Infrastructure
 *
 * Endpoints:
 * - GET  /                  - Health check
 * - *    /api/auth/*        - Better-Auth authentication endpoints
 * - *    /trpc/*            - tRPC API endpoints
 * - WS   /ws                - WebSocket for real-time notifications
 * - GET  /ws/stats          - WebSocket connection statistics
 *
 * Security:
 * - T145: Environment-specific CORS policies
 * - T146: Security headers (HSTS, CSP, X-Frame-Options)
 * - T144: CSRF protection via Better-Auth
 */
const app = new Hono()

// Request logging middleware
app.use(logger())

/**
 * T146: Security Headers
 * Reference: Constitution security standards
 * https://owasp.org/www-project-secure-headers/
 */
app.use("/*", async (c, next) => {
  await next()

  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }

  // CSP - Content Security Policy
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:"
  )

  // X-Frame-Options - Prevent clickjacking
  c.header("X-Frame-Options", "DENY")

  // X-Content-Type-Options - Prevent MIME sniffing
  c.header("X-Content-Type-Options", "nosniff")

  // Referrer-Policy - Control referrer information
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions-Policy - Control browser features
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
})

/**
 * T145: Environment-Specific CORS Configuration
 * Development: Allow localhost:3001
 * Production: Use CORS_ORIGIN env variable
 *
 * T144: CSRF Protection
 * Better-Auth provides CSRF tokens automatically via httpOnly cookies
 */
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Required for Better-Auth cookies
  })
)

// Better-Auth authentication handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))

/**
 * T143: Rate Limiting for tRPC Endpoints
 * Public endpoints: 100 requests per minute per IP
 * Authenticated endpoints inherit from tRPC context protection
 */
app.use("/trpc/*", publicRateLimit)

// tRPC server with context injection including WebSocket notifier
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({
        context,
        wsNotifier: {
          notifyKitchen,
          notifyOrderStatusChanged,
        },
      })
    },
  })
)

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
})

// WebSocket connection statistics (for monitoring)
app.get("/ws/stats", (c) => {
  return c.json(getConnectionStats())
})

// WebSocket endpoint for real-time notifications
// Query parameter 'role' determines event types: kitchen, serving, manager
// Example: ws://localhost:3000/ws?role=kitchen
app.get("/ws", createWebSocketHandler())

// Export for Bun server with WebSocket support
// Reference: https://hono.dev/docs/helpers/websocket#bun-with-jsx
export default {
  fetch: app.fetch,
  websocket,
}
