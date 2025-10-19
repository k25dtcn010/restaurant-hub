# Test Failures Analysis - 156 Failed Out of 162 Tests

## Root Cause

The tests are failing because **database tables do not exist** when tests run. The in-memory SQLite database is created but not initialized with schema tables.

### Key Issues:

1. **Missing Schema Migration**: Tests rely on `setup.ts` preload which only sets up environment variables and mocks
2. **No Automatic Migration**: Database initialization doesn't run `drizzle-kit migrate` automatically before tests
3. **Database State**: Using `file::memory:?cache=shared` but tables are never created
4. **Error Pattern**: All tests fail with `LibsqlError: SQLITE_ERROR: no such table: <table_name>`

## Error Examples:

- `no such table: user` - trying to find users
- `no such table: tables` - trying to find tables
- `no such table: orders` - trying to query orders
- etc.

## Migration Files Present

- `apps/server/src/db/migrations/0000_lonely_old_lace.sql` - contains schema creation DDL
- `apps/server/src/db/migrations/0001_romantic_switch.sql` - contains additional schema changes

## Current Test Setup

- `bunfig.toml` preloads `tests/setup.ts`
- `setup.ts` sets `NODE_ENV=test` but doesn't initialize database schema
- Tests have `beforeAll` hooks that try to insert data, but fail because tables don't exist yet

## Solution

The test setup needs to:

1. Load and execute migration files before any tests run
2. OR use `drizzle-kit migrate` programmatically in test setup
3. OR apply schema definitions directly via Drizzle ORM before tests start

This ensures all database tables are created before any test tries to query them.
