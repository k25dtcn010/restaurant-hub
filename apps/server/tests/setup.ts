// Test setup file - loads environment before any other modules
// IMPORTANT: Set DATABASE_URL BEFORE importing any database modules
import "dotenv/config"

import { readFileSync } from "fs"
import { join } from "path"
import { createClient } from "@libsql/client"

import type { WebSocketNotifier } from "@/api/context"

// Set environment variables BEFORE any imports
process.env.NODE_ENV = "test"
// Use separate test database to avoid polluting development database
// Use absolute path from project root
// setup.ts is at apps/server/tests/setup.ts, so go up 3 levels
const projectRoot = new URL("../../..", import.meta.url).pathname
process.env.DATABASE_URL = `file:${projectRoot}/local.test.db`

console.log("📝 Test environment configured. DATABASE_URL:", process.env.DATABASE_URL)

// Initialize database schema by running migrations
async function initializeTestDatabase() {
  try {
    const client = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })

    // Read and execute migration file
    const migrationPath = join(projectRoot, "apps/server/src/db/migrations/0000_modern_morlun.sql")
    const migrationSql = readFileSync(migrationPath, "utf-8")

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    console.log(`🗄️  Running ${statements.length} migration statements...`)

    for (const statement of statements) {
      try {
        await client.execute(statement)
      } catch (error) {
        // Ignore "table already exists" errors
        if (error instanceof Error && error.message.includes("already exists")) {
          console.log(`⏭️  Table already exists, skipping...`)
        } else {
          throw error
        }
      }
    }

    console.log("✅ Test database initialized successfully")
  } catch (error) {
    console.error("❌ Failed to initialize test database:", error)
    throw error
  }
}

// Mock WebSocket notifier for tests (no-op implementation)
export const mockWsNotifier: WebSocketNotifier = {
  notifyKitchen: () => {},
  notifyOrderStatusChanged: () => {},
}

// Run initialization before tests
await initializeTestDatabase()
