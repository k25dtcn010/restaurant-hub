# Tasks: Advanced Operations Management

**Feature Branch**: `002-advanced-ops-management`  
**Input**: Design documents from `/specs/002-advanced-ops-management/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All tasks include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema updates

- [ ] T001 Create branch `002-advanced-ops-management` from main branch
  - **Command**: `git checkout -b 002-advanced-ops-management`
  - **Validation**: `git branch --show-current` should output `002-advanced-ops-management`

- [ ] T002 [P] Create new schema file packages/db/src/schema/modifiers.ts
  - **Data Model Reference**: See `data-model.md` § 1.1, 1.2, 1.3, 1.4 for table definitions
  - **Tables to Create**:
    - `modifiers`: id, name, priceAdjustment, isAvailable, createdAt, updatedAt
    - `modifierGroups`: id, name, minSelections, maxSelections, displayOrder
    - `dishModifiers`: dishId, modifierId, modifierGroupId (join table)
    - `orderItemModifiers`: orderItemId, modifierId, name, priceAtOrder (join table with historical data)
  - **Relations**: Define Drizzle relations for modifiers → dishModifiers, modifierGroups → dishModifiers
  - **Indexes**: Primary keys + index on dishModifiers.dishId, modifierGroups.displayOrder

- [ ] T003 [P] Create new schema file packages/db/src/schema/categories.ts
  - **Data Model Reference**: See `data-model.md` § 2.1, 2.2
  - **Tables to Create**:
    - `categories`: id, name, displayOrder, iconUrl, isHidden, createdAt, updatedAt
    - `dishCategories`: dishId, categoryId (join table)
  - **Relations**: Define Drizzle relations for categories → dishCategories → dishes
  - **Indexes**: Primary keys + index on categories.displayOrder, categories.isHidden, dishCategories.categoryId

- [ ] T004 [P] Create new schema file packages/db/src/schema/variants.ts
  - **Data Model Reference**: See `data-model.md` § 3.1, 3.2
  - **Tables to Create**:
    - `dishVariants`: id, dishId, name, price, displayOrder
    - `variantRecipes`: variantId, ingredientId, quantityRequired (join table)
  - **Relations**: Define Drizzle relations for dishes → dishVariants, dishVariants → variantRecipes → ingredients
  - **Indexes**: Primary keys + index on dishVariants.dishId, dishVariants.displayOrder

- [ ] T005 [P] Create new schema file packages/db/src/schema/reservations.ts
  - **Data Model Reference**: See `data-model.md` § 5.1, 5.2
  - **Tables to Create**:
    - `operatingHours`: id, dayOfWeek, openTime, closeTime, isClosed
    - `reservations`: id, customerName, customerPhone, customerEmail, partySize, reservationDate, reservationTime, status, tableIds, notes, createdAt, confirmedAt, seatedAt, declineReason
  - **Relations**: Define Drizzle relations (no direct foreign keys, but document relationship to tables)
  - **Indexes**: Primary keys + index on reservations.status, reservations.reservationDate, operatingHours.dayOfWeek

- [ ] T006 [P] Create new schema file packages/db/src/schema/shifts.ts
  - **Data Model Reference**: See `data-model.md` § 6.1, 6.2
  - **Tables to Create**:
    - `shifts`: id, shiftType, startTime, endTime, totalOrders, totalRevenue, notes, createdById
    - `shiftStaff`: shiftId, userId, role (join table)
  - **Relations**: Define Drizzle relations for shifts → shiftStaff → users, shifts → orders
  - **Indexes**: Primary keys + index on shifts.startTime, shifts.endTime, shiftStaff.shiftId

- [ ] T007 Extend packages/db/src/schema/dishes.ts with flag columns
  - **Data Model Reference**: See `data-model.md` § 4.1 "Dish Extensions"
  - **Columns to Add**:
    - `isHidden: boolean().notNull().default(false)` - Soft delete flag (hide from customer menu)
    - `isRecommended: boolean().notNull().default(false)` - Show thumbs-up badge in menu
    - `isChefSpecial: boolean().notNull().default(false)` - Show star badge in menu
    - `orderPriority: integer().notNull().default(0)` - Kitchen sorting priority (higher = cook first)
  - **After Adding**: Columns should be added to existing `dishes` table definition
  - **No Migration Yet**: Schema changes only, migration happens in T011

- [ ] T008 Extend packages/db/src/schema/order-items.ts with variant and request columns
  - **Data Model Reference**: See `data-model.md` § 4.2 "Order Item Extensions"
  - **Columns to Add**:
    - `variantId: integer().references(() => dishVariants.id).nullable()` - Selected dish variant (if any)
    - `specialRequest: text().nullable()` - Customer special request (max 200 chars validated at API layer)
  - **After Adding**: Update existing `orderItems` table definition
  - **No Migration Yet**: Schema changes only, migration happens in T011

- [ ] T009 Extend packages/db/src/schema/orders.ts with shift tracking column
  - **Data Model Reference**: See `data-model.md` § 4.3 "Order Extensions"
  - **Column to Add**:
    - `shiftId: integer().references(() => shifts.id).nullable()` - Associated shift (auto-tagged on order creation)
  - **After Adding**: Update existing `orders` table definition, add relation to shifts
  - **No Migration Yet**: Schema changes only, migration happens in T011

- [ ] T010 Update packages/db/src/index.ts to export all new schemas and relations
  - **Exports to Add**:
    ```typescript
    export * from './schema/modifiers';
    export * from './schema/categories';
    export * from './schema/variants';
    export * from './schema/reservations';
    export * from './schema/shifts';
    ```
  - **Validation**: Run `bun run check-types` - should have zero TypeScript errors
  - **Note**: Existing exports for dishes, order-items, orders already present

- [ ] T011 Generate database migration with `bun run db:generate` in packages/db/
  - **Command**: `cd packages/db && bun run db:generate`
  - **Expected Output**: Migration file created at `packages/db/src/migrations/0002_advanced_ops.sql`
  - **Migration Should Include**:
    - CREATE TABLE statements for 11 new tables (modifiers, modifierGroups, dishModifiers, orderItemModifiers, categories, dishCategories, dishVariants, variantRecipes, operatingHours, reservations, shifts, shiftStaff)
    - ALTER TABLE statements for 3 extended tables (dishes +4 columns, orderItems +2 columns, orders +1 column)
  - **Review**: Manually inspect migration file to ensure all tables and columns are correct

- [ ] T012 Apply migration with `bun run db:migrate` to create all new tables
  - **Command**: `cd packages/db && bun run db:migrate`
  - **Expected Output**: "Migration 0002_advanced_ops.sql applied successfully"
  - **Validation**: 
    - Check database file has grown in size
    - Run `bun run db:studio` and verify all 11 new tables exist
    - Verify extended columns in dishes, orderItems, orders tables
  - **Rollback Plan**: If migration fails, use `bun run db:migrate:rollback` (if available) or restore from backup

- [ ] T013 Create seed script packages/db/src/seed-advanced-ops.ts
  - **Quickstart Reference**: See `quickstart.md` § Setup "Seed Test Data" for sample data requirements
  - **Sample Data to Create**:
    - 20 modifiers (mix of positive/negative/zero price adjustments, mix of available/unavailable)
    - 5 modifier groups (e.g., "Toppings" min=0 max=3, "Size" min=1 max=1)
    - 6 categories (Appetizers, Main Course, Desserts, Beverages, Specials, Sides)
    - Operating hours for 7 days (Mon-Thu: 11:00-22:00, Fri-Sun: 11:00-23:00)
    - 3 sample reservations (1 Pending, 1 Confirmed, 1 Seated)
    - Assign modifiers to existing dishes from MVP seed data
    - Assign dishes to categories
  - **Run Command**: `bun run packages/db/src/seed-advanced-ops.ts`
  - **Validation**: Query database to confirm sample data exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API routers and shared utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T014 [P] Create tRPC router skeleton packages/api/src/routers/modifiers.ts
  - **Contract Reference**: See `contracts/modifiers-router.md` for all procedure signatures
  - **Procedures to Create** (empty implementations returning TODO error or empty arrays):
    - `list: publicProcedure.input(z.object({ availableOnly: z.boolean().optional().default(false) })).query(...)` 
    - `create: protectedProcedure.input(z.object({ name, priceAdjustment, isAvailable })).mutation(...)`
    - `update: protectedProcedure.input(z.object({ id, name?, priceAdjustment?, isAvailable? })).mutation(...)`
    - `delete: protectedProcedure.input(z.object({ id })).mutation(...)`
    - `listGroups: publicProcedure.query(...)`
    - `createGroup: protectedProcedure.input(z.object({ name, minSelections?, maxSelections?, displayOrder? })).mutation(...)`
    - `updateGroup: protectedProcedure.mutation(...)`
    - `deleteGroup: protectedProcedure.mutation(...)`
    - `assignToDish: protectedProcedure.input(z.object({ dishId, modifierId, modifierGroupId })).mutation(...)`
    - `getByDish: publicProcedure.input(z.object({ dishId })).query(...)`
  - **Temporary Implementation**: Each procedure should return `throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'TODO: Implement in Phase 3' })` or empty array
  - **Validation**: TypeScript should compile without errors

- [X] T015 [P] Create tRPC router skeleton packages/api/src/routers/categories.ts
  - **Contract Reference**: See `contracts/categories-router.md` for all procedure signatures
  - **Procedures to Create** (empty implementations):
    - `list: publicProcedure.input(z.object({ visibleOnly: z.boolean().optional().default(false) })).query(...)`
    - `create: protectedProcedure.input(z.object({ name, displayOrder?, iconUrl? })).mutation(...)`
    - `update: protectedProcedure.input(z.object({ id, name?, displayOrder?, iconUrl?, isHidden? })).mutation(...)`
    - `toggleVisibility: protectedProcedure.input(z.object({ id })).mutation(...)`
    - `listDishes: publicProcedure.input(z.object({ categoryId })).query(...)`
    - `assignDishes: protectedProcedure.input(z.object({ categoryId, dishIds: z.array(z.number()) })).mutation(...)`
  - **Temporary Implementation**: Return TODO errors or empty arrays
  - **Validation**: TypeScript should compile without errors

- [X] T016 [P] Create tRPC router skeleton packages/api/src/routers/reservations.ts
  - **Contract Reference**: See `contracts/reservations-router.md` for all procedure signatures
  - **Procedures to Create** (empty implementations):
    - `getOperatingHours: publicProcedure.query(...)`
    - `updateOperatingHours: protectedProcedure.input(z.array(z.object({ dayOfWeek, openTime, closeTime, isClosed }))).mutation(...)`
    - `create: publicProcedure.input(z.object({ customerName, customerPhone, customerEmail, partySize, reservationDate, reservationTime, notes? })).mutation(...)` (rate-limited)
    - `list: protectedProcedure.input(z.object({ status?, dateFrom?, dateTo? })).query(...)`
    - `confirm: protectedProcedure.input(z.object({ id, tableIds: z.array(z.number()) })).mutation(...)`
    - `decline: protectedProcedure.input(z.object({ id, reason })).mutation(...)`
    - `markSeated: protectedProcedure.input(z.object({ id })).mutation(...)`
    - `markNoShow: protectedProcedure.input(z.object({ id })).mutation(...)`
    - `cancel: publicProcedure.input(z.object({ id })).mutation(...)`
    - `suggestAlternativeTimes: publicProcedure.input(z.object({ reservationDate, reservationTime, partySize })).query(...)`
  - **Temporary Implementation**: Return TODO errors or empty arrays

- [X] T017 [P] Create tRPC router skeleton packages/api/src/routers/shifts.ts
  - **Contract Reference**: See `contracts/shifts-router.md` for all procedure signatures
  - **Procedures to Create** (empty implementations):
    - `start: protectedProcedure.input(z.object({ shiftType, staffIds: z.array(z.string()), notes? })).mutation(...)`
    - `end: protectedProcedure.input(z.object({ id, notes? })).mutation(...)`
    - `listActive: protectedProcedure.query(...)`
    - `listHistory: protectedProcedure.input(z.object({ dateFrom?, dateTo?, shiftType?, staffId? })).query(...)`
    - `addStaff: protectedProcedure.input(z.object({ shiftId, userId, role })).mutation(...)`
    - `removeStaff: protectedProcedure.input(z.object({ shiftId, userId })).mutation(...)`
  - **Temporary Implementation**: Return TODO errors or empty arrays

- [X] T018 Register all new routers in packages/api/src/index.ts
  - **Imports to Add**:
    ```typescript
    import { modifiersRouter } from './routers/modifiers';
    import { categoriesRouter } from './routers/categories';
    import { reservationsRouter } from './routers/reservations';
    import { shiftsRouter } from './routers/shifts';
    ```
  - **Router Registration**:
    ```typescript
    export const appRouter = router({
      // ... existing routers (dishes, orders, tables, etc.)
      modifiers: modifiersRouter,
      categories: categoriesRouter,
      reservations: reservationsRouter,
      shifts: shiftsRouter,
    });
    ```
  - **Validation**: 
    - Run `bun run check-types` - zero errors
    - Start dev server `bun run dev` and check tRPC panel shows 4 new routers

- [X] T019 Extend packages/api/src/routers/dishes.ts to include variant and flag fields
  - **Contract Reference**: See existing dishes router, extend getDishDetails and list procedures
  - **Changes to getDishDetails Procedure**:
    - Add `variants` array to output schema (query dishVariants WHERE dishId = input.id, ordered by displayOrder)
    - Add flag fields to output: `isRecommended, isChefSpecial, isHidden, orderPriority`
  - **Changes to list Procedure**:
    - Add flag fields to output schema
    - Add optional `includeHidden` input param (default false, filter WHERE isHidden = false for customers)
  - **Data Model Reference**: See `data-model.md` § 3.1 for dishVariants schema, § 4.1 for dish flag columns
  - **Validation**: Query should return dishes with new fields populated

- [X] T020 Extend packages/api/src/routers/orders.ts to accept modifiers and special requests
  - **Contract Reference**: See existing orders router, extend createOrder procedure
  - **Changes to createOrder Input Schema**:
    - Extend `items` array schema to accept:
      ```typescript
      items: z.array(z.object({
        dishId: z.number(),
        quantity: z.number(),
        variantId: z.number().optional(), // NEW: Selected variant (if dish has variants)
        specialRequest: z.string().max(200).optional(), // NEW: Customer special request
        modifiers: z.array(z.object({ // NEW: Selected modifiers
          modifierId: z.number(),
          modifierGroupId: z.number(),
        })).optional(),
      }))
      ```
  - **Implementation Note**: Don't implement modifier price calculation yet (Phase 3), just accept the data structure
  - **Validation**: API should accept new fields without errors (can ignore them for now)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Menu Item Customization with Modifiers (Priority: P1) 🎯 MVP

**Goal**: Enable customers to customize dishes with modifiers (e.g., "extra cheese", "no onions") and add special requests, with kitchen receiving full customization details

**Independent Test**: View a dish in menu → select modifiers → enter special request → submit order → verify kitchen dashboard shows all customizations clearly with order item

### Implementation for User Story 1

**Backend: Modifier Management**

#### T021: modifiers.list - List all modifiers with availability filter

- [X] T021-RED [P] [US1] Write FAILING test for modifiers.list procedure
  - **File**: `packages/api/tests/routers/modifiers.test.ts` (create if doesn't exist)
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.list" for input/output schemas
  - **Test Cases**:
    1. Returns all modifiers when `availableOnly = false`
    2. Returns only available modifiers when `availableOnly = true`
    3. Returns empty array when no modifiers exist
  - **Setup**: Seed 5 modifiers (3 available, 2 unavailable)
  - **Expected**: Tests FAIL (procedure not fully implemented yet)

- [X] T021-GREEN [US1] Implement modifiers.list to make tests pass
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.list"
  - **Data Model**: Query `modifiers` table (see `data-model.md` § 1.1)
  - **Implementation**:
    ```typescript
    list: publicProcedure
      .input(z.object({ availableOnly: z.boolean().optional().default(false) }))
      .query(async ({ input }) => {
        return await db.query.modifiers.findMany({
          where: input.availableOnly ? eq(modifiers.isAvailable, true) : undefined,
          orderBy: [asc(modifiers.id)],
        });
      }),
    ```
  - **Expected**: All tests PASS

- [X] T021-REFACTOR [US1] Review modifiers.list code quality
  - **Quality Checks**: Run `bun run lint`, `bun run check-types`
  - **Performance**: Should handle 1000+ modifiers in < 50ms
  - **Expected**: Tests still PASS, no lint errors

#### T022: modifiers.create - Create new modifier (manager only)

- [X] T022-RED [P] [US1] Write FAILING test for modifiers.create
  - **File**: `packages/api/tests/routers/modifiers.test.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.create"
  - **Test Cases**:
    1. Manager can create modifier successfully
    2. Non-manager gets UNAUTHORIZED error
    3. Duplicate name returns BAD_REQUEST
    4. Negative price adjustment is allowed (e.g., discount)
  - **Expected**: Tests FAIL

