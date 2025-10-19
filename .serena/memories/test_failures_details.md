# 17 Test Failures - Detailed Analysis

## Summary of Issues:

1. **Flags Workflow Test (2 fails)** - `highPriorityIndex=0, normalOrderIndex=0`
   - Issue: High-priority order not appearing before normal order
   - Root cause: Kitchen orders query not sorting by priority/order_priority

2. **Staff-Assisted Ordering Test (1 fail)**
   - Issue: Waiter user with email "waiter@restauranthub.com" not found
   - Root cause: Test needs setup code to create waiter user

3. **Category Workflow Tests (6 fails)**
   - Issues: Multiple failures in category operations
   - Failures in creating categories with dishes
   - categoryId being undefined in responses
   - Root causes:
     - Categories router not returning ID in responses
     - Assign to category expecting categoryId that's not provided

4. **Orders with Modifiers (1 fail)**
   - Issue: `isNew` should be `true` but returns `false`
   - Root cause: Order creation logic not properly detecting new orders with modifiers

5. **Inventory Router (2 fails)**
   - Issue: Should return error for non-existent ingredient but doesn't
   - Root cause: Error handling for non-existent ingredients missing

## Files to Fix:

- `apps/server/src/api/routers/orders.ts` - isNew logic for modifiers
- `apps/server/src/api/routers/categories.ts` - Response format issues
- `apps/server/src/api/routers/inventory.ts` - Error handling
- `apps/server/tests/integration/flags-workflow.test.ts` - Order sorting
- `apps/server/tests/integration/staff-ordering.test.ts` - User setup
