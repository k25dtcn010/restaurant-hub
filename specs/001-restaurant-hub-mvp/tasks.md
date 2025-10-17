# Tasks: RestaurantHub MVP

**Input**: Design documents from `/specs/001-restaurant-hub-mvp/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Following TDD-first workflow as specified in quickstart.md - all tests will be written BEFORE implementation (Red-Green-Refactor cycle).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize monorepo structure per plan.md (apps/server, apps/web, packages/api, packages/auth, packages/db)
- [X] T002 Configure TypeScript 5.7+ strict mode in tsconfig.base.json and workspace tsconfig.json files
- [X] T003 [P] Setup Bun workspace configuration in bts.jsonc with proper package references
- [X] T004 [P] Install core dependencies: Hono 4.8+, tRPC 11.5+, Drizzle ORM, Better-Auth 1.3+
- [X] T005 [P] Configure Prettier, ESLint for code quality standards
- [X] T006 Create environment configuration templates (.env.example for apps/server and apps/web)
- [X] T007 [P] Setup Bun test runner configuration with 80% coverage threshold

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Reference**: [plan.md Week 1 Foundation](./plan.md#week-1-foundation-days-1-5)

### Database Schema & Migrations

- [X] T008 Create Drizzle config in packages/db/drizzle.config.ts with SQLite and Turso support | **Reference**: [research.md Section 10](./research.md#10-deployment-and-environment-configuration)
- [X] T009 [P] Define User schema in packages/db/src/schema/auth.ts (id, email, password, name, role, createdAt) | **Reference**: [data-model.md Section 1](./data-model.md#1-user) - includes validation rules and TypeScript types
- [X] T010 [P] Define Table schema in packages/db/src/schema/tables.ts (id, number, qrCode, capacity, createdAt) | **Reference**: [data-model.md Section 2](./data-model.md#2-table) - includes QR code format and validation
- [X] T011 [P] Define Dish schema in packages/db/src/schema/dishes.ts (id, name, description, price, photoUrl, isAvailable, createdAt, updatedAt) | **Reference**: [data-model.md Section 5](./data-model.md#5-dish) - includes availability logic
- [X] T012 [P] Define Ingredient schema in packages/db/src/schema/ingredients.ts (id, name, quantity, unit, threshold, updatedAt) | **Reference**: [data-model.md Section 6](./data-model.md#6-ingredient) - includes low-stock threshold logic
- [X] T013 [P] Define Recipe schema in packages/db/src/schema/recipes.ts (id, dishId FK, ingredientId FK, quantityRequired) | **Reference**: [data-model.md Section 7](./data-model.md#7-recipe) - includes composite uniqueness constraint
- [X] T014 Define Order schema in packages/db/src/schema/orders.ts (id, tableId FK, status enum, totalAmount, createdAt, updatedAt) | **Reference**: [data-model.md Section 3](./data-model.md#3-order) - includes status enum values and state transition rules
- [X] T015 [P] Define OrderItem schema in packages/db/src/schema/order-items.ts (id, orderId FK, dishId FK, quantity, priceAtOrder, specialInstructions, createdAt) | **Reference**: [data-model.md Section 4](./data-model.md#4-orderitem) - includes cascade delete and historical pricing
- [X] T016 [P] Define OrderStatusHistory schema in packages/db/src/schema/order-status-history.ts (id, orderId FK, status, changedBy userId FK, changedAt) | **Reference**: [data-model.md Section 8](./data-model.md#8-orderstatushistory) - audit trail pattern
- [X] T017 [P] Define Payment schema in packages/db/src/schema/payments.ts (id, orderId FK, amount, method, paidAt) | **Reference**: [data-model.md Section 9](./data-model.md#9-payment) - includes 1:1 relationship with Order
- [X] T018 Export all schemas and types from packages/db/src/index.ts | **Reference**: [data-model.md Type Exports Summary](./data-model.md#type-exports-summary)
- [X] T019 Generate initial Drizzle migration files with proper indexes | **Reference**: [data-model.md Indexes and Performance](./data-model.md#indexes-and-performance) - includes critical index definitions
- [X] T020 Create database seed script in packages/db/src/seed.ts (30 tables, 3 test users, 15 dishes, 20 ingredients with recipes) | **Reference**: [data-model.md Seed Data Requirements](./data-model.md#seed-data-requirements) - includes complete seed data specification

### Authentication Setup

- [X] T021 Configure Better-Auth in packages/auth/src/index.ts with role-based permissions (Manager, KitchenStaff, Waiter) | **Reference**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) - includes complete implementation pattern with role enum and user fields
- [X] T022 Implement auth middleware for tRPC context in packages/api/src/context.ts | **Reference**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) - includes context creation pattern with session extraction
- [X] T023 Create auth client configuration in apps/web/src/lib/auth-client.ts | **Reference**: [plan.md Task 1.5](./plan.md#task-15-setup-better-auth)

### API Infrastructure

- [X] T024 Setup tRPC app router structure in packages/api/src/index.ts with router aggregation | **Reference**: [plan.md Task 1.6](./plan.md#task-16-setup-trpc-infrastructure)
- [X] T025 Create tRPC context with auth and DB client in packages/api/src/context.ts | **Reference**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) - includes protected procedure pattern
- [X] T026 Configure Hono server entry point in apps/server/src/index.ts with tRPC integration | **Reference**: [plan.md Task 1.6](./plan.md#task-16-setup-trpc-infrastructure)
- [X] T027 Setup WebSocket handler in apps/server/src/websocket.ts with role-based connection management (kitchen, serving, manager) | **Reference**: [research.md Section 1](./research.md#1-real-time-notification-architecture) - includes complete WebSocket implementation pattern with connection pooling by role
- [X] T028 Configure CORS and middleware for Hono server | **Reference**: [plan.md Task 1.6](./plan.md#task-16-setup-trpc-infrastructure)

### Frontend Foundation

- [X] T029 Configure Vite for React 18+ in apps/web/vite.config.ts with bundle size optimization | **Reference**: [research.md Section 8](./research.md#8-performance-optimization-strategies) - includes code splitting and bundle optimization
- [X] T030 Setup TanStack Router in apps/web/src/main.tsx with file-based routing | **Reference**: [plan.md Task 1.8](./plan.md#task-18-frontend-trpc-client-setup)
- [X] T031 Create root layout in apps/web/src/routes/__root.tsx with Header and ThemeProvider | **Reference**: [plan.md Project Structure](./plan.md#source-code-repository-root)
- [X] T032 Setup tRPC client in apps/web/src/utils/trpc.ts with React Query integration | **Reference**: [research.md Section 8](./research.md#8-performance-optimization-strategies) - includes tRPC batching configuration
- [X] T033 [P] Setup shadcn/ui configuration in apps/web/components.json
- [X] T034 [P] Install base shadcn/ui components (Button, Card, Input, Label, Dropdown, Skeleton, Sonner)
- [X] T035 Create theme provider in apps/web/src/components/theme-provider.tsx
- [X] T036 Create header component in apps/web/src/components/header.tsx with mode toggle and navigation
- [X] T037 Create loader component in apps/web/src/components/loader.tsx for async states

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Customer Self-Service Ordering (Priority: P1) 🎯 MVP

**Goal**: Enable customers to scan QR codes, browse the menu, add items to their order, and submit orders that immediately notify the kitchen and update inventory.

**Independent Test**: Scan a table QR code (or navigate to /?table=5), browse the menu, add items to an order, and submit it. Verify the order appears in the kitchen dashboard and ingredient quantities decrease appropriately.

**Reference**: [spec.md User Story 1](./spec.md#user-story-1---customer-self-service-ordering-priority-p1) - includes all 6 acceptance scenarios

**Plan Reference**: [plan.md Week 2 US1](./plan.md#week-2-3-p1-user-stories-days-6-15)

### Tests for User Story 1 (TDD-First)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

**TDD Workflow Reference**: [quickstart.md TDD Example](./quickstart.md#example-implementing-orderscreate) - demonstrates Red-Green-Refactor cycle

- [ ] T038 [P] [US1] Contract test for tables.getById in packages/api/tests/routers/tables.test.ts | **Contract**: [tables-router.md Procedure 2](./contracts/tables-router.md#2-tablesgetbyid)
- [ ] T039 [P] [US1] Contract test for dishes.getAll in packages/api/tests/routers/dishes.test.ts | **Contract**: [dishes-router.md Procedure 1](./contracts/dishes-router.md#1-dishesgetall)
- [ ] T040 [P] [US1] Contract test for orders.create in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 1](./contracts/orders-router.md#1-orderscreate)
- [ ] T041 [P] [US1] Contract test for orders.submit with inventory reduction in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 2](./contracts/orders-router.md#2-orderssubmit) | **Transaction Pattern**: [research.md Section 3](./research.md#3-inventory-management-and-stock-validation)
- [ ] T042 [P] [US1] Integration test for complete customer ordering flow in apps/server/tests/integration/customer-ordering.test.ts | **Test Strategy**: [research.md Section 7](./research.md#7-testing-strategy-for-tdd-workflow)

### Implementation for User Story 1

#### Tables Router (QR Code Validation)

- [ ] T043 [P] [US1] Implement tables.getById query in packages/api/src/routers/tables.ts with Zod validation | **Contract**: [tables-router.md Procedure 2](./contracts/tables-router.md#2-tablesgetbyid) | **Data Model**: [data-model.md Section 2](./data-model.md#2-table)
- [ ] T044 [P] [US1] Implement tables.getAll query in packages/api/src/routers/tables.ts | **Contract**: [tables-router.md Procedure 1](./contracts/tables-router.md#1-tablesgetall)
- [ ] T045 [US1] Add tables router to main app router in packages/api/src/routers/index.ts

#### Dishes Router (Menu Display)

- [ ] T046 [P] [US1] Implement dishes.getAll query in packages/api/src/routers/dishes.ts with stock availability check | **Contract**: [dishes-router.md Procedure 1](./contracts/dishes-router.md#1-dishesgetall) | **Business Logic**: Join Recipe and Ingredient to compute isAvailable flag | **Plan Reference**: [plan.md Task 2.1](./plan.md#task-21-implement-dishesgetall-procedure)
- [ ] T047 [P] [US1] Implement dishes.getById query in packages/api/src/routers/dishes.ts with recipe details | **Contract**: [dishes-router.md Procedure 2](./contracts/dishes-router.md#2-dishesgetbyid)
- [ ] T048 [US1] Add dishes router to main app router in packages/api/src/routers/index.ts

#### Orders Router (Order Creation & Submission)

- [ ] T049 [P] [US1] Implement orders.create mutation in packages/api/src/routers/orders.ts with table session logic | **Contract**: [orders-router.md Procedure 1](./contracts/orders-router.md#1-orderscreate) | **Business Logic**: Check for active unpaid order at table, add to existing or create new | **Plan Reference**: [plan.md Task 2.3](./plan.md#task-23-implement-orderscreate-procedure-tdd)
- [ ] T050 [US1] Implement orders.submit mutation in packages/api/src/routers/orders.ts with transactional inventory reduction | **Contract**: [orders-router.md Procedure 2](./contracts/orders-router.md#2-orderssubmit) | **Transaction Pattern**: [research.md Section 3](./research.md#3-inventory-management-and-stock-validation) - includes complete transaction example with FOR UPDATE lock | **Plan Reference**: [plan.md Task 2.4](./plan.md#task-24-implement-orderssubmit-procedure-with-stock-reduction)
- [ ] T051 [US1] Implement orders.addItems mutation in packages/api/src/routers/orders.ts for adding to existing orders | **Contract**: [orders-router.md Procedure 3](./contracts/orders-router.md#3-ordersadditems) | **Acceptance**: [spec.md US1 Scenario 5-6](./spec.md#user-story-1---customer-self-service-ordering-priority-p1)
- [ ] T052 [US1] Add WebSocket notification broadcasting to orders.submit for kitchen alerts | **WebSocket Pattern**: [research.md Section 1](./research.md#1-real-time-notification-architecture) - includes broadcast function example | **Contract**: [orders-router.md WebSocket NEW_ORDER](./contracts/orders-router.md#2-orderssubmit)
- [ ] T053 [US1] Add orders router to main app router in packages/api/src/routers/index.ts

#### Customer Frontend (QR Ordering Flow)

- [ ] T054 [P] [US1] Create landing page route in apps/web/src/routes/index.tsx with QR parameter handling | **QR Session Logic**: [research.md Section 4](./research.md#4-qr-code-generation-and-table-session-management) | **Acceptance**: [spec.md US1 Scenario 1](./spec.md#user-story-1---customer-self-service-ordering-priority-p1) | **Plan Reference**: [plan.md Task 2.2](./plan.md#task-22-build-customer-menu-ui)
- [ ] T055 [P] [US1] Create MenuList component in apps/web/src/components/menu-list.tsx to display available dishes | **Acceptance**: [spec.md US1 Scenario 1](./spec.md#user-story-1---customer-self-service-ordering-priority-p1)
- [ ] T056 [P] [US1] Create OrderCart component in apps/web/src/components/order-cart.tsx to manage order items | **Acceptance**: [spec.md US1 Scenario 2](./spec.md#user-story-1---customer-self-service-ordering-priority-p1)
- [ ] T057 [US1] Implement order submission flow in apps/web/src/routes/index.tsx with success/error handling | **Acceptance**: [spec.md US1 Scenario 3](./spec.md#user-story-1---customer-self-service-ordering-priority-p1) | **Plan Reference**: [plan.md Task 2.5](./plan.md#task-25-build-order-cart--submission-ui)
- [ ] T058 [US1] Add out-of-stock indicators and unavailable dish handling in MenuList component | **Acceptance**: [spec.md US1 Scenario 4](./spec.md#user-story-1---customer-self-service-ordering-priority-p1)
- [ ] T059 [US1] Add loading states and optimistic updates for order submission | **State Management**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates)

**Checkpoint**: User Story 1 complete - customers can order via QR, orders appear in kitchen, inventory updates automatically

---

## Phase 4: User Story 2 - Kitchen Order Management (Priority: P1)

**Goal**: Kitchen staff view incoming orders on a dashboard, see which dishes need to be prepared for which tables, update order status as they work, and notify serving staff when dishes are ready.

**Independent Test**: Create test orders manually (via staff interface or direct API), verify they appear on the kitchen dashboard grouped by table, change their status through the workflow (Pending → In Kitchen → Ready to Serve), and verify status updates are reflected in real-time.

**Reference**: [spec.md User Story 2](./spec.md#user-story-2---kitchen-order-management-priority-p1) - includes all 5 acceptance scenarios

**Plan Reference**: [plan.md Week 3 US2](./plan.md#week-3-day-1-3-kitchen-dashboard-us2-part-1)

### Tests for User Story 2 (TDD-First)

- [X] T060 [P] [US2] Contract test for orders.getAll with status filtering in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 8](./contracts/orders-router.md#8-ordersgetkitchenorders)
- [X] T061 [P] [US2] Contract test for orders.updateStatus in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 5](./contracts/orders-router.md#5-ordersupdatestatus) | **State Transitions**: [data-model.md Order Section](./data-model.md#3-order)
- [ ] T062 [P] [US2] Integration test for kitchen workflow (Pending → In Kitchen → Ready) in apps/server/tests/integration/kitchen-workflow.test.ts | **Plan Reference**: [plan.md Task 3.4](./plan.md#task-34-implement-ordersupdatestatus-mutation)
- [ ] T063 [P] [US2] WebSocket notification test for kitchen alerts in apps/server/tests/integration/websocket.test.ts | **WebSocket Events**: [orders-router.md WebSocket Notifications](./contracts/orders-router.md#2-orderssubmit)

### Implementation for User Story 2

#### Orders Router Extensions (Status Management)

- [X] T064 [P] [US2] Implement orders.getAll query in packages/api/src/routers/orders.ts with filtering by status and table | **Contract**: [orders-router.md Procedure 8](./contracts/orders-router.md#8-ordersgetkitchenorders) | **Business Logic**: Group by table, sort by createdAt ASC | **Plan Reference**: [plan.md Task 3.1](./plan.md#task-31-implement-ordersgetkitchenorders-query)
- [X] T065 [US2] Implement orders.updateStatus mutation in packages/api/src/routers/orders.ts with status history tracking | **Contract**: [orders-router.md Procedure 5](./contracts/orders-router.md#5-ordersupdatestatus) | **Data Model**: [data-model.md OrderStatusHistory](./data-model.md#8-orderstatushistory) | **Plan Reference**: [plan.md Task 3.4](./plan.md#task-34-implement-ordersupdatestatus-mutation)
- [X] T066 [US2] Add WebSocket notification broadcasting to orders.updateStatus for serving staff alerts (Ready to Serve) | **WebSocket Pattern**: [research.md Section 1](./research.md#1-real-time-notification-architecture) | **Contract**: [orders-router.md ORDER_READY Event](./contracts/orders-router.md#5-ordersupdatestatus)
- [X] T067 [US2] Implement orders.getById query in packages/api/src/routers/orders.ts with full order details | **Contract**: [orders-router.md Procedure 6](./contracts/orders-router.md#6-ordersgetbyid)

#### Kitchen Dashboard Frontend

- [ ] T068 [P] [US2] Create kitchen route in apps/web/src/routes/kitchen.tsx with authentication guard (KitchenStaff role) | **Auth Guard**: [research.md Section 5 Access Control Matrix](./research.md#5-role-based-access-control-with-better-auth) | **Acceptance**: [spec.md US2 Scenario 1-2](./spec.md#user-story-2---kitchen-order-management-priority-p1) | **Plan Reference**: [plan.md Task 3.2](./plan.md#task-32-build-kitchen-dashboard-ui)
- [ ] T069 [P] [US2] Create OrdersBoard component in apps/web/src/components/orders-board.tsx with status columns (Pending, In Kitchen, Ready) | **Acceptance**: [spec.md US2 Scenario 5](./spec.md#user-story-2---kitchen-order-management-priority-p1)
- [ ] T070 [P] [US2] Create OrderCard component in apps/web/src/components/order-card.tsx displaying table, dishes, quantities, timestamps | **Acceptance**: [spec.md US2 Scenario 1](./spec.md#user-story-2---kitchen-order-management-priority-p1)
- [ ] T071 [US2] Implement WebSocket connection in kitchen.tsx for real-time order updates | **WebSocket Integration**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates) - includes query invalidation pattern | **Plan Reference**: [plan.md Task 3.3](./plan.md#task-33-implement-websocket-integration-for-new_order)
- [ ] T072 [US2] Add status transition buttons to OrderCard for moving orders through workflow | **Acceptance**: [spec.md US2 Scenario 3-4](./spec.md#user-story-2---kitchen-order-management-priority-p1) | **Plan Reference**: [plan.md Task 3.5](./plan.md#task-35-add-status-update-buttons-to-kitchen-dashboard)
- [ ] T073 [US2] Add visual distinction between different order statuses with color coding | **Acceptance**: [spec.md US2 Scenario 5](./spec.md#user-story-2---kitchen-order-management-priority-p1)
- [ ] T074 [US2] Implement auto-refresh and real-time notification handling in kitchen dashboard | **State Management**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates)

**Checkpoint**: User Story 2 complete - kitchen staff can view and manage orders in real-time

---

## Phase 5: User Story 3 - Staff-Assisted Ordering (Priority: P2)

**Goal**: Waiters can create orders manually on behalf of customers using the staff interface, specifying table number and dishes.

**Independent Test**: Log in as a waiter, create an order for a specific table by selecting dishes from the menu, submit it, and verify it appears in the kitchen dashboard exactly like a QR-generated order.

**Reference**: [spec.md User Story 3](./spec.md#user-story-3---staff-assisted-ordering-priority-p2) - includes all 5 acceptance scenarios

**Plan Reference**: [plan.md Week 4 US3](./plan.md#day-1-2-staff-assisted-ordering-us3)

### Tests for User Story 3 (TDD-First)

- [ ] T075 [P] [US3] Contract test for staff order creation with authentication in packages/api/tests/routers/orders.test.ts | **Contract**: Reuses [orders-router.md Procedure 1](./contracts/orders-router.md#1-orderscreate) with authenticated context | **Acceptance**: [spec.md US3 Scenario 3](./spec.md#user-story-3---staff-assisted-ordering-priority-p2)
- [ ] T076 [P] [US3] Integration test for waiter-created orders matching QR order behavior in apps/server/tests/integration/staff-ordering.test.ts | **Acceptance**: [spec.md US3 Scenario 3](./spec.md#user-story-3---staff-assisted-ordering-priority-p2)

### Implementation for User Story 3

#### Staff Order Creation Frontend

- [ ] T077 [P] [US3] Create login route in apps/web/src/routes/login.tsx with Better-Auth integration | **Auth Pattern**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) | **Plan Reference**: [plan.md Task 4.1](./plan.md#task-41-build-staff-order-creation-ui)
- [ ] T078 [P] [US3] Create sign-in form component in apps/web/src/components/sign-in-form.tsx | **Seed Users**: [data-model.md Seed Data](./data-model.md#seed-data-requirements) - use waiter@restauranthub.com / password123
- [ ] T079 [P] [US3] Create dashboard route in apps/web/src/routes/dashboard.tsx with role-based redirection | **Access Control**: [research.md Section 5 Access Control Matrix](./research.md#5-role-based-access-control-with-better-auth)
- [ ] T080 [US3] Create staff-ordering route in apps/web/src/routes/staff-order.tsx (Waiter/Manager access) | **Acceptance**: [spec.md US3 Scenario 1-2](./spec.md#user-story-3---staff-assisted-ordering-priority-p2)
- [ ] T081 [US3] Create TableSelector component in apps/web/src/components/table-selector.tsx for choosing table | **Acceptance**: [spec.md US3 Scenario 1](./spec.md#user-story-3---staff-assisted-ordering-priority-p2)
- [ ] T082 [US3] Reuse MenuList and OrderCart components for staff order creation | **Acceptance**: [spec.md US3 Scenario 2](./spec.md#user-story-3---staff-assisted-ordering-priority-p2)
- [ ] T083 [US3] Add authentication guards to protected routes using Better-Auth session checks | **Auth Middleware**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth)
- [ ] T084 [US3] Create user menu component in apps/web/src/components/user-menu.tsx with logout functionality

**Checkpoint**: User Story 3 complete - staff can create orders on behalf of customers

---

## Phase 6: User Story 4 - Order Status Tracking and Serving (Priority: P2)

**Goal**: Serving staff receive notifications when dishes are ready, view which tables need service, update order status to "Served" when delivered, and mark orders as "Completed" when customers finish.

**Independent Test**: Create orders and advance them to "Ready to Serve" status. Verify serving staff see notifications, can mark orders as "Served" when delivered, and can complete orders. Verify status history is tracked.

**Reference**: [spec.md User Story 4](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2) - includes all 5 acceptance scenarios

**Plan Reference**: [plan.md Week 4 US4](./plan.md#day-3-4-serving-dashboard-us4)

### Tests for User Story 4 (TDD-First)

- [ ] T085 [P] [US4] Contract test for orders.getAll with ReadyToServe filter in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 9](./contracts/orders-router.md#9-ordersgetservingorders)
- [ ] T086 [P] [US4] Contract test for order status transitions (Served, Completed) in packages/api/tests/routers/orders.test.ts | **Contract**: [orders-router.md Procedure 5](./contracts/orders-router.md#5-ordersupdatestatus) | **State Transitions**: [data-model.md Order Status](./data-model.md#3-order)
- [ ] T087 [P] [US4] WebSocket notification test for serving alerts in apps/server/tests/integration/websocket.test.ts | **WebSocket Event**: [orders-router.md ORDER_READY](./contracts/orders-router.md#5-ordersupdatestatus)
- [ ] T088 [P] [US4] Integration test for complete serving workflow in apps/server/tests/integration/serving-workflow.test.ts | **Acceptance**: [spec.md US4 All Scenarios](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2)

### Implementation for User Story 4

#### Serving Dashboard Frontend

- [ ] T089 [P] [US4] Create serving route in apps/web/src/routes/serving.tsx with authentication guard (Waiter role) | **Auth Guard**: [research.md Section 5 Access Control Matrix](./research.md#5-role-based-access-control-with-better-auth) | **Acceptance**: [spec.md US4 Scenario 1](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2) | **Plan Reference**: [plan.md Task 4.2](./plan.md#task-42-implement-ordersgetservingorders-query)
- [ ] T090 [P] [US4] Create ServingQueue component in apps/web/src/components/serving-queue.tsx showing Ready and Served orders | **Contract**: [orders-router.md Procedure 9](./contracts/orders-router.md#9-ordersgetservingorders) | **Acceptance**: [spec.md US4 Scenario 3](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2)
- [ ] T091 [US4] Implement WebSocket connection in serving.tsx for real-time Ready to Serve notifications | **WebSocket Integration**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates) | **Acceptance**: [spec.md US4 Scenario 1](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2)
- [ ] T092 [US4] Add status transition actions (mark as Served, mark as Completed) to ServingQueue | **Contract**: [orders-router.md updateStatus](./contracts/orders-router.md#5-ordersupdatestatus) | **Acceptance**: [spec.md US4 Scenario 2, 4](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2)
- [ ] T093 [US4] Display full order status history with timestamps in order detail view | **Data Model**: [data-model.md OrderStatusHistory](./data-model.md#8-orderstatushistory) | **Acceptance**: [spec.md US4 Scenario 5](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2)
- [ ] T094 [US4] Add priority sorting (oldest orders first) in serving queue | **Business Logic**: [orders-router.md Procedure 9](./contracts/orders-router.md#9-ordersgetservingorders) - sort by waitTime DESC

**Checkpoint**: User Story 4 complete - serving staff can track and manage order delivery

---

## Phase 7: User Story 5 - Inventory Management and Alerts (Priority: P3)

**Goal**: Managers view current ingredient inventory, see which items are running low, receive alerts when stock falls below minimum thresholds, and manually adjust inventory levels.

**Independent Test**: View the inventory dashboard showing all ingredients with current quantities. Manually adjust an ingredient quantity. Create orders that consume ingredients and verify quantities decrease. Set low-stock thresholds and verify alerts appear when thresholds are crossed.

**Reference**: [spec.md User Story 5](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3) - includes all 6 acceptance scenarios

**Plan Reference**: [plan.md Week 5 US5](./plan.md#week-5-p3-inventory-management-days-21-25)

### Tests for User Story 5 (TDD-First)

- [ ] T095 [P] [US5] Contract test for inventory.getAll in packages/api/tests/routers/inventory.test.ts | **Contract**: [inventory-router.md Procedure 1](./contracts/inventory-router.md#1-inventorygetall) | **Acceptance**: [spec.md US5 Scenario 1](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T096 [P] [US5] Contract test for inventory.adjustStock in packages/api/tests/routers/inventory.test.ts | **Contract**: [inventory-router.md Procedure 3](./contracts/inventory-router.md#3-inventoryadjuststock) | **Acceptance**: [spec.md US5 Scenario 3](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T097 [P] [US5] Contract test for inventory.updateThreshold in packages/api/tests/routers/inventory.test.ts | **Contract**: [inventory-router.md Procedure 4](./contracts/inventory-router.md#4-inventoryupdatethreshold) | **Acceptance**: [spec.md US5 Scenario 6](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T098 [P] [US5] Integration test for low-stock alerts in apps/server/tests/integration/inventory-alerts.test.ts | **Acceptance**: [spec.md US5 Scenario 2, 6](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)

### Implementation for User Story 5

#### Inventory Router

- [ ] T099 [P] [US5] Implement inventory.getAll query in packages/api/src/routers/inventory.ts with low-stock calculation | **Contract**: [inventory-router.md Procedure 1](./contracts/inventory-router.md#1-inventorygetall) | **Data Model**: [data-model.md Ingredient](./data-model.md#6-ingredient) | **Business Logic**: Compute isLowStock = quantity < threshold | **Plan Reference**: [plan.md Task 5.1](./plan.md#task-51-implement-inventory-router-procedures)
- [ ] T100 [P] [US5] Implement inventory.getById query in packages/api/src/routers/inventory.ts with dish usage details | **Contract**: [inventory-router.md Procedure 2](./contracts/inventory-router.md#2-inventorygetbyid) | **Data Model**: Join with Recipe and Dish tables
- [ ] T101 [P] [US5] Implement inventory.adjustStock mutation in packages/api/src/routers/inventory.ts with validation | **Contract**: [inventory-router.md Procedure 3](./contracts/inventory-router.md#3-inventoryadjuststock) | **Business Logic**: Prevent negative quantities | **Acceptance**: [spec.md US5 Scenario 3](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T102 [P] [US5] Implement inventory.updateThreshold mutation in packages/api/src/routers/inventory.ts | **Contract**: [inventory-router.md Procedure 4](./contracts/inventory-router.md#4-inventoryupdatethreshold) | **Acceptance**: [spec.md US5 Scenario 6](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T103 [US5] Add inventory router to main app router in packages/api/src/routers/index.ts

#### Inventory Dashboard Frontend

- [ ] T104 [P] [US5] Create inventory route in apps/web/src/routes/inventory.tsx with authentication guard (Manager only) | **Auth Guard**: [research.md Section 5 Access Control Matrix](./research.md#5-role-based-access-control-with-better-auth) - Manager only access | **Acceptance**: [spec.md US5 Scenario 1](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3) | **Plan Reference**: [plan.md Task 5.2](./plan.md#task-52-build-inventory-dashboard)
- [ ] T105 [P] [US5] Create InventoryTable component in apps/web/src/components/inventory-table.tsx showing all ingredients | **Contract**: [inventory-router.md Procedure 1 Output](./contracts/inventory-router.md#1-inventorygetall) | **Acceptance**: [spec.md US5 Scenario 1](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T106 [P] [US5] Create IngredientRow component in apps/web/src/components/ingredient-row.tsx with low-stock highlighting | **Acceptance**: [spec.md US5 Scenario 2](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3) - red background or warning icon
- [ ] T107 [US5] Create StockAdjustmentModal component in apps/web/src/components/stock-adjustment-modal.tsx for editing quantities | **Acceptance**: [spec.md US5 Scenario 3](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T108 [US5] Create ThresholdEditor component in apps/web/src/components/threshold-editor.tsx for setting alert levels | **Acceptance**: [spec.md US5 Scenario 6](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T109 [US5] Add visual alerts (red highlighting, warning icons) for low-stock ingredients | **Acceptance**: [spec.md US5 Scenario 2](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3)
- [ ] T110 [US5] Display which dishes use each ingredient in inventory detail view | **Contract**: [inventory-router.md Procedure 1 with includeRecipes=true](./contracts/inventory-router.md#1-inventorygetall)

**Checkpoint**: User Story 5 complete - managers can monitor and manage inventory

---

## Phase 8: User Story 6 - Cash Payment Processing (Priority: P2)

**Goal**: When a customer is ready to pay, serving staff view the order total, mark the order as "Paid" after receiving cash, and the table session is cleared for the next customer.

**Independent Test**: Create and complete an order through all stages. View the order total in the staff interface. Mark the order as "Paid" after receiving cash. Verify the table session is reset and the QR code can be used for a new order.

**Reference**: [spec.md User Story 6](./spec.md#user-story-6---cash-payment-processing-priority-p2) - includes all 5 acceptance scenarios

**Plan Reference**: [plan.md Week 4 Day 5 US6](./plan.md#day-5-cash-payment-us6)

### Tests for User Story 6 (TDD-First)

- [ ] T111 [P] [US6] Contract test for payments.create in packages/api/tests/routers/payments.test.ts | **Contract**: [payments-router.md Procedure 1](./contracts/payments-router.md#1-paymentscreate) | **Acceptance**: [spec.md US6 Scenario 2](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T112 [P] [US6] Contract test for payments.getHistory in packages/api/tests/routers/payments.test.ts | **Contract**: [payments-router.md Procedure 3](./contracts/payments-router.md#3-paymentsgethistory) | **Acceptance**: [spec.md US6 Scenario 4](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T113 [P] [US6] Integration test for payment flow and table session clearing in apps/server/tests/integration/payment-flow.test.ts | **Business Logic**: [payments-router.md clear table session](./contracts/payments-router.md#1-paymentscreate) | **Acceptance**: [spec.md US6 Scenario 3](./spec.md#user-story-6---cash-payment-processing-priority-p2)

### Implementation for User Story 6

#### Payments Router

- [ ] T114 [P] [US6] Implement payments.create mutation in packages/api/src/routers/payments.ts with amount validation | **Contract**: [payments-router.md Procedure 1](./contracts/payments-router.md#1-paymentscreate) | **Data Model**: [data-model.md Payment](./data-model.md#9-payment) | **Business Logic**: Validate order status is Completed/Served, amount matches totalAmount | **Plan Reference**: [plan.md Task 4.3](./plan.md#task-43-implement-paymentscreate-mutation)
- [ ] T115 [P] [US6] Implement payments.getById query in packages/api/src/routers/payments.ts | **Contract**: [payments-router.md Procedure 2](./contracts/payments-router.md#2-paymentsgetbyid)
- [ ] T116 [P] [US6] Implement payments.getHistory query in packages/api/src/routers/payments.ts with filtering | **Contract**: [payments-router.md Procedure 3](./contracts/payments-router.md#3-paymentsgethistory) | **Acceptance**: [spec.md US6 Scenario 4](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T117 [US6] Add table session clearing logic to payments.create (allow new orders after payment) | **Contract**: [payments-router.md Business Logic](./contracts/payments-router.md#1-paymentscreate) - update order status to Paid, clear table session | **Acceptance**: [spec.md US6 Scenario 3](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T118 [US6] Add WebSocket notification for payment completion to managers | **WebSocket Event**: [payments-router.md PAYMENT_COMPLETED](./contracts/payments-router.md#1-paymentscreate) | **Pattern**: [research.md Section 1](./research.md#1-real-time-notification-architecture)
- [ ] T119 [US6] Add payments router to main app router in packages/api/src/routers/index.ts

#### Payment Processing Frontend

- [ ] T120 [P] [US6] Create payment route in apps/web/src/routes/payment.tsx with authentication guard (Waiter/Manager) | **Auth Guard**: [research.md Section 5 Access Control Matrix](./research.md#5-role-based-access-control-with-better-auth) - Waiter and Manager access | **Plan Reference**: [plan.md Task 4.4](./plan.md#task-44-build-payment-ui)
- [ ] T121 [P] [US6] Create OrderBillView component in apps/web/src/components/order-bill-view.tsx showing itemized order | **Acceptance**: [spec.md US6 Scenario 1](./spec.md#user-story-6---cash-payment-processing-priority-p2) - display dishes, quantities, prices, total
- [ ] T122 [P] [US6] Create PaymentConfirmation component in apps/web/src/components/payment-confirmation.tsx | **Acceptance**: [spec.md US6 Scenario 2](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T123 [US6] Implement payment processing workflow in payment.tsx (calculate total, confirm payment, clear table) | **Contract**: [payments-router.md create](./contracts/payments-router.md#1-paymentscreate) | **Acceptance**: [spec.md US6 Scenario 2-3](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T124 [US6] Create PaymentHistory component in apps/web/src/components/payment-history.tsx for viewing past transactions | **Contract**: [payments-router.md getHistory](./contracts/payments-router.md#3-paymentsgethistory) | **Acceptance**: [spec.md US6 Scenario 4](./spec.md#user-story-6---cash-payment-processing-priority-p2)
- [ ] T125 [US6] Add payment history view to manager dashboard | **Auth**: Manager-only access

**Checkpoint**: User Story 6 complete - staff can process payments and clear table sessions

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Menu Management (FR-001a, FR-001b, FR-001c)

**Reference**: [spec.md Functional Requirements](./spec.md#functional-requirements) - FR-001a, FR-001b, FR-001c

- [ ] T126 [P] Implement dishes.create mutation in packages/api/src/routers/dishes.ts for managers | **Contract**: [dishes-router.md Procedure 3](./contracts/dishes-router.md#3-dishescreate) | **Auth**: Manager only
- [ ] T127 [P] Implement dishes.update mutation in packages/api/src/routers/dishes.ts for managers | **Contract**: [dishes-router.md Procedure 4](./contracts/dishes-router.md#4-dishesupdate) | **Auth**: Manager only
- [ ] T128 [P] Implement dishes.toggleAvailability mutation in packages/api/src/routers/dishes.ts for managers | **Contract**: [dishes-router.md Procedure 5](./contracts/dishes-router.md#5-dishestoggleavailability) | **Auth**: Manager only
- [ ] T129 Create menu-management route in apps/web/src/routes/menu-management.tsx (Manager only) | **Auth Guard**: Manager-only access
- [ ] T130 Create DishEditor component in apps/web/src/components/dish-editor.tsx for add/edit operations | **Data Model**: [data-model.md Dish](./data-model.md#5-dish)

### Error Handling & Validation

**Reference**: [research.md Section 9](./research.md#9-error-handling-and-validation)

- [ ] T131 [P] Add comprehensive Zod validation schemas for all tRPC inputs | **Pattern**: [research.md Section 9 Error Handling Pattern](./research.md#9-error-handling-and-validation) - includes Zod schema examples
- [ ] T132 [P] Implement global error handler in apps/server/src/index.ts | **Best Practices**: Never expose database errors to frontend
- [ ] T133 [P] Add error boundaries in apps/web/src/routes/__root.tsx | **UX**: User-friendly error messages
- [ ] T134 Add user-friendly error messages with toast notifications using Sonner | **Error Categories**: [research.md Section 9 Error Categories](./research.md#9-error-handling-and-validation)

### Performance Optimization

**Reference**: [research.md Section 8](./research.md#8-performance-optimization-strategies)

- [ ] T135 [P] Add database indexes for frequently queried fields (orders.status, orders.tableId, ingredients.quantity) | **Indexes**: [data-model.md Indexes and Performance](./data-model.md#indexes-and-performance) - includes all critical index definitions
- [ ] T136 [P] Implement tRPC query batching in apps/web/src/utils/trpc.ts | **Pattern**: [research.md Section 8 tRPC Batching](./research.md#8-performance-optimization-strategies) - includes httpBatchLink configuration
- [ ] T137 [P] Optimize WebSocket connection pooling in apps/server/src/websocket.ts | **Pattern**: [research.md Section 1 WebSocket](./research.md#1-real-time-notification-architecture)
- [ ] T138 Add loading skeletons for all async data fetching in frontend components | **UX**: Loading states < 200ms requirement

### Documentation & Developer Experience

- [ ] T139 [P] Create API documentation from tRPC schema in docs/api-reference.md | **Contracts**: Reference all contracts/*.md files
- [ ] T140 [P] Document WebSocket message types and flows in docs/websocket-protocol.md | **Reference**: [research.md Section 1](./research.md#1-real-time-notification-architecture) and all contract WebSocket sections
- [ ] T141 [P] Update README.md with setup instructions and architecture overview | **Reference**: [quickstart.md](./quickstart.md) for setup steps
- [ ] T142 Run quickstart.md validation (verify all setup steps work correctly) | **Validation**: [plan.md Checkpoint 1.3](./plan.md#checkpoint-13--foundation-complete)

### Security & Production Readiness

**Reference**: [research.md Section 10](./research.md#10-deployment-and-environment-configuration)

- [ ] T143 [P] Implement rate limiting for public endpoints (orders.create) | **Security**: Constitution security standards
- [ ] T144 [P] Add CSRF protection for authenticated mutations | **Security**: Better-Auth provides CSRF tokens
- [ ] T145 [P] Configure environment-specific CORS policies | **Config**: [research.md Section 10 Environment Config](./research.md#10-deployment-and-environment-configuration)
- [ ] T146 Add security headers (HSTS, CSP, X-Frame-Options) in Hono middleware | **Best Practices**: Constitution security standards
- [ ] T147 Create production environment configuration for Turso database | **Deployment**: [research.md Section 10 Deployment Checklist](./research.md#10-deployment-and-environment-configuration)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P1): Can start after Foundational - No dependencies on other stories (orders router is separate)
  - User Story 3 (P2): Depends on US1 (uses orders router) and US2 (waiter sees orders in kitchen)
  - User Story 4 (P2): Depends on US2 (extends orders router status management)
  - User Story 5 (P3): Can start after Foundational - No dependencies on other stories (separate inventory router)
  - User Story 6 (P2): Depends on US4 (orders must reach Completed status before payment)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Independently testable (QR ordering + inventory reduction)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independently testable (kitchen dashboard with mock orders)
- **User Story 3 (P2)**: Integrates with US1 orders router - Independently testable (staff creates order, appears in kitchen)
- **User Story 4 (P2)**: Extends US2 order status management - Independently testable (manually set orders to Ready, verify serving workflow)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Independently testable (inventory CRUD separate from orders)
- **User Story 6 (P2)**: Requires US4 order completion status - Independently testable (manually complete orders, test payment)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD Red-Green-Refactor)
- Database schemas before API routers
- API routers before frontend components
- Core implementation before integration with other stories
- Story complete and tested before moving to next priority

### Parallel Opportunities

#### Phase 1 (Setup)
- All tasks marked [P] can run in parallel (T003, T004, T005, T007)

#### Phase 2 (Foundational)
Within database schema: T009-T013, T015-T017 can run in parallel (different schema files)
Within frontend foundation: T033-T034 can run in parallel (independent UI components)

#### After Phase 2 Completion
- **US1 and US2 can start in parallel** (different routers: tables/dishes/orders vs. orders status management)
- **US5 can start in parallel with US1/US2** (separate inventory router)

#### Within Each User Story
- All test tasks marked [P] within a story can run in parallel
- All router procedure implementations marked [P] can run in parallel
- All independent frontend components marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch all US1 tests together:
Task T038: Contract test for tables.getById
Task T039: Contract test for dishes.getAll
Task T040: Contract test for orders.create
Task T041: Contract test for orders.submit with inventory reduction
Task T042: Integration test for complete customer ordering flow

# Then launch all US1 router implementations together:
Task T043: Implement tables.getById query
Task T044: Implement tables.getAll query
Task T046: Implement dishes.getAll query
Task T047: Implement dishes.getById query
Task T049: Implement orders.create mutation

# Then launch all US1 frontend components together:
Task T054: Create landing page route
Task T055: Create MenuList component
Task T056: Create OrderCart component
```

