// Test setup file - loads environment before any other modules
// IMPORTANT: Set DATABASE_URL BEFORE importing any database modules
import "dotenv/config"

import type { WebSocketNotifier } from "@/api/context"

// Set environment variables BEFORE any imports
process.env.NODE_ENV = "test"

console.log("📝 Test environment configured. DATABASE_URL:", process.env.DATABASE_URL)

// Mock WebSocket notifier for tests (no-op implementation)
export const mockWsNotifier: WebSocketNotifier = {
  notifyKitchen: () => {},
  notifyOrderStatusChanged: () => {},
}