- [X] T022-GREEN [US1] Implement modifiers.create with manager auth
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.create"
  - **Auth**: Use `protectedProcedure` and check `ctx.user.role === 'manager'`
  - **Implementation**: Insert into `modifiers` table, catch unique constraint errors
  - **Expected**: All tests PASS

- [X] T022-REFACTOR [US1] Review error handling in modifiers.create
  - **UX Check**: Error messages should be user-friendly (per Constitution § III)
  - **Expected**: Tests still PASS

#### T023: modifiers.update - Update existing modifier (manager only)

- [X] T023-RED [P] [US1] Write FAILING test for modifiers.update
  - **File**: `packages/api/tests/routers/modifiers.test.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.update"
  - **Test Cases**:
    1. Manager can update modifier name/price/availability
    2. Non-manager gets UNAUTHORIZED
    3. Non-existent modifier ID returns NOT_FOUND
    4. Partial updates work (only provided fields updated)
  - **Expected**: Tests FAIL

- [X] T023-GREEN [US1] Implement modifiers.update
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.update"
  - **Implementation**: Update only provided fields, return updated modifier
  - **Expected**: All tests PASS

- [X] T023-REFACTOR [US1] Optimize modifiers.update query
  - **Expected**: Tests still PASS

#### T024: modifiers.delete - Delete modifier if not in use (manager only)

- [X] T024-RED [P] [US1] Write FAILING test for modifiers.delete
  - **File**: `packages/api/tests/routers/modifiers.test.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.delete"
  - **Test Cases**:
    1. Can delete modifier not assigned to any dishes
    2. Returns BAD_REQUEST if modifier assigned to dishes
    3. Returns NOT_FOUND if modifier doesn't exist
  - **Data Model**: Check `dishModifiers` table (see `data-model.md` § 1.3)
  - **Expected**: Tests FAIL

