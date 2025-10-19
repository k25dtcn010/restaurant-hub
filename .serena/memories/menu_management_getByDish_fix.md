# Menu Management - modifiers.getByDish Fix

## Problem
The `modifiers.getByDish` endpoint was failing with a Drizzle ORM query generation error when calling:
```
http://localhost:3000/trpc/modifiers.getByDish?batch=1&input=%7B%220%22%3A%7B%22dishId%22%3A2%7D%7D
```

Error message:
```
Failed query: select json_array(...) from (...) where ... limit ?
params: 1,1,2
```

The issue was caused by Drizzle ORM 0.44.6 generating invalid SQL with `json_array()` functions when using the `with: { modifier: true, modifierGroup: true }` clause on SQLite databases.

## Solution
Refactored the `getByDish` query to manually fetch relationships instead of using Drizzle's `with` clause:

1. Fetch the join table (`dishModifiers`) without relationships
2. Extract unique IDs for modifiers and modifier groups
3. Fetch modifiers and modifier groups separately using `inArray()` 
4. Create lookup maps for efficient grouping
5. Manually build the grouped response

## Changes Made
**File**: `apps/server/src/api/routers/modifiers.ts`

- Added `inArray` to imports from `@/db`
- Rewrote the `getByDish` query handler to avoid the problematic `with` clause
- Changed from relationship eager-loading to manual separate queries with lookup maps

## Testing
- All 34 modifier-related tests pass ✅
- T030-1 test specifically validates the getByDish functionality works correctly
- T030-2 test validates empty array response for dishes with no modifiers

## Result
The menu management page now works correctly when fetching modifiers for dishes.