---

## Parallel Example: Multiple User Stories

```bash
# After Phase 2 completes, three developers can work in parallel:

# Developer A: User Story 1 (Customer Ordering)
# Works through T038-T059 sequentially within US1

# Developer B: User Story 2 (Kitchen Dashboard)
# Works through T060-T074 sequentially within US2

# Developer C: User Story 5 (Inventory Management)
# Works through T095-T110 sequentially within US5

# These three stories are independently testable and can be developed in parallel
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T037) **CRITICAL - blocks all stories**
3. Complete Phase 3: User Story 1 (T038-T059) - Customer QR ordering
4. Complete Phase 4: User Story 2 (T060-T074) - Kitchen dashboard
5. **STOP and VALIDATE**: Test US1 + US2 independently
   - Customers can order via QR
   - Orders appear in kitchen dashboard in real-time
   - Kitchen staff can update order status
   - Inventory reduces automatically
6. Deploy/demo if ready - this is a functional MVP!

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational (T001-T037) → Foundation ready
2. Add User Story 1 + User Story 2 (T038-T074) → Test independently → Deploy/Demo (MVP! ✅)
3. Add User Story 3 (T075-T084) → Test independently → Deploy/Demo (staff ordering added)
4. Add User Story 4 (T085-T094) → Test independently → Deploy/Demo (serving workflow added)
5. Add User Story 6 (T111-T125) → Test independently → Deploy/Demo (payments complete transaction)
6. Add User Story 5 (T095-T110) → Test independently → Deploy/Demo (inventory management for operations)
7. Complete Phase 9: Polish (T126-T147) → Production-ready

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T037)
2. Once Foundational is done, split into parallel tracks:
   - **Developer A**: User Story 1 (T038-T059) - Customer ordering
   - **Developer B**: User Story 2 (T060-T074) - Kitchen dashboard
   - **Developer C**: User Story 5 (T095-T110) - Inventory management
3. **Integrate and test**: US1 + US2 together (core MVP)
4. **Sequential priorities**:
   - Developer A: User Story 3 (T075-T084) - Staff ordering
   - Developer B: User Story 4 (T085-T094) - Serving workflow
   - Developer C: User Story 6 (T111-T125) - Payments
5. **Team completes Polish together** (T126-T147)

---

## Summary

**Total Tasks**: 147 tasks across 9 phases

**Task Breakdown by Phase**:
- Phase 1 (Setup): 7 tasks
- Phase 2 (Foundational): 30 tasks ⚠️ BLOCKING
- Phase 3 (US1 - Customer Ordering): 22 tasks (5 tests + 17 implementation)
- Phase 4 (US2 - Kitchen Management): 15 tasks (4 tests + 11 implementation)
- Phase 5 (US3 - Staff Ordering): 10 tasks (2 tests + 8 implementation)
- Phase 6 (US4 - Serving Workflow): 10 tasks (4 tests + 6 implementation)
- Phase 7 (US5 - Inventory Management): 16 tasks (4 tests + 12 implementation)
- Phase 8 (US6 - Payment Processing): 15 tasks (3 tests + 12 implementation)
- Phase 9 (Polish): 22 tasks

**Task Breakdown by User Story**:
- User Story 1 (P1): 22 tasks - Customer self-service QR ordering
- User Story 2 (P1): 15 tasks - Kitchen order management
- User Story 3 (P2): 10 tasks - Staff-assisted ordering
- User Story 4 (P2): 10 tasks - Serving and status tracking
- User Story 5 (P3): 16 tasks - Inventory management
- User Story 6 (P2): 15 tasks - Cash payment processing

**Parallel Opportunities**:
- Phase 1: 4 tasks can run in parallel
- Phase 2: 13 tasks can run in parallel
- After Phase 2: US1, US2, and US5 can start in parallel (56 tasks across 3 stories)
- Within each user story: 5-10 tasks can run in parallel (tests, models, components)

**MVP Scope** (Recommended first delivery):
- Setup + Foundational + US1 + US2 = **74 tasks**
- Delivers: Customer QR ordering + Kitchen dashboard + Real-time notifications + Inventory reduction
- Estimated effort: 2-3 weeks for 1 developer, 1-2 weeks for 2 developers working in parallel

**Format Validation**: ✅ All tasks follow checklist format with checkbox, task ID, optional [P] marker, [Story] label for user story tasks, and specific file paths.

---

## Cross-Reference Guide

**Quick Navigation**: Use this guide to find detailed information referenced in tasks above.

### Design Documents Overview

| Document | Purpose | Key Content |
|----------|---------|-------------|
| [plan.md](./plan.md) | Implementation roadmap | Week-by-week breakdown, task dependencies, checkpoints |
| [spec.md](./spec.md) | Feature specification | 6 user stories with acceptance scenarios, functional requirements |
| [data-model.md](./data-model.md) | Database schema | 9 entity definitions with validation rules, relationships, TypeScript types |
| [research.md](./research.md) | Technical decisions | 10 architectural patterns with code examples |
| [quickstart.md](./quickstart.md) | Developer onboarding | Setup instructions, TDD workflow examples |
| [contracts/*.md](./contracts/) | API specifications | 5 tRPC routers with input/output schemas, business logic |

### Key Sections by Implementation Area

#### Database Schema (Phase 2: T008-T020)
- **User**: [data-model.md Section 1](./data-model.md#1-user) - roles, validation, auth integration
- **Table**: [data-model.md Section 2](./data-model.md#2-table) - QR code format, capacity
- **Order**: [data-model.md Section 3](./data-model.md#3-order) - status enum, state transitions
- **OrderItem**: [data-model.md Section 4](./data-model.md#4-orderitem) - pricing snapshot, special instructions
- **Dish**: [data-model.md Section 5](./data-model.md#5-dish) - availability logic, menu management
- **Ingredient**: [data-model.md Section 6](./data-model.md#6-ingredient) - low-stock thresholds
- **Recipe**: [data-model.md Section 7](./data-model.md#7-recipe) - dish-ingredient relationship
- **OrderStatusHistory**: [data-model.md Section 8](./data-model.md#8-orderstatushistory) - audit trail
- **Payment**: [data-model.md Section 9](./data-model.md#9-payment) - 1:1 with Order
- **Indexes**: [data-model.md Indexes and Performance](./data-model.md#indexes-and-performance)
- **Seed Data**: [data-model.md Seed Data Requirements](./data-model.md#seed-data-requirements)

#### API Routers (Phases 3-8)
- **Orders**: [contracts/orders-router.md](./contracts/orders-router.md) - 10 procedures including create, submit, updateStatus, getKitchenOrders, getServingOrders
- **Dishes**: [contracts/dishes-router.md](./contracts/dishes-router.md) - getAll, getById, create, update, toggleAvailability
- **Inventory**: [contracts/inventory-router.md](./contracts/inventory-router.md) - getAll, adjustStock, updateThreshold
- **Tables**: [contracts/tables-router.md](./contracts/tables-router.md) - getAll, getById, create
- **Payments**: [contracts/payments-router.md](./contracts/payments-router.md) - create, getById, getHistory

#### Technical Patterns (All Phases)
- **WebSocket**: [research.md Section 1](./research.md#1-real-time-notification-architecture) - connection pooling, broadcasting by role
- **Database Transactions**: [research.md Section 3](./research.md#3-inventory-management-and-stock-validation) - atomic stock reduction with FOR UPDATE lock
- **QR Code Session**: [research.md Section 4](./research.md#4-qr-code-generation-and-table-session-management) - table session logic
- **Authentication**: [research.md Section 5](./research.md#5-role-based-access-control-with-better-auth) - Better-Auth config, protected procedures, access control matrix
- **State Management**: [research.md Section 6](./research.md#6-frontend-state-management-and-real-time-updates) - TanStack Query, WebSocket integration
- **Testing Strategy**: [research.md Section 7](./research.md#7-testing-strategy-for-tdd-workflow) - unit, integration, E2E test patterns
- **Performance**: [research.md Section 8](./research.md#8-performance-optimization-strategies) - indexes, tRPC batching, code splitting
- **Error Handling**: [research.md Section 9](./research.md#9-error-handling-and-validation) - Zod schemas, tRPC error codes, user-friendly messages
- **Deployment**: [research.md Section 10](./research.md#10-deployment-and-environment-configuration) - environment variables, Turso setup

#### User Story Acceptance Criteria (Phases 3-8)
- **US1 (Customer Ordering)**: [spec.md US1](./spec.md#user-story-1---customer-self-service-ordering-priority-p1) - 6 scenarios
- **US2 (Kitchen Management)**: [spec.md US2](./spec.md#user-story-2---kitchen-order-management-priority-p1) - 5 scenarios
- **US3 (Staff Ordering)**: [spec.md US3](./spec.md#user-story-3---staff-assisted-ordering-priority-p2) - 5 scenarios
- **US4 (Serving)**: [spec.md US4](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2) - 5 scenarios
- **US5 (Inventory)**: [spec.md US5](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3) - 6 scenarios
- **US6 (Payment)**: [spec.md US6](./spec.md#user-story-6---cash-payment-processing-priority-p2) - 5 scenarios

#### Functional Requirements
- **FR-001 to FR-036**: [spec.md Functional Requirements](./spec.md#functional-requirements) - complete requirements list with traceability

### Task-to-Document Mapping

#### When implementing schema tasks (T009-T017):
1. Read corresponding entity section in data-model.md
2. Check validation rules and constraints
3. Review TypeScript type exports
4. Reference seed data requirements

#### When implementing API router tasks (T043-T125):
1. Read procedure specification in contracts/*.md
2. Check input/output schemas (Zod)
3. Review business logic requirements
4. Check WebSocket notification requirements
5. Reference related data model sections

#### When implementing frontend tasks (T054-T125):
1. Read acceptance scenarios in spec.md
2. Check contract output schemas for data structure
3. Review state management patterns in research.md Section 6
4. Check auth guard requirements in research.md Section 5

#### When writing tests (T038-T113):
1. Read TDD workflow in quickstart.md
2. Review acceptance scenarios in spec.md
3. Check contract specifications for expected behavior
4. Reference test strategy in research.md Section 7

### File Path Quick Reference

| Component | File Path | Primary Reference |
|-----------|-----------|-------------------|
| Database Schemas | `packages/db/src/schema/*.ts` | [data-model.md](./data-model.md) |
| Orders API | `packages/api/src/routers/orders.ts` | [orders-router.md](./contracts/orders-router.md) |
| Dishes API | `packages/api/src/routers/dishes.ts` | [dishes-router.md](./contracts/dishes-router.md) |
| Inventory API | `packages/api/src/routers/inventory.ts` | [inventory-router.md](./contracts/inventory-router.md) |
| Tables API | `packages/api/src/routers/tables.ts` | [tables-router.md](./contracts/tables-router.md) |
| Payments API | `packages/api/src/routers/payments.ts` | [payments-router.md](./contracts/payments-router.md) |
| WebSocket | `apps/server/src/websocket.ts` | [research.md Sec 1](./research.md#1-real-time-notification-architecture) |
| Auth Config | `packages/auth/src/index.ts` | [research.md Sec 5](./research.md#5-role-based-access-control-with-better-auth) |
| Customer Menu | `apps/web/src/routes/index.tsx` | [spec.md US1](./spec.md#user-story-1---customer-self-service-ordering-priority-p1) |
| Kitchen Dashboard | `apps/web/src/routes/kitchen.tsx` | [spec.md US2](./spec.md#user-story-2---kitchen-order-management-priority-p1) |
| Serving Dashboard | `apps/web/src/routes/serving.tsx` | [spec.md US4](./spec.md#user-story-4---order-status-tracking-and-serving-priority-p2) |
| Inventory Dashboard | `apps/web/src/routes/inventory.tsx` | [spec.md US5](./spec.md#user-story-5---inventory-management-and-alerts-priority-p3) |

### Validation Checkpoints

Refer to [plan.md Implementation Roadmap](./plan.md#implementation-roadmap) for detailed validation checkpoints at each phase:
- **Checkpoint 1.1**: Database schema validation (after T020)
- **Checkpoint 1.2**: tRPC infrastructure validation (after T026)
- **Checkpoint 1.3**: Foundation complete (after T037)
- **Checkpoint 2.1**: Menu display working (after T054-T058)
- **Checkpoint 2.2**: US1 complete (after T059)
- **Checkpoint 3.1**: Kitchen dashboard real-time (after T074)
- **Checkpoint 3.2**: US2 complete (after T074)
- **Checkpoint 4.1**: Staff ordering working (after T084)
- **Checkpoint 4.2**: P2 features complete (after T125)
- **Checkpoint 5.1**: P3 inventory complete (after T110)

---

## Usage Guide for Developers/LLMs

### Starting a Task
1. **Read the task description** with file path
2. **Follow the Reference links** (marked with `|` separator)
3. **Review acceptance scenarios** if US task
4. **Check related data model** for entity structure
5. **Read contract specification** for API tasks
6. **Review technical pattern** from research.md if complex

### Example: Implementing T050 (orders.submit)
```
Task: Implement orders.submit mutation in packages/api/src/routers/orders.ts with transactional inventory reduction

References to read:
1. Contract: contracts/orders-router.md#2-orderssubmit (input/output schemas, business logic)
2. Transaction Pattern: research.md#3-inventory-management-and-stock-validation (code example)
3. Plan Reference: plan.md#task-24-implement-orderssubmit-procedure-with-stock-reduction (context)
4. Data Model: data-model.md#3-order (status enum), #6-ingredient (stock reduction)
5. Acceptance: spec.md US1 Scenario 3 (expected behavior)

Implementation steps:
1. Copy transaction pattern from research.md Section 3
2. Adapt to orders.submit mutation following contract spec
3. Add WebSocket notification per contract
4. Write test first (T041) following TDD workflow
```

### Common Patterns
- **All tRPC procedures**: Use Zod for input validation, reference contract for schema
- **All WebSocket events**: Reference research.md Section 1 for broadcast pattern
- **All database transactions**: Reference research.md Section 3 for FOR UPDATE lock
- **All auth guards**: Reference research.md Section 5 for role-based middleware
- **All frontend queries**: Reference research.md Section 6 for TanStack Query patterns

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD-First**: Verify tests fail before implementing (Red-Green-Refactor cycle)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All file paths are relative to repository root (c:\personal\learn-bettert\)
