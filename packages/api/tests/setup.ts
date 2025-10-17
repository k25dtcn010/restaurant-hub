// Test setup file - loads environment before any other modules
// Set DATABASE_URL before any imports
process.env.DATABASE_URL = "file:/home/runner/work/restaurant-hub/restaurant-hub/packages/db/local.db";
process.env.BETTER_AUTH_SECRET = "test-secret-key-for-development-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.CORS_ORIGIN = "http://localhost:3001";

console.log("📝 Test environment configured. DATABASE_URL:", process.env.DATABASE_URL);
