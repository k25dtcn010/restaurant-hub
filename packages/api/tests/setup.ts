// Test setup file - loads environment before any other modules
// IMPORTANT: Set DATABASE_URL BEFORE importing any database modules
const dbPath = "/home/runner/work/restaurant-hub/restaurant-hub/packages/db/local.db";

// Set environment variables BEFORE any imports
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.BETTER_AUTH_SECRET = "test-secret-key-for-development-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.CORS_ORIGIN = "http://localhost:3001";
process.env.NODE_ENV = "test";

console.log("📝 Test environment configured. DATABASE_URL:", process.env.DATABASE_URL);
