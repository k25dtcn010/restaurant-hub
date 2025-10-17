# Implementation Plan: RestaurantHub MVP

**Branch**: `001-restaurant-hub-mvp` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-restaurant-hub-mvp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

RestaurantHub is a lightweight restaurant management platform enabling customer self-service ordering via QR codes and comprehensive order lifecycle management for staff. The system implements real-time order processing, inventory tracking, and role-based dashboards for kitchen staff, waiters, and managers. Core functionality includes: QR-based customer ordering, kitchen order management with real-time notifications, staff-assisted ordering, order status tracking through the complete lifecycle (Pending → In Kitchen → Ready to Serve → Served → Completed → Paid), inventory management with automatic stock reduction and low-stock alerts, and cash payment processing.

## Technical Context

**Language/Version**: TypeScript 5.7+ with strict mode enabled, Bun 1.3+ runtime  
**Primary Dependencies**: 
- Backend: Hono 4.8+ (web framework), tRPC 11.5+ (type-safe API layer)
- Frontend: React 18+, TanStack Router (file-based routing), shadcn/ui + Tailwind CSS
- Database: Drizzle ORM with SQLite (development) / Turso (production)
- Auth: Better-Auth 1.3+ for role-based access control
- Real-time: WebSocket/Server-Sent Events via Hono for order notifications

**Storage**: SQLite (local development) / Turso (production) - relational database for tables, orders, dishes, ingredients, recipes, users, payments  
**Testing**: Bun test runner with minimum 80% coverage requirement; TDD-first workflow (Red-Green-Refactor)  
**Target Platform**: Web application (responsive design for mobile/tablet/desktop); Backend API server  
**Project Type**: Web application with separate frontend and backend in monorepo structure  
**Performance Goals**: 
- API response time p95 < 200ms for standard operations
- Real-time notifications delivered within 5 seconds
- Support 20+ simultaneous table sessions
- Database query optimization with indexed fields
- Frontend bundle < 500KB gzipped, TTI < 3s on 3G

**Constraints**: 
- 25-30 tables per restaurant
- Real-time notification requirement (WebSocket/SSE mandatory)
- Cash-only payment processing (no credit card integration)
- Single-location restaurant scope
- Type safety enforced end-to-end (database → API → UI)

**Scale/Scope**: 
- 25-30 tables, 3 staff roles, ~50-100 menu items
- 6 user stories (3 P1, 2 P2, 1 P3)
- 36 functional requirements across ordering, inventory, lifecycle, kitchen, serving, payment, and access control

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Test-Driven Development (TDD-First) ✅
- **Status**: PASS
- **Compliance**: Implementation plan includes TDD-first workflow for all features. Tests will be written before implementation code following Red-Green-Refactor cycle.
- **Evidence**: All user stories have defined acceptance scenarios that translate directly to test cases.

### II. Code Quality Standards ✅
- **Status**: PASS
- **Compliance**: TypeScript strict mode required, zero compilation errors tolerated, 80% test coverage minimum.
- **Evidence**: Technical context specifies TypeScript 5.7+ with strict mode; Bun test runner with coverage requirements.

### III. User Experience Consistency ✅
- **Status**: PASS
- **Compliance**: All UI components use shadcn/ui library, theme switching supported, loading states < 200ms, type-safe routing via TanStack Router.
- **Evidence**: Technical dependencies include shadcn/ui + Tailwind CSS, TanStack Router for type-safe navigation.

### IV. Performance Requirements ✅
- **Status**: PASS
- **Compliance**: API p95 < 200ms, bundle < 500KB gzipped, TTI < 3s on 3G, indexed database queries, tRPC batching.
- **Evidence**: Performance goals explicitly defined in technical context; aligns with constitution requirements.

### V. Type Safety & Reliability ✅
- **Status**: PASS
- **Compliance**: tRPC procedures with Zod schemas, Drizzle ORM with TypeScript types, Better-Auth type-safe state, TanStack Router generated types.
- **Evidence**: Stack selection (tRPC, Drizzle, Better-Auth, TanStack Router) provides end-to-end type safety from database to UI.