- [X] T024-GREEN [US1] Implement modifiers.delete with assignment check
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Logic**: 
    1. Query `dishModifiers WHERE modifierId = input.id`
    2. If count > 0, throw BAD_REQUEST: "Cannot delete modifier assigned to dishes"
    3. Otherwise, delete from `modifiers` table
  - **Expected**: All tests PASS

- [X] T024-REFACTOR [US1] Review modifiers.delete error messages
  - **Expected**: Tests still PASS

#### T025-T028: Modifier Groups CRUD

- [X] T025-RED [P] [US1] Write FAILING tests for modifiers.listGroups
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.listGroups"
  - **Test**: Returns groups ordered by displayOrder ASC

- [X] T025-GREEN [US1] Implement modifiers.listGroups
  - **Data Model**: Query `modifierGroups` table (see `data-model.md` § 1.2)
  - **Implementation**: Query all groups, order by displayOrder

- [X] T026-RED [P] [US1] Write FAILING tests for modifiers.createGroup
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.createGroup"
  - **Test Cases**: Manager can create, min/max validation works

- [X] T026-GREEN [US1] Implement modifiers.createGroup with validation
  - **Validation**: Ensure minSelections <= maxSelections (if both provided)
  - **Implementation**: Insert into `modifierGroups` table

- [X] T027-RED [P] [US1] Write FAILING tests for modifiers.updateGroup
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.updateGroup"

- [X] T027-GREEN [US1] Implement modifiers.updateGroup
  - **Implementation**: Update provided fields in `modifierGroups`

- [X] T028-RED [P] [US1] Write FAILING tests for modifiers.deleteGroup
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.deleteGroup"
  - **Test**: Check if group assigned to dishes via dishModifiers

- [X] T028-GREEN [US1] Implement modifiers.deleteGroup with assignment check
  - **Implementation**: Similar to T024, check dishModifiers before deleting

#### T029-T030: Dish-Modifier Assignment

- [X] T029-RED [US1] Write FAILING test for modifiers.assignToDish
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.assignToDish"
  - **Data Model**: Inserts into `dishModifiers` join table (see `data-model.md` § 1.3)
  - **Test Cases**:
    1. Manager can assign modifier to dish with group
    2. Duplicate assignment is idempotent (no error)
  - **BLOCKS**: T038 (dish editor needs this to assign modifiers)
  - **Expected**: Tests FAIL

- [X] T029-GREEN [US1] Implement modifiers.assignToDish
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Implementation**: Insert into `dishModifiers (dishId, modifierId, modifierGroupId)`
  - **Handle Duplicates**: Use `ON CONFLICT DO NOTHING` or check before inserting
  - **Expected**: Tests PASS

- [X] T030-RED [US1] Write FAILING test for modifiers.getByDish
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.getByDish"
  - **Test**: Returns modifiers grouped by modifierGroup for a specific dish
  - **BLOCKS**: T039 (modifier selector needs this data)
  - **Expected**: Tests FAIL

- [X] T030-GREEN [US1] Implement modifiers.getByDish with grouping
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Implementation**:
    1. Join `dishModifiers → modifiers → modifierGroups`
    2. Filter WHERE dishId = input.dishId
    3. Group results by modifierGroupId
    4. Return array of `{ group: ModifierGroup, modifiers: Modifier[] }`
  - **Data Model**: See `data-model.md` § 1.3 for join relationships
  - **Expected**: Tests PASS

**Backend: Order Item Modifiers**

- [X] T031 [US1] Update orders.createOrder to accept modifiers array per item
  - **File**: `packages/api/src/routers/orders.ts`
  - **Note**: Input schema already extended in T020, now process the data
  - **DEPENDS ON**: T030 (needs getByDish to validate modifier selections)
  - **Implementation**: Accept modifiers in input, validate they belong to dish
  - **Don't Implement Yet**: Price calculation (done in T032)

- [X] T032 [US1] Implement modifier price calculation in orders.createOrder
  - **File**: `packages/api/src/routers/orders.ts`
  - **DEPENDS ON**: T031
  - **Logic**:
    ```typescript
    // For each order item:
    const basePrice = variant ? variant.price : dish.price;
    const modifierTotal = selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0);
    const itemTotal = (basePrice + modifierTotal) * quantity;
    ```
  - **Data Model**: Use `priceAdjustment` from modifiers table (see `data-model.md` § 1.1)
  - **Test**: Order with modifiers has correct total price

- [X] T033 [US1] Insert selected modifiers into orderItemModifiers table
  - **File**: `packages/api/src/routers/orders.ts`
  - **DEPENDS ON**: T032
  - **Data Model**: Insert into `orderItemModifiers` join table (see `data-model.md` § 1.4)
  - **Implementation**: After creating order items, insert modifiers with historical price snapshot:
    ```typescript
    for (const modifier of item.modifiers) {
      await db.insert(orderItemModifiers).values({
        orderItemId: createdOrderItem.id,
        modifierId: modifier.modifierId,
        name: modifier.name, // Snapshot name
        priceAtOrder: modifier.priceAdjustment, // Snapshot price
      });
    }
    ```
  - **Test**: Query orderItemModifiers table, verify modifiers stored with historical prices

- [X] T034 [US1] Update orders.getOrderDetails to include modifiers in response
  - **File**: `packages/api/src/routers/orders.ts`
  - **DEPENDS ON**: T033
  - **Implementation**: 
    - Join order_items → orderItemModifiers
    - Include modifiers array in each order item: `[{ name, priceAtOrder }]`
    - Include specialRequest field in order item response
  - **Test**: getOrderDetails returns order with modifiers and special requests

**Frontend: Manager - Modifier Management**

- [X] T035 [P] [US1] Create modifier management UI component
  - **File**: `apps/web/src/components/modifier-manager.tsx`
  - **Quickstart Reference**: See `quickstart.md` § A "Manager: Create Modifiers" for expected workflow
  - **DEPENDS ON**: T021-GREEN, T022-GREEN (needs list and create procedures)
  - **Features**:
    - **List View**: Table with columns (Name, Price Adjustment, Available Status, Actions)
    - **Create Form**: Modal with inputs (name: text, priceAdjustment: number with +/- prefix, isAvailable: toggle)
    - **Edit Button**: Opens modal pre-populated with current values (calls T023 update procedure)
    - **Delete Button**: Confirm dialog, shows warning if modifier assigned to dishes (calls T024)
  - **UI Components**: Use shadcn/ui Table, Dialog, Form, Input, Switch, Button
  - **tRPC Calls**: 
    - `api.modifiers.list.useQuery({})`
    - `api.modifiers.create.useMutation()`
    - `api.modifiers.update.useMutation()`
    - `api.modifiers.delete.useMutation()`
  - **Validation**: Show inline errors for invalid inputs (name required, price must be integer)
  - **Test**: Manager can create modifier "Extra Cheese +$2.00", see it in list, edit to +$2.50, toggle availability

