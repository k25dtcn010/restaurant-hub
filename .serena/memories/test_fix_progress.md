# Test Fix Progress

## Fixed Issues

1. **Database Path Issue**: Fixed `setup.ts` to properly resolve project root path using `import.meta.url`. The database initialization now works correctly from any working directory.

## Current Status

- Tests: 389 pass, 13 fail (down from 18)
- The `isNew` flag test passes when run in isolation but fails when run as part of full suite
- This suggests shared state issue between test files

## Remaining 13 Failures

### 1. Order Modifiers (1 failure) - T031-1

- **Issue**: `isNew` expected `true` but got `false` when run in full suite
- **Status**: Passes in isolation, suggests test order dependency
- **Files**: `apps/server/src/api/routers/orders.ts`

### 2. Flags Workflow (2 failures) - T065.2

- **Issue**: High-priority order not appearing first in kitchen orders query
- **Errors**:
  - Step 4: `highPriorityIndex=0, normalOrderIndex=0`
  - Kitchen orders query not sorting by priority/order_priority
- **Files**: `apps/server/tests/integration/flags-workflow.test.ts`

### 3. Staff-Assisted Ordering (1 failure) - T075 & T076

- **Issue**: Waiter user with email "waiter@restauranthub.com" not found
- **Cause**: Test needs setup code to create waiter user
- **Files**: `apps/server/tests/integration/staff-ordering.test.ts`

### 4. Category Workflow (6 failures) - T065.1

- **Issues**: Multiple failures in category operations
  - Step 1: Create category
  - Step 2: Create dish
  - Step 3: Assign dish to category
  - Step 4: View categories
  - Step 5: List dishes in category (dishId undefined)
  - Step 7: Toggle visibility
- **Root Cause**: Categories router not returning ID in responses
- **Files**: `apps/server/src/api/routers/categories.ts`, `apps/server/tests/integration/category-workflow.test.ts`

## Next Steps

1. Fix category router to return proper IDs
2. Fix flags workflow order sorting
3. Add waiter user creation to staff-ordering test or setup
4. Investigate T031-1 test order dependency