### Technical Standards ✅
- **Status**: PASS
- **Compliance**: Bun 1.3+, Hono 4.8+, React 18+, Drizzle ORM, tRPC 11.5+, Better-Auth 1.3+, shadcn/ui.
- **Evidence**: All required technologies specified in Technical Context primary dependencies.

### Security Standards ✅
- **Status**: PASS
- **Compliance**: httpOnly cookies, Better-Auth permission validation, Zod input validation, .env secret management, explicit CORS.
- **Evidence**: Better-Auth 1.3+ handles authentication; tRPC with Zod provides server-side validation; standard security practices will be applied.

### Development Workflow ✅
- **Status**: PASS
- **Compliance**: Feature spec created (spec.md exists), implementation plan being generated (this file), branch pattern followed (001-restaurant-hub-mvp).
- **Evidence**: This plan follows .specify/templates/plan-template.md structure; spec.md exists with user stories prioritized P1/P2/P3.

**OVERALL GATE STATUS: ✅ PASS - Proceed to Phase 0 Research**

---

### Post-Phase 1 Re-Evaluation

**Date**: 2025-10-17  
**Status**: ✅ PASS - All gates remain compliant after design phase

**Design Artifacts Verified**:
- ✅ `research.md`: All technology decisions documented with rationale
- ✅ `data-model.md`: Complete entity definitions with validation rules
- ✅ `contracts/`: 5 tRPC routers specified (orders, dishes, inventory, tables, payments)
- ✅ `quickstart.md`: TDD workflow guide with development setup

**Constitution Alignment**:
1. **TDD-First**: QuickStart guide demonstrates Red-Green-Refactor cycle with concrete examples
2. **Type Safety**: All contracts use Zod schemas; Drizzle ORM exports TypeScript types
3. **Performance**: Indexed database queries, tRPC batching, WebSocket for real-time (all documented in research.md)
4. **Security**: Better-Auth role-based access, Zod input validation (specified in contracts)
5. **UX Consistency**: shadcn/ui components, loading states < 200ms (technical context requirements)