- [X] T036 [P] [US1] Create modifier group editor component
  - **File**: `apps/web/src/components/modifier-group-editor.tsx`
  - **Quickstart Reference**: See `quickstart.md` § A "Manager: Create Modifier Groups"
  - **DEPENDS ON**: T025-GREEN, T026-GREEN
  - **Features**:
    - **List View**: Groups ordered by displayOrder, show (Name, Min/Max Selections, Actions)
    - **Create Form**: Inputs (name, minSelections: nullable number, maxSelections: nullable number, displayOrder: number)
    - **Validation**: Ensure minSelections <= maxSelections if both provided
    - **Drag-and-Drop Reorder**: Update displayOrder on drag (optimistic update)
  - **UI Components**: Use shadcn/ui DnD library or react-beautiful-dnd, Dialog, Form, Input
  - **tRPC Calls**:
    - `api.modifiers.listGroups.useQuery()`
    - `api.modifiers.createGroup.useMutation()`
    - `api.modifiers.updateGroup.useMutation()`
  - **Test**: Manager creates "Toppings" group with min=0 max=3, reorders groups

- [X] T037 [US1] Add "Modifiers" tab to menu management page
  - **File**: `apps/web/src/routes/menu-management.tsx`
  - **DEPENDS ON**: T035, T036 (components must exist)
  - **Implementation**: 
    - Add tab navigation: Dishes | Categories | **Modifiers**
    - Modifiers tab renders ModifierManager and ModifierGroupEditor side-by-side or in accordion
  - **UI**: Use shadcn/ui Tabs component
  - **Test**: Navigate to Menu Management → Modifiers tab, see modifier and group management UIs

- [X] T038 [US1] Implement modifier assignment UI in dish editor
  - **File**: `apps/web/src/components/dish-editor.tsx`
  - **Quickstart Reference**: See `quickstart.md` § A "Manager: Assign Modifiers to Dish"
  - **DEPENDS ON**: T029-GREEN (needs assignToDish procedure), T030-GREEN (needs getByDish)
  - **Features**:
    - **Section**: "Available Modifiers" in dish edit form
    - **For Each Modifier Group**: Show group name, multi-select checkboxes for modifiers in that group
    - **On Save**: Call `api.modifiers.assignToDish.useMutation()` for each selected modifier
    - **Display Current**: Load existing modifiers via `api.modifiers.getByDish.useQuery({ dishId })`
  - **UI Components**: Use shadcn/ui Checkbox, Label, Card for grouping
  - **Test**: Edit "Cheeseburger" → select "Toppings" group → check "Extra Cheese", "Bacon" → save → verify assigned

**Frontend: Customer - Modifier Selection**

- [X] T039 [P] [US1] Create modifier selector component for customer ordering
  - **File**: `apps/web/src/components/modifier-selector.tsx`
  - **Quickstart Reference**: See `quickstart.md` § A "Customer: Order with Modifiers"
  - **DEPENDS ON**: T030-GREEN (needs getByDish to load modifiers)
  - **Features**:
    - **Input Props**: `dishId: number`, `onModifiersChange: (modifiers: SelectedModifier[]) => void`
    - **Display**: For each modifier group, show:
      - Group name (e.g., "Toppings")
      - Min/Max selection constraint (e.g., "Select 0-3")
      - Checkboxes (or radio buttons if max=1) for each modifier
      - Price adjustment indicator (e.g., "+ Extra Cheese (+$2.00)")
    - **Validation**: 
      - Disable submit if constraints violated (e.g., selected 4 when max=3)
      - Show error message: "Please select at least {min} items" or "Maximum {max} items allowed"
    - **State Management**: Track selected modifiers, emit onChange when selection changes
  - **tRPC Call**: `api.modifiers.getByDish.useQuery({ dishId })`
  - **UI Components**: Use shadcn/ui Checkbox, RadioGroup, Badge, Alert
  - **Test**: View "Cheeseburger" → see "Toppings" group → select 2 modifiers → verify total updates

- [X] T040 [US1] Integrate modifier selection into dish detail/order flow
  - **File**: Likely in dish detail view or order cart component
  - **DEPENDS ON**: T039 (modifier selector component must exist)
  - **Implementation**:
    - When customer clicks "Add to Order" for a dish, show modifier selector if dish has modifiers
    - Store selected modifiers in order item state
    - Pass modifiers to createOrder mutation (T031)
  - **Test**: Add "Cheeseburger" to cart → modifier selector appears → select modifiers → add to cart

- [X] T041 [US1] Implement min/max selection validation in modifier selector
  - **File**: `apps/web/src/components/modifier-selector.tsx`
  - **DEPENDS ON**: T039 (component must exist)
  - **Validation Logic**:
    ```typescript
    const isValid = modifierGroups.every(group => {
      const selectedCount = selectedModifiers.filter(m => m.groupId === group.id).length;
      const meetsMin = !group.minSelections || selectedCount >= group.minSelections;
      const meetsMax = !group.maxSelections || selectedCount <= group.maxSelections;
      return meetsMin && meetsMax;
    });
    ```
  - **UI**: Disable "Add to Order" button if `!isValid`, show error messages per group
  - **Test**: Try selecting 4 toppings when max=3 → see error → can't submit until deselect to 3

- [X] T042 [US1] Add special request text input to dish customization
  - **File**: Same as T040 (dish detail/order flow)
  - **Features**:
    - **Text Area**: Max 200 characters, placeholder "Any special requests? (e.g., no pickles, extra lettuce)"
    - **Character Counter**: Show "150/200" below text area
    - **Validation**: Prevent submission if > 200 chars
  - **UI**: Use shadcn/ui Textarea component
  - **State**: Store in order item alongside modifiers
  - **Test**: Enter "No pickles, extra lettuce" → verify shows in order summary

- [X] T043 [US1] Update order total calculation to include modifier prices
  - **File**: Order cart component or checkout view
  - **DEPENDS ON**: T039, T040 (selected modifiers must be tracked)
  - **Calculation Logic**:
    ```typescript
    const itemTotal = (dish.price + selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * quantity;
    ```
  - **UI**: Show modifier prices inline:
    - Line 1: "Cheeseburger - $12.00"
    - Line 2: "  + Extra Cheese - $2.00"
    - Line 3: "  + Bacon - $1.50"
    - Total: "$15.50"
  - **Test**: Select modifiers → verify total updates in real-time → matches backend calculation

**Frontend: Kitchen - Display Modifiers**

- [X] T044 [US1] Update kitchen order card to display modifiers
  - **File**: `apps/web/src/components/order-card.tsx`
  - **Quickstart Reference**: See `quickstart.md` § A "Kitchen: View Order with Modifiers"
  - **DEPENDS ON**: T034 (getOrderDetails must return modifiers)
  - **Display Format**: For each order item with modifiers:
    ```
    Cheeseburger x2
      + Extra Cheese (+$2.00)
      + Bacon (+$1.50)
    ```
  - **Styling**: Modifiers indented, smaller font, muted color, "+" prefix
  - **tRPC**: Uses existing `api.orders.getOrderDetails.useQuery()` which now includes modifiers
  - **Test**: Create order with modifiers → kitchen sees modifiers listed under dish name

- [X] T045 [US1] Display special request text in kitchen order card
  - **File**: `apps/web/src/components/order-card.tsx`
  - **DEPENDS ON**: T034 (getOrderDetails must return specialRequest)
  - **Display Format**:
    ```
    Cheeseburger x2
      + Extra Cheese (+$2.00)
      📝 "No pickles, extra lettuce"
    ```
  - **Styling**: Special request in italic, distinct color (warning or muted), icon (📝 or 💬)
  - **Test**: Create order with special request → kitchen sees request prominently displayed

**Checkpoint**: At this point, User Story 1 should be fully functional - customers can customize dishes, kitchen sees customizations

