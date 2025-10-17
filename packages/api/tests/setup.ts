// Test setup file - loads environment before any other modules
// IMPORTANT: Set DATABASE_URL BEFORE importing any database modules
const dbPath = "/home/runner/work/restaurant-hub/restaurant-hub/packages/db/local.db";
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.BETTER_AUTH_SECRET = "test-secret-key-for-development-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.CORS_ORIGIN = "http://localhost:3001";

console.log("📝 Test environment configured. DATABASE_URL:", process.env.DATABASE_URL);

// Apply database schema using SQL migration
import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";

try {
	const migrationFile = "/home/runner/work/restaurant-hub/restaurant-hub/packages/db/src/migrations/0000_lonely_old_lace.sql";
	
	// Remove existing database to start fresh for tests
	if (existsSync(dbPath)) {
		unlinkSync(dbPath);
	}
	
	// Apply migration using sqlite3
	if (existsSync(migrationFile)) {
		execSync(`sqlite3 ${dbPath} < ${migrationFile}`, { stdio: 'inherit' });
		console.log("✅ Database schema initialized for tests");
	} else {
		console.warn("⚠️  Migration file not found, tests may fail");
	}
} catch (error) {
	console.error("❌ Failed to initialize database schema:", error);
	// Don't throw - let tests handle missing tables
}