**No new complexity introduced during design phase. Ready for Phase 2 (task breakdown via /speckit.tasks command).**

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/
├── server/                      # Backend Hono + tRPC server (port 3000)
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── websocket.ts        # WebSocket handler for real-time notifications
│   │   └── routes/             # Hono route handlers
│   ├── tests/
│   │   ├── integration/        # API integration tests
│   │   └── unit/               # Business logic unit tests
│   ├── package.json
│   └── tsconfig.json
│
├── web/                         # Frontend React app (port 3001)
│   ├── src/
│   │   ├── main.tsx            # React app entry point
│   │   ├── components/         # Shared UI components
│   │   │   ├── ui/             # shadcn/ui base components
│   │   │   ├── header.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── mode-toggle.tsx
│   │   ├── routes/             # TanStack Router file-based routes
│   │   │   ├── __root.tsx      # Root layout
│   │   │   ├── index.tsx       # Landing/QR ordering page
│   │   │   ├── login.tsx       # Staff authentication
│   │   │   ├── dashboard.tsx   # Staff role-based dashboards
│   │   │   ├── kitchen.tsx     # Kitchen dashboard (P1)
│   │   │   ├── serving.tsx     # Waiter serving dashboard (P2)
│   │   │   ├── orders.tsx      # Order management (P1/P2)
│   │   │   ├── inventory.tsx   # Inventory management (P3)
│   │   │   └── menu.tsx        # Menu management
│   │   ├── lib/
│   │   │   ├── auth-client.ts  # Better-Auth client
│   │   │   └── utils.ts        # Utility functions
│   │   └── utils/
│   │       └── trpc.ts         # tRPC client setup
│   ├── tests/
│   │   ├── components/         # Component tests
│   │   └── integration/        # E2E tests
│   ├── package.json
│   └── vite.config.ts
│
packages/
├── api/                         # Shared tRPC router definitions
│   ├── src/
│   │   ├── index.ts            # tRPC app router export
│   │   ├── context.ts          # tRPC context with auth
│   │   └── routers/
│   │       ├── index.ts        # Router aggregation
│   │       ├── orders.ts       # Order CRUD & lifecycle (P1)
│   │       ├── dishes.ts       # Menu/dish management
│   │       ├── inventory.ts    # Ingredient & stock management (P3)
│   │       ├── tables.ts       # Table & QR code management
│   │       └── payments.ts     # Payment processing (P2)
│   ├── tests/
│   │   └── routers/            # Router unit tests
│   ├── package.json
│   └── tsconfig.json
│
├── auth/                        # Authentication configuration
│   ├── src/
│   │   └── index.ts            # Better-Auth config & middleware
│   ├── tests/
│   │   └── auth.test.ts        # Auth flow tests
│   ├── package.json
│   └── tsconfig.json
│
├── db/                          # Database schema & migrations
│   ├── src/
│   │   ├── index.ts            # Drizzle client export
│   │   └── schema/
│   │       ├── auth.ts         # User, Session tables
│   │       ├── tables.ts       # Table entity
│   │       ├── dishes.ts       # Dish, Recipe entities
│   │       ├── inventory.ts    # Ingredient entity
│   │       ├── orders.ts       # Order, OrderItem entities
│   │       └── payments.ts     # Payment entity
│   ├── migrations/             # SQL migration files
│   ├── tests/
│   │   └── schema.test.ts      # Schema validation tests
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
tests/                           # Workspace-level integration tests
├── integration/                 # Cross-service integration tests
├── e2e/                        # End-to-end user story tests
└── data/                       # Test fixtures & seed data
```

**Structure Decision**: Web application structure (Option 2) with Bun monorepo organization. The Better-T-Stack naturally separates into:
- **apps/server**: Backend API serving tRPC procedures and WebSocket connections
- **apps/web**: Frontend React SPA with file-based routing
- **packages/api**: Shared type-safe API contracts between frontend and backend
- **packages/auth**: Centralized authentication logic
- **packages/db**: Single source of truth for database schema and types

This structure enables:
1. **Type safety flow**: Database types (Drizzle) → API types (tRPC) → UI types (React)
2. **Independent deployment**: Server and web apps can be deployed separately
3. **Code reuse**: Packages shared across apps without duplication
4. **Test isolation**: Each workspace has its own tests; integration tests at root level

## Complexity Tracking

*No constitutional violations detected. All requirements align with Better-T-Stack principles and quality standards.*

---

## Implementation Roadmap

This roadmap provides a dependency-ordered sequence of tasks for implementing RestaurantHub MVP, with explicit cross-references to implementation detail files.

### Phase Dependency Chain

```
[Foundation] → [P1: Customer Ordering] → [P1: Kitchen Management] → [P2: Staff Features] → [P3: Inventory Alerts]
   Week 1           Weeks 2-3                  Week 3                   Week 4                 Week 5