**Validation Tasks for User Story 1:**

- [ ] T045.1 [US1] End-to-end integration test for modifier workflow
  - **Quickstart Reference**: Run full walkthrough from `quickstart.md` § A
  - **Test Scenario**:
    1. Manager creates modifiers and groups → verifies they appear in list
    2. Manager assigns modifiers to "Cheeseburger" dish → verifies assignment saved
    3. Customer views "Cheeseburger" → sees modifier selector with groups
    4. Customer selects "Extra Cheese" (+$2.00) and "Bacon" (+$1.50) → total updates to $15.50
    5. Customer enters special request "No pickles" → submits order
    6. Kitchen receives order → sees modifiers and special request clearly displayed
    7. Payment processes correctly → total matches $15.50
  - **Success Criteria**: All 7 steps complete without errors, data flows through all layers
  - **Tools**: Manual testing + automated E2E test if available

- [ ] T045.2 [US1] Performance test for modifier selector with 200+ modifiers
  - **Test**: Load dish with 10 groups × 20 modifiers each (200 total)
  - **Benchmark**: Component should render in < 200ms (per Constitution § IV)
  - **Fix if Slow**: Add virtualization (react-window) or pagination for large modifier lists
  - **Measure**: Use React DevTools Profiler

- [X] T045.3 [US1] Type safety check for modifiers router
  - **Command**: `bun run check-types` in packages/api
  - **Expected**: Zero TypeScript errors in `packages/api/src/routers/modifiers.ts`
  - **Verify**: Input/output types flow correctly from Zod schemas to tRPC procedures

- [X] T045.4 [US1] Test coverage check for modifiers
  - **Command**: `bun test --coverage packages/api/tests/routers/modifiers.test.ts`
  - **Target**: Minimum 80% coverage for `modifiers.ts` router (per Constitution § II)
  - **Review**: Ensure all edge cases covered (duplicate names, deletion with assignments, min/max validation)
  - **Result**: ✅ PASSED - 100% function coverage, 95.49% line coverage (exceeds 80% target)

---

## Phase 4: User Story 2 - Menu Category Organization and Flags (Priority: P1)

**Goal**: Organize menu items into categories (Appetizers, Main Course, etc.) and flag items as Recommended/Chef's Special with kitchen priority

**Independent Test**: Create categories → assign dishes → apply flags → verify customer menu shows grouped items with badges → verify kitchen respects priority

### Implementation for User Story 2

**Backend: Category Management** _(Contract: `contracts/categories-router.md` | Data: `data-model.md` § 2)_

- [X] T046-T051: Categories CRUD procedures (TDD: RED-GREEN-REFACTOR for each)
  - **T046**: `categories.list` - List categories with dishCount, filter by visibleOnly
  - **T047**: `categories.create` - Manager creates category with name, displayOrder, iconUrl
  - **T048**: `categories.update` - Update category fields
  - **T049**: `categories.toggleVisibility` - Soft hide/show category (isHidden flag)
  - **T050**: `categories.listDishes` - Get all dishes in a specific category
  - **T051**: `categories.assignDishes` - Assign multiple dishes to category (inserts into dishCategories join table)
  - **Testing**: Create `packages/api/tests/routers/categories.test.ts` with full coverage
  - **Data Model**: Uses `categories` and `dishCategories` tables (see `data-model.md` § 2.1, 2.2)

**Backend: Dish Flags** _(Data: `data-model.md` § 4.1)_

- [X] T052 Update dishes.update procedure to accept flag fields
  - **File**: `packages/api/src/routers/dishes.ts`
  - **New Fields**: `isRecommended: boolean`, `isChefSpecial: boolean`, `orderPriority: integer`
  - **Validation**: orderPriority should be 0-100 range

- [X] T053 Update dishes.list procedure to include flags in response
  - **Implementation**: Add flag fields to output schema
  - **Default Sorting**: Order by orderPriority DESC when querying for kitchen view