```

**Parallel Workstreams** (after Foundation complete):
- **Stream A**: Backend API development (`packages/api/src/routers/`)
- **Stream B**: Frontend customer UI (`apps/web/src/routes/`)
- **Stream C**: Frontend staff dashboards (`apps/web/src/routes/kitchen.tsx`, `serving.tsx`)

---

### Week 1: Foundation (Days 1-5)

**Goal**: Establish database schema, authentication, and API infrastructure  
**Prerequisites**: None  
**Validation**: All migrations run, seed data loads, can login with 3 roles

#### Day 1-2: Database Schema

**Task 1.1: Create Core Entities (Dependency Order)**
- **Files**: 
  - `packages/db/src/schema/auth.ts` - User entity
  - `packages/db/src/schema/tables.ts` - Table entity
  - `packages/db/src/schema/inventory.ts` - Ingredient entity
  - `packages/db/src/schema/dishes.ts` - Dish, Recipe entities
- **Reference**: [data-model.md](./data-model.md) Sections 1, 2, 6, 5, 7
- **Why This Order**: User needed for auth; Ingredient before Dish (Recipe has FK to both); Table has no dependencies
- **Tests**: `packages/db/tests/schema.test.ts` - Validate constraints, foreign keys, indexes
- **Commands**: 
  ```bash
  bun --cwd packages/db db:generate  # Generate migrations
  bun --cwd packages/db db:migrate   # Apply migrations
  ```

**Task 1.2: Create Transactional Entities**
- **Files**: `packages/db/src/schema/orders.ts` - Order, OrderItem, OrderStatusHistory entities
- **Reference**: [data-model.md](./data-model.md) Sections 3, 4, 8
- **Dependencies**: Task 1.1 complete (needs Table, Dish, User FKs)
- **Tests**: Verify cascade deletes, status enum validation

**Task 1.3: Create Payment Entity**
- **Files**: `packages/db/src/schema/payments.ts` - Payment entity
- **Reference**: [data-model.md](./data-model.md) Section 9
- **Dependencies**: Task 1.2 complete (needs Order FK)

**Task 1.4: Seed Initial Data**
- **Files**: `packages/db/src/seed.ts`
- **Reference**: [data-model.md](./data-model.md#seed-data-requirements)
- **Data**: 
  - 3 users (Manager, Kitchen, Waiter)
  - 30 tables with QR codes
  - 20 ingredients with stock
  - 15 dishes with recipes
- **Command**: `bun --cwd packages/db db:seed`

**Checkpoint 1.1**: ✅
```bash
# Verify database state
sqlite3 apps/server/local.db "SELECT COUNT(*) FROM users;"     # Should return 3
sqlite3 apps/server/local.db "SELECT COUNT(*) FROM tables;"    # Should return 30
sqlite3 apps/server/local.db "SELECT COUNT(*) FROM dishes;"    # Should return 15
```

#### Day 3-4: Authentication & API Foundation

**Task 1.5: Setup Better-Auth**
- **Files**: 
  - `packages/auth/src/index.ts` - Better-Auth configuration
  - `packages/api/src/context.ts` - tRPC context with auth session
- **Reference**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth)
- **Implementation Pattern**: Use code example from research.md (role-based middleware)
- **Tests**: `packages/auth/tests/auth.test.ts`
  - Can create user with role
  - Can login with username/password
  - Session includes role information
- **Validation**: Login as `admin@restauranthub.com` / `password123`, verify Manager role returned

**Task 1.6: Setup tRPC Infrastructure**
- **Files**:
  - `packages/api/src/index.ts` - tRPC app router
  - `packages/api/src/trpc.ts` - Router factory, protected procedures
  - `apps/server/src/index.ts` - Hono server with tRPC handler
- **Reference**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) (protected procedure example)
- **Tests**: 
  - Public procedure works without auth
  - Protected procedure returns 401 when not authenticated
  - Role-specific procedure returns 403 for wrong role

**Checkpoint 1.2**: ✅
```bash
# Test tRPC endpoint
curl http://localhost:3000/trpc/health  # Should return { status: "ok" }
```

#### Day 5: WebSocket Foundation

**Task 1.7: Setup WebSocket Server**
- **Files**: 
  - `apps/server/src/websocket.ts` - WebSocket connection management
  - `apps/server/src/index.ts` - Integrate WebSocket with Hono server
- **Reference**: [research.md Section 1](./research.md#1-real-time-notification-architecture)
- **Implementation Pattern**: Use code example from research.md (connection management per role)
- **Tests**: `apps/server/tests/integration/websocket.test.ts`
  - Connection upgrades successfully
  - Messages route to correct role groups
  - Connection cleanup on disconnect
- **Validation**: Connect via WebSocket client, verify `NEW_ORDER` event received

**Task 1.8: Frontend tRPC Client Setup**
- **Files**:
  - `apps/web/src/utils/trpc.ts` - tRPC React client with batching
  - `apps/web/src/main.tsx` - TanStack Query provider
- **Reference**: [research.md Section 8](./research.md#8-performance-optimization-strategies) (tRPC batching example)
- **Tests**: Component test - verify tRPC queries trigger network requests

**Checkpoint 1.3**: ✅ Foundation Complete
- [ ] All database migrations applied successfully
- [ ] Can login as Manager/Kitchen/Waiter roles
- [ ] tRPC health check returns 200
- [ ] WebSocket connection upgrades
- [ ] Frontend can make tRPC query

---

### Week 2-3: P1 User Stories (Days 6-15)

**Goal**: Implement Customer Self-Service Ordering (US1) + Kitchen Order Management (US2)  
**Prerequisites**: Week 1 Foundation complete  
**Validation**: Customer can order via QR, kitchen receives real-time notifications

#### Week 2, Day 1-2: Menu Display (US1 Part 1)

**Task 2.1: Implement dishes.getAll Procedure**
- **Files**: `packages/api/src/routers/dishes.ts`
- **Reference**: [contracts/dishes-router.md](./contracts/dishes-router.md#1-dishesgetall)
- **Business Logic**: 
  - Join Dish with Recipe and Ingredient
  - Compute `isAvailable` flag (dish enabled AND all ingredients in stock)
  - Filter by `isAvailable` if customer view
- **TDD Workflow**: See [quickstart.md](./quickstart.md#example-implementing-orderscreate) for Red-Green-Refactor pattern
- **Tests**: `packages/api/tests/routers/dishes.test.ts`
  - Returns all dishes when `includeDisabled=true`
  - Filters disabled dishes by default
  - Marks dish unavailable if ingredient stock = 0

**Task 2.2: Build Customer Menu UI**
- **Files**: `apps/web/src/routes/index.tsx` - QR landing page
- **Reference**: [spec.md User Story 1, Acceptance Scenario 1](../spec.md#user-story-1---customer-self-service-ordering-priority-p1)
- **UI Components**: 
  - `apps/web/src/components/dish-card.tsx` - Display dish with photo, price, description
  - `apps/web/src/components/menu-grid.tsx` - Grid layout for dishes
- **Query**: `trpc.dishes.getAll.useQuery()` with loading skeleton
- **Tests**: `apps/web/tests/components/menu.test.tsx`
  - Displays loading skeleton while fetching
  - Renders dish cards with correct data
  - Shows "Unavailable" badge for out-of-stock dishes

**Checkpoint 2.1**: ✅
- [ ] Navigate to `http://localhost:3001/?table=5`
- [ ] See menu with 15 dishes
- [ ] Dishes show name, description, price, photo
- [ ] Out-of-stock dishes marked unavailable

#### Week 2, Day 3-5: Order Creation & Submission (US1 Part 2)

**Task 2.3: Implement orders.create Procedure (TDD)**
- **Files**: `packages/api/src/routers/orders.ts`
- **Reference**: [contracts/orders-router.md](./contracts/orders-router.md#1-orderscreate)
- **Business Logic**:
  - Check for active unpaid order at table (join Orders WHERE tableId AND status != 'Paid')
  - If exists: Add items to existing order
  - If not: Create new order with status 'Pending'
  - Validate dish existence and availability
- **TDD Example**: See [quickstart.md Red-Green-Refactor](./quickstart.md#step-1-write-test-red-phase)
- **Tests**: `packages/api/tests/routers/orders.test.ts`
  - Creates new order for table without active order
  - Adds to existing order if table has unpaid order
  - Returns error if table does not exist
  - Returns error if dish does not exist

**Task 2.4: Implement orders.submit Procedure with Stock Reduction**
- **Files**: `packages/api/src/routers/orders.ts`
- **Reference**: 
  - [contracts/orders-router.md](./contracts/orders-router.md#2-orderssubmit)
  - [research.md Section 3](./research.md#3-inventory-management-and-stock-validation) (transaction pattern)
- **Business Logic**: Use transaction pattern from research.md
  ```typescript
  return db.transaction(async (tx) => {
    // 1. Calculate ingredient requirements via Recipe
    // 2. Check stock levels (FOR UPDATE lock)
    // 3. Deduct stock if sufficient
    // 4. Update order status to 'Pending'
    // 5. Broadcast WebSocket NEW_ORDER event
  })
  ```
- **Tests**:
  - Reduces ingredient stock by recipe quantities
  - Rolls back transaction if insufficient stock
  - Returns error with unavailable dish names
  - Broadcasts WebSocket notification

**Task 2.5: Build Order Cart & Submission UI**
- **Files**:
  - `apps/web/src/components/order-cart.tsx` - Cart sidebar
  - `apps/web/src/routes/index.tsx` - Add cart to menu page
- **Mutations**:
  - `trpc.orders.create.useMutation()` - Add items to cart
  - `trpc.orders.submit.useMutation()` - Submit order
- **Tests**: `apps/web/tests/e2e/customer-ordering.test.ts` (Playwright)
  - Can add dish to cart
  - Can modify quantity
  - Can remove item from cart
  - Can submit order
  - See confirmation message

**Checkpoint 2.2**: ✅ User Story 1 Complete
- [ ] Customer scans QR code (`?table=5`)
- [ ] Can browse menu with photos/prices
- [ ] Can add dishes to cart with quantities
- [ ] Can submit order
- [ ] See "Order Submitted" confirmation
- [ ] Order appears in database with status 'Pending'
- [ ] Ingredient stock reduced correctly

#### Week 3, Day 1-3: Kitchen Dashboard (US2 Part 1)

**Task 3.1: Implement orders.getKitchenOrders Query**
- **Files**: `packages/api/src/routers/orders.ts`
- **Reference**: [contracts/orders-router.md](./contracts/orders-router.md#8-ordersgetkitchenorders)
- **Business Logic**:
  - Query orders WHERE status IN ('Pending', 'InKitchen', 'ReadyToServe')
  - Join with OrderItem, Dish, Table
  - Group by table number
  - Sort by createdAt ASC (oldest first) within each status
  - Calculate waitTime (now - createdAt)
- **Authorization**: Role must be 'KitchenStaff' or 'Manager'
- **Tests**: 
  - Returns orders in correct status categories
  - Grouped by table number
  - Oldest orders first
  - Unauthorized for Waiter role

**Task 3.2: Build Kitchen Dashboard UI**
- **Files**: `apps/web/src/routes/kitchen.tsx`
- **Reference**: [spec.md User Story 2, Acceptance Scenarios](../spec.md#user-story-2---kitchen-order-management-priority-p1)
- **UI Components**:
  - `apps/web/src/components/kitchen-order-card.tsx` - Display order with table, items, timestamp
  - `apps/web/src/components/kitchen-columns.tsx` - Kanban columns (Pending, InKitchen, Ready)
- **Queries**: 
  - `trpc.orders.getKitchenOrders.useQuery()` - Real-time query
  - WebSocket integration: `useOrderNotifications()` hook
- **Tests**:
  - Displays orders grouped by status
  - Shows table number, dishes, quantities
  - Updates in real-time when new order arrives

**Task 3.3: Implement WebSocket Integration for NEW_ORDER**
- **Files**: 
  - `apps/web/src/hooks/useOrderNotifications.ts` - WebSocket React hook
  - `apps/server/src/websocket.ts` - Broadcast logic in orders.submit
- **Reference**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates)
- **Pattern**: WebSocket message invalidates TanStack Query cache
  ```typescript
  ws.on('NEW_ORDER', (order) => {
    utils.orders.getKitchenOrders.invalidate()  // Trigger refetch
    toast.success(`New order from Table ${order.tableId}`)
  })
  ```
- **Tests**:
  - WebSocket message received within 5 seconds of order submission
  - Kitchen dashboard updates without manual refresh

**Checkpoint 3.1**: ✅
- [ ] Login as Kitchen Staff (`chef@restauranthub.com`)
- [ ] See kitchen dashboard with order columns
- [ ] Submit customer order from QR page
- [ ] Kitchen dashboard updates within 5 seconds
- [ ] Toast notification appears

#### Week 3, Day 4-5: Order Status Management (US2 Part 2)

**Task 3.4: Implement orders.updateStatus Mutation**
- **Files**: `packages/api/src/routers/orders.ts`
- **Reference**: [contracts/orders-router.md](./contracts/orders-router.md#5-ordersupdatestatus)
- **Business Logic**:
  - Validate status transition is allowed (Pending → InKitchen → ReadyToServe)
  - Check role permissions (Kitchen can do Pending → InKitchen → ReadyToServe)
  - Update orders.status and orders.updatedAt
  - Create OrderStatusHistory entry with userId
  - Broadcast WebSocket ORDER_READY event when status → 'ReadyToServe'
- **Tests**:
  - Status updates successfully for valid transition
  - Returns error for invalid transition (Pending → Served)
  - Returns 403 for wrong role
  - WebSocket event sent to serving staff

**Task 3.5: Add Status Update Buttons to Kitchen Dashboard**
- **Files**: `apps/web/src/components/kitchen-order-card.tsx`
- **Mutations**: `trpc.orders.updateStatus.useMutation()`
- **UI**: 
  - "Start Cooking" button (Pending → InKitchen)
  - "Ready to Serve" button (InKitchen → ReadyToServe)
  - Optimistic updates (instant UI feedback, rollback on error)
- **Tests**: E2E test
  - Click "Start Cooking" button
  - Order moves to "In Kitchen" column
  - Click "Ready to Serve" button
  - Order moves to "Ready" column

**Checkpoint 3.2**: ✅ User Story 2 Complete
- [ ] Kitchen staff can see incoming orders in Pending column
- [ ] Can mark order as "In Kitchen"
- [ ] Can mark order as "Ready to Serve"
- [ ] Orders move between columns visually
- [ ] Status history recorded with timestamps
- [ ] Serving staff receive notification when order ready

**P1 MVP Validation**: ✅
```bash
# E2E Test Suite
bun test tests/e2e/mvp.test.ts

# Manual Validation
1. Customer orders via QR → Order appears in kitchen
2. Kitchen marks "In Kitchen" → Status updates
3. Kitchen marks "Ready" → Serving staff notified
4. Check database: ingredient stock reduced correctly
```

---

### Week 4: P2 Staff Features (Days 16-20)

**Goal**: Implement Staff-Assisted Ordering (US3), Order Serving (US4), Cash Payment (US6)  
**Prerequisites**: P1 MVP complete  
**Reference**: [spec.md User Stories 3, 4, 6](../spec.md)

#### Day 1-2: Staff-Assisted Ordering (US3)

**Task 4.1: Build Staff Order Creation UI**
- **Files**: `apps/web/src/routes/staff/orders/create.tsx`
- **Reference**: [spec.md User Story 3](../spec.md#user-story-3---staff-assisted-ordering-priority-p2)
- **Components**: Table selector, menu browser, order form
- **Mutation**: Same `trpc.orders.create` procedure (authenticated with staff user)
- **Tests**: Staff can select table, add dishes, submit order on behalf of customer

#### Day 3-4: Serving Dashboard (US4)

**Task 4.2: Implement orders.getServingOrders Query**
- **Files**: `packages/api/src/routers/orders.ts`
- **Reference**: [contracts/orders-router.md](./contracts/orders-router.md#9-ordersgetservingorders)
- **Build Serving Dashboard UI**:
  - Files: `apps/web/src/routes/serving.tsx`
  - Shows orders with status 'ReadyToServe' or 'Served'
  - "Mark as Served" button (ReadyToServe → Served)

**Checkpoint 4.1**: ✅
- [ ] Waiter can create order for table via staff interface
- [ ] Waiter sees orders ready to serve
- [ ] Can mark order as served
- [ ] Status updates correctly

#### Day 5: Cash Payment (US6)

**Task 4.3: Implement payments.create Mutation**
- **Files**: `packages/api/src/routers/payments.ts`
- **Reference**: [contracts/payments-router.md](./contracts/payments-router.md#1-paymentscreate)
- **Business Logic**:
  - Validate order status is 'Completed' or 'Served'
  - Validate payment amount matches order.totalAmount
  - Create payment record
  - Update order status to 'Paid'
  - Clear table session (allow new orders for table)

**Task 4.4: Build Payment UI**
- **Files**: `apps/web/src/components/payment-modal.tsx`
- **Mutation**: `trpc.payments.create.useMutation()`
- **Tests**: Can process payment, table session clears

**Checkpoint 4.2**: ✅ P2 Features Complete
- [ ] Staff can create orders manually
- [ ] Waiter can mark orders as served
- [ ] Waiter can process cash payment
- [ ] Table available for new orders after payment

---

### Week 5: P3 Inventory Management (Days 21-25)

**Goal**: Implement Inventory Alerts (US5)  
**Prerequisites**: P2 complete  
**Reference**: [spec.md User Story 5](../spec.md#user-story-5---inventory-management-and-alerts-priority-p3)

#### Day 1-3: Inventory CRUD

**Task 5.1: Implement inventory Router Procedures**
- **Files**: `packages/api/src/routers/inventory.ts`
- **Reference**: [contracts/inventory-router.md](./contracts/inventory-router.md)
- **Procedures**: getAll, adjustStock, setThreshold, getLowStockAlerts

**Task 5.2: Build Inventory Dashboard**
- **Files**: `apps/web/src/routes/inventory.tsx`
- **Components**: Ingredient list, stock adjustment form, low-stock alerts
- **Authorization**: Manager-only access

#### Day 4-5: Low-Stock Alerts

**Task 5.3: Implement WebSocket LOW_STOCK_ALERT**
- **Files**: 
  - `apps/server/src/websocket.ts` - Broadcast logic
  - `packages/api/src/routers/inventory.ts` - Trigger alert when stock < threshold
- **Reference**: [contracts/inventory-router.md](./contracts/inventory-router.md#websocket-notifications)

**Checkpoint 5.1**: ✅ P3 Complete
- [ ] Manager can view all ingredients with stock levels
- [ ] Can adjust stock quantities
- [ ] See low-stock alerts highlighted
- [ ] Receive real-time alert when stock falls below threshold

---

## Validation Checkpoints Summary

### P1 MVP (End of Week 3)
- [ ] Customer can scan QR, view menu, submit order
- [ ] Ingredient stock reduces on order submission
- [ ] Kitchen receives real-time notifications within 5 seconds
- [ ] Kitchen can update order status (Pending → InKitchen → Ready)
- [ ] All acceptance scenarios for US1 + US2 pass
- [ ] E2E test suite passes: `bun test tests/e2e/mvp.test.ts`

### P2 Features (End of Week 4)
- [ ] Staff can create orders manually
- [ ] Serving staff can track and serve orders
- [ ] Cash payment processing works
- [ ] Table session clears after payment

### P3 Inventory (End of Week 5)
- [ ] Inventory dashboard shows all ingredients
- [ ] Stock adjustments work correctly
- [ ] Low-stock alerts appear when threshold crossed
- [ ] Manager receives real-time notifications

---

## Implementation Resources

**Cross-Reference Index**:
- Database Schema: [data-model.md](./data-model.md)
- API Contracts: [contracts/*.md](./contracts/)
- Technology Patterns: [research.md](./research.md)
- Development Setup: [quickstart.md](./quickstart.md)
- Functional Requirements: [spec.md](./spec.md)

**Key Decision Points**:
- Real-time Architecture: [research.md Section 1](./research.md#1-real-time-notification-architecture)
- Database Transactions: [research.md Section 3](./research.md#3-inventory-management-and-stock-validation)
- Authentication: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth)
- Frontend State: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates)
- Testing Strategy: [research.md Section 7](./research.md#7-testing-strategy-for-tdd-workflow)

**File Path Quick Reference**:
| Component | File Path | Contract Reference |
|-----------|-----------|-------------------|
| Orders API | `packages/api/src/routers/orders.ts` | [orders-router.md](./contracts/orders-router.md) |
| Dishes API | `packages/api/src/routers/dishes.ts` | [dishes-router.md](./contracts/dishes-router.md) |
| Inventory API | `packages/api/src/routers/inventory.ts` | [inventory-router.md](./contracts/inventory-router.md) |
| Customer Menu | `apps/web/src/routes/index.tsx` | [spec.md US1](./spec.md#user-story-1) |
| Kitchen Dashboard | `apps/web/src/routes/kitchen.tsx` | [spec.md US2](./spec.md#user-story-2) |
| WebSocket | `apps/server/src/websocket.ts` | [research.md Sec 1](./research.md#1-real-time-notification-architecture) |