- [X] T054 Update orders.getKitchenQueue to sort by orderPriority
  - **File**: `packages/api/src/routers/orders.ts`
  - **Logic**: JOIN orders → orderItems → dishes, sort by dishes.orderPriority DESC within each status
  - **Effect**: High-priority dishes (Chef's Specials) appear at top of kitchen queue

**Frontend: Manager - Category Management** _(UI: `quickstart.md` § B)_

- [X] T055 [P] Create category manager component
  - **File**: `apps/web/src/components/category-manager.tsx`
  - **Features**: CRUD operations, show/hide toggle, dish count display
  - **tRPC**: categories.list, create, update, toggleVisibility

- [X] T056 Add "Categories" tab to menu management
  - **File**: `apps/web/src/routes/menu-management.tsx`
  - **Integration**: Render CategoryManager component in new tab

- [X] T057 Implement drag-and-drop category reordering
  - **File**: `apps/web/src/components/category-manager.tsx`
  - **Library**: @dnd-kit (core, sortable, utilities)
  - **Updates**: displayOrder field on drop using categories.reorder API

- [X] T058 Add category assignment to dish editor
  - **File**: `apps/web/src/components/dish-editor.tsx`
  - **UI**: Multi-select checkboxes for categories
  - **tRPC**: categories.assignDishes

**Frontend: Manager - Dish Flags**

- [X] T059 Add flag toggles to dish editor
  - **File**: `apps/web/src/components/dish-editor.tsx`
  - **Controls**: Recommended checkbox, Chef's Special checkbox, Priority number input (0-100)
  - **Validation**: Priority must be integer 0-100

- [X] T060 Add flag badges to dish list view
  - **File**: `apps/web/src/routes/menu-management.tsx`
  - **Badges**: 👍 Recommended, ⭐ Chef's Special, with priority number

**Frontend: Customer - Category Browsing** _(UI: `quickstart.md` § B "Customer: Browse by Category")_

- [X] T061 [P] Create category list component
  - **File**: `apps/web/src/components/category-list.tsx`
  - **Display**: Category cards with icons, dish counts, ordered by displayOrder
  - **tRPC**: categories.list({ visibleOnly: true })

- [X] T062 Update menu page with category filtering
  - **File**: `apps/web/src/routes/index.tsx` (menu/landing page)
  - **Features**: Click category → filter dishes → show "All" button to clear filter

- [X] T063-T064 Add flag badges to customer menu items
  - **Implementation**: Show 👍 badge for isRecommended, ⭐ badge for isChefSpecial
  - **Styling**: Prominent placement, consistent with brand colors

**Frontend: Kitchen - Priority Sorting**

- [X] T065 Update kitchen orders board to sort by orderPriority
  - **File**: Backend already handles this in `packages/api/src/routers/orders.ts` (T054 completed)
  - **Logic**: Orders.getKitchenOrders sorts by highest priority dish first, then by createdAt
  - **Visual**: Frontend displays orders in backend-sorted order (no additional sorting needed)

**Validation Tasks for User Story 2:**

- [ ] T065.1 [US2] Integration test: Category workflow end-to-end
  - **Test**: Create "Appetizers" → assign "Spring Rolls" → customer sees in category → filters work
- [ ] T065.2 [US2] Integration test: Flags workflow end-to-end  
  - **Test**: Mark "Chef's Burger" as Chef's Special (priority 90) → customer sees ⭐ → kitchen prioritizes it
- [ ] T065.3 [US2] Type safety check: `bun run check-types` for categories router
- [ ] T065.4 [US2] Test coverage: Minimum 80% for `packages/api/tests/routers/categories.test.ts`

**Checkpoint**: Categories organize menu, flags influence customer decisions and kitchen workflow

---

## Phase 5: User Story 3 - Menu Item Variants (Priority: P2)

**Goal**: Enable dishes to have multiple size/option variants (Small/Medium/Large) with different prices, customers select variant when ordering

**Independent Test**: Create dish with variants → customer selects variant → verify correct price → kitchen receives variant info

### Implementation for User Story 3

**Backend: Variant Management** _(Contract: dishes router extensions | Data: `data-model.md` § 3)_

- [ ] T066-T070: Dish Variants CRUD (TDD: RED-GREEN-REFACTOR)
  - **T066**: `dishes.createVariant` - Add variant to dish (name, price, displayOrder)
  - **T067**: `dishes.updateVariant` - Update variant fields
  - **T068**: `dishes.deleteVariant` - Delete if not used in orders (check orderItems.variantId)
  - **T069**: `dishes.listVariants` - Get all variants for dish, ordered by displayOrder
  - **T070**: Extend `dishes.getDishDetails` to include variants array in response
  - **Testing**: Add to `packages/api/tests/routers/dishes.test.ts`

**Backend: Orders with Variants** _(Already accepts variantId in T020, now process it)_

- [ ] T071 Update orders.createOrder to use variant price if variantId provided
  - **Logic**: `const itemPrice = variant ? variant.price : dish.price` (before adding modifiers)
  - **DEPENDS ON**: T070 (needs variant data)

- [ ] T072 Implement variant price override logic
  - **Note**: Merged with T071 - same task

- [ ] T073 Update orders.getOrderDetails to include variant name in response
  - **Join**: orderItems LEFT JOIN dishVariants ON variantId
  - **Output**: Include `variantName: string | null` in order item

**Frontend: Manager - Variant Editor** _(UI: `quickstart.md` § C)_

- [ ] T074 [P] Create variant editor component
  - **File**: `apps/web/src/components/variant-editor.tsx`
  - **Features**: Add/edit/delete variants, reorder by drag-and-drop, set price per variant
  - **tRPC**: dishes.createVariant, updateVariant, deleteVariant, listVariants

- [ ] T075 Add "Has Variants" toggle to dish editor
  - **File**: `apps/web/src/components/dish-editor.tsx`
  - **Logic**: Show/hide variant editor based on toggle

- [ ] T076 Integrate variant editor into dish editor
  - **DEPENDS ON**: T074, T075

**Frontend: Customer - Variant Selection**

- [ ] T077 [P] Create variant selector component
  - **File**: `apps/web/src/components/variant-selector.tsx`
  - **UI**: Radio buttons for variants (only one selection allowed)
  - **Display**: "Small ($3.00) | Medium ($4.00) | Large ($5.00)"
  - **Props**: `variants: Variant[]`, `onSelect: (variantId) => void`

- [ ] T078 Add variant selection requirement to order flow
  - **Validation**: If dish has variants, customer MUST select one before adding to cart
  - **Error**: "Please select a size" if variants exist but none selected

- [ ] T079 Update order total to use variant price + modifiers
  - **Calculation**: `(variant.price + modifierTotal) * quantity`

**Frontend: Kitchen - Variant Display**

- [ ] T080 Update kitchen order card to show variant name
  - **Format**: "Coffee (Medium) x2" instead of just "Coffee x2"
  - **File**: `apps/web/src/components/order-card.tsx`

**Validation Tasks for User Story 3:**

- [ ] T080.1 [US3] Integration test: Variant workflow end-to-end
- [ ] T080.2 [US3] Type safety check for dishes router variant procedures
- [ ] T080.3 [US3] Test coverage for variant-related tests

**Checkpoint**: Dishes with variants work end-to-end - customers select size, kitchen knows which variant

---

## Phase 6: User Story 4 - Temporary Item Hiding (Priority: P2)

**Goal**: Managers/staff can temporarily hide dishes from customer view without deletion, preserving historical orders

**Independent Test**: Mark dish as hidden → verify not visible to customers → verify manager sees "Hidden" badge → re-enable → verify appears in customer menu

### Implementation for User Story 4

**Backend: Dish Hiding** _(Note: isHidden column already added in T007)_

- [ ] T081 Update dishes.update to accept isHidden field
  - **File**: `packages/api/src/routers/dishes.ts`
  - **Input**: Add `isHidden: z.boolean().optional()` to update schema
  - **Auth**: Manager/Staff only

- [ ] T082 Update dishes.list to filter hidden dishes for customers
  - **Logic**: `WHERE isHidden = false` when `includeHidden = false` (default for public)
  - **Manager View**: Pass `includeHidden = true` to see all dishes

- [ ] T083 Implement dishes.toggleVisibility procedure
  - **Quick Toggle**: `UPDATE dishes SET isHidden = NOT isHidden WHERE id = ?`
  - **Auth**: Manager/Staff only
  - **Returns**: Updated dish with new isHidden value

**Frontend: Manager - Hide/Show Dishes** _(UI: `quickstart.md` § D)_

- [ ] T084 [P] Add "Hide"/"Show" toggle button to dish list
  - **File**: `apps/web/src/routes/menu-management.tsx`
  - **UI**: Eye icon button, tooltip shows "Hide from customers" / "Show to customers"
  - **tRPC**: dishes.toggleVisibility

- [ ] T085 Add "Hidden" badge to hidden dishes in manager view
  - **Styling**: Gray badge with "Hidden" text, dish appears dimmed/muted

- [ ] T086 Create "Hidden Items" quick-access section
  - **Location**: Menu management dashboard
  - **Display**: List of currently hidden dishes with one-click "Show" buttons
  - **Filter**: `dishes.list({ includeHidden: true }).filter(d => d.isHidden)`

**Frontend: Customer - Hidden Dish Filter**

- [ ] T087 Update menu query to exclude hidden dishes
  - **File**: `apps/web/src/routes/menu.tsx`
  - **tRPC**: `api.dishes.list.useQuery({ includeHidden: false })`

**Frontend: Staff - Manual Add Hidden Dish**

- [ ] T088 Add hidden dish warning in manual order creation
  - **Scenario**: Staff creating order for phone/walk-in customer
  - **UI**: Hidden dishes show with ⚠️ warning badge in search results
  - **Confirmation**: "This item is currently hidden. Add anyway?" dialog

**Validation Tasks for User Story 4:**

- [ ] T088.1 [US4] Test: Hide dish → customer can't see → manager can re-enable
- [ ] T088.2 [US4] Test: Historical orders with now-hidden dishes still display correctly

**Checkpoint**: Hiding workflow complete - dishes can be temporarily removed from customer view

---

## Phase 7: User Story 5 - Table Reservation System (Priority: P2)

**Goal**: Customers create reservations, staff confirm/assign tables/mark seated, with operating hours validation

**Independent Test**: Submit reservation → staff confirms → assign table → mark seated → verify table QR session starts

### Implementation for User Story 5

**Backend: Operating Hours** _(Contract: `contracts/reservations-router.md` | Data: `data-model.md` § 5.1)_

- [ ] T089 [P] [US5] Implement reservations.getOperatingHours procedure
  - **Returns**: Array of `{ dayOfWeek: 0-6, openTime, closeTime, isClosed: boolean }`
  - **Query**: `SELECT * FROM operatingHours ORDER BY dayOfWeek`

- [ ] T090 [P] [US5] Implement reservations.updateOperatingHours procedure
  - **Auth**: Manager only
  - **Input**: Array of operating hours for all 7 days
  - **Validation**: openTime < closeTime, valid time format (HH:MM)

- [ ] T091 [US5] Create Zod validation helper for reservation time checks
  - **Function**: `isWithinOperatingHours(date, time)` → boolean
  - **Logic**: Check if requested time falls within operating hours for that day of week
  - **Used By**: T092 (create reservation)

**Backend: Reservation Lifecycle** _(Contract: `contracts/reservations-router.md` | Data: `data-model.md` § 5.2)_

- [ ] T092-T099: Reservation procedures (TDD: RED-GREEN-REFACTOR)
  - **T092**: `reservations.create` - Public access, rate-limited (5/IP/hour), validates operating hours
  - **T093**: `reservations.list` - Staff view with filters (status, dateFrom, dateTo)
  - **T094**: `reservations.confirm` - Assign tables, check conflicts (no double-booking)
  - **T095**: `reservations.decline` - With decline reason
  - **T096**: `reservations.markSeated` - Auto-creates order session for table
  - **T097**: `reservations.markNoShow` - Staff marks no-show
  - **T098**: `reservations.cancel` - Customer/staff can cancel (with time restrictions)
  - **T099**: `reservations.suggestAlternativeTimes` - Recommend ±30min slots if requested time unavailable
  - **Testing**: Create `packages/api/tests/routers/reservations.test.ts` with full coverage
  - **Status Flow**: Pending → Confirmed/Declined, Confirmed → Seated/NoShow/Cancelled

**Backend: WebSocket Notifications** _(Extend: `apps/server/src/websocket.ts`)_

- [ ] T100 [US5] Extend WebSocket to broadcast new reservation events
  - **Event**: `{ type: 'reservation:new', data: Reservation }`
  - **Recipients**: All connected staff/manager clients

- [ ] T101 [US5] Add reservation status change events
  - **Events**: `reservation:confirmed`, `reservation:seated`, `reservation:cancelled`

**Frontend: Manager - Operating Hours Config** _(UI: `quickstart.md` § E)_

- [ ] T102 [P] [US5] Create operating hours editor component
  - **File**: `apps/web/src/components/operating-hours-editor.tsx`
  - **UI**: 7 rows (Mon-Sun), each with openTime, closeTime inputs, "Closed" checkbox
  - **tRPC**: reservations.getOperatingHours, updateOperatingHours

- [ ] T103 [US5] Add "Operating Hours" tab to reservations page
  - **File**: `apps/web/src/routes/reservations.tsx`

**Frontend: Customer - Public Reservation Form** _(UI: `quickstart.md` § E "Customer: Create Reservation")_

- [ ] T104 [P] [US5] Create public reservation form component
  - **File**: `apps/web/src/components/reservation-form.tsx`
  - **Fields**: Date (date picker), Time (time picker), Party Size (number), Name, Phone, Email, Special Notes (textarea)
  - **Validation**: Date >= today, time within operating hours, party size 1-20
  - **tRPC**: reservations.create

- [ ] T105 [US5] Create public reservation route (no auth required)
  - **File**: `apps/web/src/routes/reservations/new.tsx`
  - **Public Access**: Anyone can submit reservation

- [ ] T106 [US5] Implement client-side validation in reservation form
  - **Checks**: Date not in past, time within operating hours (fetch hours first)
  - **UI**: Show inline errors, disable submit if invalid

- [ ] T107 [US5] Add alternative time suggestions display
  - **Trigger**: If reservations.create returns "time unavailable" error
  - **Display**: Call suggestAlternativeTimes, show 3-5 alternative slots
  - **UI**: Click suggestion → pre-fill form with new time

**Frontend: Staff - Reservations Dashboard** _(UI: `quickstart.md` § E "Staff: Manage Reservations")_

- [ ] T108 [P] [US5] Create reservations board component
  - **File**: `apps/web/src/components/reservations-board.tsx`
  - **Layout**: Tabs for Pending, Confirmed, Seated, Declined, No-Show
  - **tRPC**: reservations.list with status filter

- [ ] T109 [US5] Create reservation management route (staff/manager only)
  - **File**: `apps/web/src/routes/reservations.tsx`
  - **Auth**: Protected route with staff/manager check

- [ ] T110-T112: Reservation card features
  - **T110**: Confirm/Decline/Seat/No-Show action buttons
  - **T111**: Table assignment multi-select (for combining tables for large parties)
  - **T112**: Highlight reservations within 15 min of scheduled time (orange badge, auto-sort to top)

- [ ] T113 [US5] Implement WebSocket listener for real-time updates
  - **Listen**: `reservation:new`, `reservation:confirmed`, etc.
  - **Action**: Refresh reservations list, show toast notification

**Validation Tasks for User Story 5:**

- [ ] T113.1 [US5] Integration test: Full reservation lifecycle
  - **Test**: Customer submits → staff confirms + assigns table → marks seated → order session created
- [ ] T113.2 [US5] Test: Operating hours validation works correctly
- [ ] T113.3 [US5] Test: WebSocket notifications reach staff clients in real-time
- [ ] T113.4 [US5] Test coverage: 80% for reservations router

**Checkpoint**: Full reservation workflow functional - customer submit → staff manage → seated

---

## Phase 8: User Story 6 - Shift and Session Management (Priority: P3)

**Goal**: Managers start/end shifts with staff assignments, orders auto-tagged, shift summary generated

**Independent Test**: Start shift → create orders during shift → end shift → verify summary shows order count, revenue, staff

### Implementation for User Story 6

**Backend: Shift Management** _(Contract: `contracts/shifts-router.md` | Data: `data-model.md` § 6)_

- [ ] T114-T121: Shift procedures (TDD: RED-GREEN-REFACTOR)
  - **T114**: `shifts.start` - Manager creates shift with type (Breakfast/Lunch/Dinner/Custom) and staff list
  - **T115**: `shifts.end` - Calculate summary (totalOrders, totalRevenue from linked orders/payments), set endTime
  - **T116**: `shifts.listActive` - Returns shifts WHERE endTime IS NULL
  - **T117**: `shifts.listHistory` - Filter by dateFrom, dateTo, shiftType, staffId
  - **T118**: `shifts.addStaff` - Add staff mid-shift (insert into shiftStaff join table)
  - **T119**: `shifts.removeStaff` - Remove staff mid-shift
  - **Testing**: Create `packages/api/tests/routers/shifts.test.ts`
  - **Data Model**: Uses `shifts` and `shiftStaff` tables (see `data-model.md` § 6.1, 6.2)

- [ ] T120 [US6] Update orders.createOrder to auto-tag with active shift
  - **File**: `packages/api/src/routers/orders.ts`
  - **Logic**: Query `shifts WHERE endTime IS NULL LIMIT 1`, set order.shiftId
  - **Note**: shiftId column already added in T009

- [ ] T121 [US6] Add validation to shifts.end for open orders warning
  - **Check**: Count orders WHERE shiftId = input.id AND status IN ('pending', 'preparing')
  - **Warning**: Return warning (not error) if count > 0: "X unpaid orders remain in this shift"

**Frontend: Manager - Shift Controls** _(UI: `quickstart.md` § F)_

- [ ] T122 [P] [US6] Create shift control component
  - **File**: `apps/web/src/components/shift-control.tsx`
  - **Features**: "Start Shift" button, "End Shift" button (disabled if no active shift)
  - **tRPC**: shifts.start, shifts.end

- [ ] T123 [US6] Create shift management route
  - **File**: `apps/web/src/routes/shifts.tsx`
  - **Auth**: Manager only
  - **Layout**: Active shifts at top, history below

- [ ] T124 [US6] Add start shift dialog
  - **UI**: Select shift type (dropdown), select staff (multi-select with checkboxes), optional notes
  - **Validation**: At least 1 staff member required

- [ ] T125 [US6] Add end shift confirmation dialog
  - **Display**: Shift summary (duration, order count, revenue, staff names)
  - **Warning**: Show alert if unpaid orders exist (from T121)
  - **Actions**: "End Shift" button, "Cancel" button

- [ ] T126 [US6] Display warning for shifts > 12 hours duration
  - **Logic**: `duration = endTime - startTime`, if > 12 hours, show ⚠️ warning
  - **Message**: "This shift has been active for 13 hours. Are you sure you want to end it now?"

**Frontend: Manager - Active Shifts View**

- [ ] T127 [P] [US6] Create active shifts list component
  - **File**: Component within `apps/web/src/routes/shifts.tsx`
  - **Display**: Running shifts with real-time duration counter, order count, staff names
  - **tRPC**: shifts.listActive, poll every 30s or use WebSocket

- [ ] T128 [US6] Add edit shift UI for staff management
  - **Features**: "+ Add Staff" button, staff list with remove icons
  - **tRPC**: shifts.addStaff, shifts.removeStaff

- [ ] T129 [US6] Display active shift indicator in header/dashboard
  - **UI**: Badge in header showing "Shift: Lunch (3h 24m)" for staff awareness
  - **Click**: Navigate to shifts page

**Frontend: Manager - Shift History**

- [ ] T130 [P] [US6] Create shift history component
  - **File**: Component within `apps/web/src/routes/shifts.tsx`
  - **Filters**: Date range picker, shift type dropdown, staff member dropdown
  - **tRPC**: shifts.listHistory

- [ ] T131 [US6] Add "History" tab to shifts management page
  - **Layout**: Tab navigation: Active | History

- [ ] T132 [US6] Display shift summary cards in history
  - **Info**: Shift type, date/time, duration, order count, revenue, staff names
  - **Sorting**: Most recent first

**Validation Tasks for User Story 6:**

- [ ] T132.1 [US6] Integration test: Shift lifecycle end-to-end
  - **Test**: Start shift → orders auto-tagged → end shift → summary correct
- [ ] T132.2 [US6] Test: Staff management mid-shift works correctly
- [ ] T132.3 [US6] Test coverage: 80% for shifts router

**Checkpoint**: Complete shift lifecycle - start → auto-tagging → end with summary

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories, testing validation, documentation

**UI/UX Polish** _(Constitution § III - User Experience Consistency)_

- [ ] T133 [P] Update main menu navigation
  - **File**: `apps/web/src/components/header.tsx`
  - **Add Links**: Categories, Modifiers, Reservations, Shifts (manager/staff only)
  - **Mobile**: Ensure responsive menu works on mobile viewports

- [ ] T134 [P] Add loading states and skeletons to all new components
  - **Components**: modifier-selector, category-list, reservations-board, shift-control, etc.
  - **UI**: Use shadcn/ui Skeleton component
  - **Benchmark**: Loading feedback must appear within 200ms (per Constitution § IV)

- [ ] T135 [P] Implement error boundaries for new routes
  - **Files**: `apps/web/src/routes/` (all new routes)
  - **Fallback**: User-friendly error messages (not stack traces)
  - **Constitution**: § III - errors must be actionable

- [ ] T136 [P] Add optimistic updates for toggle actions
  - **Actions**: hide/show dish, hide/show category, mark seated, toggle availability
  - **Pattern**: Immediately update UI, rollback if mutation fails
  - **Libraries**: Use tRPC's `onMutate` with query invalidation

**Documentation Updates**

- [ ] T137 [P] Update API reference documentation
  - **File**: `docs/api-reference.md`
  - **Add Sections**: modifiers router, categories router, reservations router, shifts router
  - **Include**: All procedures with input/output schemas, auth requirements

- [ ] T138 Update README.md with new features
  - **File**: `README.md`
  - **Add**: "Advanced Operations Management" section describing modifiers, categories, variants, reservations, shifts
  - **Screenshots**: Add screenshots of key UI components (optional but recommended)

**Quality Assurance** _(Constitution § II - Code Quality Standards)_

- [ ] T139 Run quickstart.md walkthrough for validation
  - **File**: `specs/002-advanced-ops-management/quickstart.md`
  - **Process**: Manually test ALL user stories A-F end-to-end
  - **Checklist**: Check off each scenario in quickstart as it passes
  - **Expected**: All scenarios complete without errors

- [ ] T140 Run type checking across all workspaces
  - **Command**: `bun run check-types`
  - **Expected**: Zero TypeScript errors in apps/server, apps/web, packages/api, packages/db
  - **Fix**: Resolve any `any` types, missing type definitions

- [ ] T141 Run linting and fix errors
  - **Command**: `bun run lint`
  - **Expected**: Zero linting errors, zero warnings
  - **Auto-fix**: Run `bun run lint --fix` for auto-fixable issues

- [ ] T142 Build production bundles to validate
  - **Commands**: 
    - `cd apps/web && bun run build` - Web app bundle
    - `cd apps/server && bun run build` - Server bundle
  - **Expected**: Both build successfully, no build errors
  - **Bundle Size**: Web app < 500KB gzipped (per Constitution § IV)
  - **Check**: Run `du -h apps/web/dist` to verify size

- [ ] T143 Update copilot-instructions.md with new features
  - **File**: `.github/copilot-instructions.md`
  - **Add**: Technologies list for this feature (already auto-generated, verify it's current)
  - **Recent Changes**: Should include link to spec 002-advanced-ops-management

**Final Deliverable**

- [ ] T144 Create pull request for `002-advanced-ops-management`
  - **Branch**: `002-advanced-ops-management` → `main`
  - **PR Description**: Include:
    - Summary of 6 user stories implemented
    - Link to spec: `specs/002-advanced-ops-management/spec.md`
    - Link to quickstart: `specs/002-advanced-ops-management/quickstart.md`
    - Testing notes: All quickstart scenarios tested
    - Screenshots: Key UI changes (modifiers, categories, reservations, shifts)
    - Breaking changes: None (backward compatible)
  - **Checks**: All CI checks must pass (types, tests, lint, build)
  - **Reviewers**: Assign code reviewers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational (Phase 2) completion
  - User stories can proceed in parallel (if multiple developers)
  - Or sequentially by priority: US1 (P1) → US2 (P1) → US3 (P2) → US4 (P2) → US5 (P2) → US6 (P3)
- **Polish (Phase 9)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (Menu Modifiers)**: Independent - can start after Foundational phase
- **US2 (Categories & Flags)**: Independent - can start after Foundational phase
- **US3 (Variants)**: Independent - can start after Foundational phase (uses dishes schema)
- **US4 (Hiding)**: Independent - can start after Foundational phase (extends dishes)
- **US5 (Reservations)**: Independent - can start after Foundational phase (new tables)
- **US6 (Shifts)**: Independent - can start after Foundational phase (extends orders slightly)

**All user stories are independently testable and deliverable**

### Within Each User Story

- Backend procedures before frontend components that consume them
- Models/schemas before services/routers
- Core implementation before integration/polish
- Tests (if requested) MUST be written FIRST and FAIL before implementation

### Parallel Opportunities

**Setup Phase (Phase 1):**
- T002-T006 can run in parallel (different schema files)

**Foundational Phase (Phase 2):**
- T014-T017 can run in parallel (different router files)

**User Story 1:**
- T021-T028 can run in parallel (different procedures in same router)
- T035-T036 can run in parallel (different frontend components)

**User Story 2:**
- T046-T049 can run in parallel (different procedures)
- T055 and T059 can run in parallel (different components)

**User Story 3:**
- T066-T068 can run in parallel (different procedures)

**User Story 5:**
- T089-T090, T092-T098 can run in parallel (different procedures)
- T102, T104, T108 can run in parallel (different frontend components)

**User Story 6:**
- T114-T119 can run in parallel (different procedures)
- T122, T127, T130 can run in parallel (different frontend components)

**Polish Phase:**
- T133-T137 can run in parallel (different documentation/UI files)

---

## Parallel Example: User Story 1 (Modifiers)

```bash
# Backend procedures (all in packages/api/src/routers/modifiers.ts):
- T021: modifiers.list
- T022: modifiers.create
- T023: modifiers.update
- T024: modifiers.delete
- T025: modifiers.listGroups
# All can be implemented in parallel by different developers

# Frontend components:
- T035: modifier-manager.tsx (manager UI)
- T036: modifier-group-editor.tsx (group editor)
- T039: modifier-selector.tsx (customer UI)
# All can be built in parallel
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. ✅ Complete Phase 1: Setup (database schema ready)
2. ✅ Complete Phase 2: Foundational (routers skeleton ready)
3. ✅ Complete Phase 3: User Story 1 (Modifiers working)
4. ✅ Complete Phase 4: User Story 2 (Categories & Flags working)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. Deploy MVP with menu customization + organization features

### Incremental Delivery Strategy

1. **Foundation**: Setup + Foundational → Database ready, routers scaffolded
2. **MVP Release**: US1 + US2 → Customer customization + Menu organization
3. **Enhancement 1**: US3 (Variants) → Size options for beverages, pizzas
4. **Enhancement 2**: US4 (Hiding) → Temporary unavailability management
5. **Enhancement 3**: US5 (Reservations) → Table booking system
6. **Enhancement 4**: US6 (Shifts) → Staff accountability and reporting
7. **Final Polish**: Phase 9 → Documentation, optimization, testing

Each increment adds value without breaking previous features.

### Parallel Team Strategy (3 Developers)

After completing Foundation:

- **Developer A**: US1 (Modifiers) + US2 (Categories) - Core menu features (P1 priority)
- **Developer B**: US3 (Variants) + US4 (Hiding) - Menu enhancements (P2 priority)
- **Developer C**: US5 (Reservations) + US6 (Shifts) - Operational features (P2/P3 priority)

All stories integrate independently and can be tested/deployed separately.

---

## Task Count Summary

- **Total Tasks**: 143
- **Setup (Phase 1)**: 13 tasks
- **Foundational (Phase 2)**: 7 tasks
- **User Story 1 (Modifiers)**: 25 tasks
- **User Story 2 (Categories & Flags)**: 20 tasks
- **User Story 3 (Variants)**: 15 tasks
- **User Story 4 (Hiding)**: 8 tasks
- **User Story 5 (Reservations)**: 25 tasks
- **User Story 6 (Shifts)**: 19 tasks
- **Polish (Phase 9)**: 11 tasks

**Parallel Tasks Identified**: 47 tasks marked with [P] for concurrent execution

**MVP Scope** (US1 + US2): 52 tasks (Setup + Foundation + US1 + US2)

---

## Notes

- All tasks follow TDD approach per constitution (tests first, implementation second) - tests not explicitly generated as not requested in spec
- [P] marker indicates tasks operating on different files with no dependencies
- [Story] label maps each task to specific user story for traceability
- Each user story independently completable and testable
- File paths use monorepo structure: apps/web, apps/server, packages/api, packages/db
- Stop at any checkpoint to validate story works independently
- Constitution compliance verified: type safety, TDD workflow, performance benchmarks, UX consistency
