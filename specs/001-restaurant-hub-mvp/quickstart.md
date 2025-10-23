# QuickStart Guide: RestaurantHub MVP Development

**Branch**: `001-restaurant-hub-mvp`  
**Date**: 2025-10-17  
**Phase**: Phase 1 - Design Complete

## Purpose

This guide provides step-by-step instructions for developers to set up the development environment, understand the architecture, and begin implementing the RestaurantHub MVP following TDD principles.

---

## Prerequisites

Before starting, ensure you have:

1. **Bun 1.3+** installed: [https://bun.sh/docs/installation](https://bun.sh/docs/installation)
2. **Git** installed and configured
3. **VS Code** (recommended) with extensions:
   - TypeScript + JavaScript Language Features
   - Tailwind CSS IntelliSense
   - Prettier - Code formatter
   - ESLint
4. **SQLite** viewer (optional): [DB Browser for SQLite](https://sqlitebrowser.org/) or VS Code extension

---

## Project Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd restaurant-hub

# Checkout feature branch
git checkout 001-restaurant-hub-mvp

# Install dependencies for all workspaces
bun install
```

### 2. Environment Configuration

Create `.env` files in each app workspace:

**apps/server/.env**:

```bash
# Database (local development)
DATABASE_URL=file:./local.db

# Server
PORT=3000
NODE_ENV=development

# Better-Auth
BETTER_AUTH_SECRET=your-32-character-secret-here-replace
BETTER_AUTH_URL=http://localhost:3000
```

**apps/web/.env**:

```bash
# API URL
VITE_API_URL=http://localhost:3000

# App URL (for QR codes)
VITE_APP_URL=http://localhost:3001
```

**Generate Better-Auth Secret**:

```bash
# Use Bun to generate a secure random string
bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Setup

```bash
# Navigate to database package
cd packages/db

# Generate Drizzle schema types
bun run db:generate

# Run migrations to create tables
bun run db:migrate

# Seed initial data (tables, users, sample dishes)
bun run db:seed
```

**Seed Data Includes**:

- 30 tables with QR codes
- 3 test users:
  - Manager: `admin@restauranthub.com` / `password123`
  - Kitchen Staff: `chef@restauranthub.com` / `password123`
  - Waiter: `waiter@restauranthub.com` / `password123`
- 15 sample dishes
- 20 ingredients with recipes

### 4. Start Development Servers

Open 2 terminal windows:

**Terminal 1 - Backend Server**:

```bash
cd apps/server
bun run dev
# Server will start on http://localhost:3000
```

**Terminal 2 - Frontend App**:

```bash
cd apps/web
bun run dev
# App will start on http://localhost:3001
```

### 5. Verify Setup

1. **Backend health check**: Open [http://localhost:3000/health](http://localhost:3000/health)
   - Should return `{ "status": "ok" }`

2. **Frontend**: Open [http://localhost:3001](http://localhost:3001)
   - Should see landing page

3. **tRPC Playground** (if enabled): [http://localhost:3000/trpc-panel](http://localhost:3000/trpc-panel)

4. **Test QR Code Flow**: [http://localhost:3001/?table=5](http://localhost:3001/?table=5)
   - Should show menu for Table 5

---

## Architecture Overview

### Monorepo Structure

```
restaurant-hub/
├── apps/
│   ├── server/          # Backend: Hono + tRPC + WebSocket
│   └── web/             # Frontend: React + TanStack Router
├── packages/
│   ├── api/             # Shared tRPC routers
│   ├── auth/            # Better-Auth configuration
│   └── db/              # Drizzle ORM schema & migrations
├── specs/               # Feature specifications
└── tests/               # Workspace-level integration tests
```

### Data Flow

```
Customer Phone (QR Scan)
    ↓
apps/web (React UI)
    ↓
TanStack Router (file-based routes)
    ↓
tRPC Client (type-safe API calls)
    ↓
apps/server (Hono HTTP + WebSocket)
    ↓
packages/api (tRPC routers)
    ↓
packages/db (Drizzle ORM)
    ↓
SQLite Database
```

### Real-Time Flow

```
Order Submitted
    ↓
tRPC mutation (orders.submit)
    ↓
Database transaction (reduce inventory)
    ↓
WebSocket broadcast (NEW_ORDER event)
    ↓
Kitchen Dashboard (React component)
    ↓
TanStack Query invalidation
    ↓
UI re-renders with new order
```

---

## Development Workflow (TDD-First)

### Phase Overview

1. **Red**: Write failing test
2. **Green**: Write minimum code to pass test
3. **Refactor**: Improve code while keeping tests green

### Example: Implementing `orders.create`

#### Step 1: Write Test (Red Phase)

```typescript
// packages/api/tests/routers/orders.test.ts
import { beforeEach, describe, expect, test } from "bun:test"

import { appRouter } from "../../src/index"
import { clearDatabase, seedTestData } from "../helpers/db"

describe("Orders Router - create", () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestData()
  })

  test("should create new order for table with valid dishes", async () => {
    // Arrange
    const caller = appRouter.createCaller({ user: null, role: null })

    // Act
    const result = await caller.orders.create({
      tableId: 5,
      items: [
        { dishId: 1, quantity: 2 },
        { dishId: 2, quantity: 1 },
      ],
    })

    // Assert
    expect(result.orderId).toBeGreaterThan(0)
    expect(result.isNew).toBe(true)
    expect(result.itemCount).toBe(2)
    expect(result.totalAmount).toBeGreaterThan(0)
  })

  test("should return error if table does not exist", async () => {
    const caller = appRouter.createCaller({ user: null, role: null })

    await expect(
      caller.orders.create({
        tableId: 999,
        items: [{ dishId: 1, quantity: 1 }],
      })
    ).rejects.toThrow("Table not found")
  })

  test("should add to existing order if table has unpaid order", async () => {
    const caller = appRouter.createCaller({ user: null, role: null })

    // Create first order
    const firstOrder = await caller.orders.create({
      tableId: 5,
      items: [{ dishId: 1, quantity: 1 }],
    })

    // Create second order for same table
    const secondOrder = await caller.orders.create({
      tableId: 5,
      items: [{ dishId: 2, quantity: 1 }],
    })

    expect(secondOrder.orderId).toBe(firstOrder.orderId)
    expect(secondOrder.isNew).toBe(false)
    expect(secondOrder.itemCount).toBe(2)
  })
})
```

**Run test (should fail)**:

```bash
cd packages/api
bun test routers/orders.test.ts
# ❌ Tests fail because orders.create is not implemented
```

#### Step 2: Implement Minimum Code (Green Phase)

```typescript
// packages/api/src/routers/orders.ts
import { db } from "@repo/db"
import { dishes, orderItems, orders, tables } from "@repo/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { publicProcedure, router } from "../trpc"

export const ordersRouter = router({
  create: publicProcedure
    .input(
      z.object({
        tableId: z.number().int().positive(),
        items: z
          .array(
            z.object({
              dishId: z.number().int().positive(),
              quantity: z.number().int().min(1),
              specialInstructions: z.string().max(255).optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Validate table exists
      const table = await db.select().from(tables).where(eq(tables.id, input.tableId)).get()
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" })
      }

      // 2. Check for existing unpaid order at this table
      const existingOrder = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tableId, input.tableId), ne(orders.status, "Paid")))
        .get()

      let orderId: number
      let isNew = false

      if (existingOrder) {
        // Add to existing order
        orderId = existingOrder.id
      } else {
        // Create new order
        const newOrder = await db
          .insert(orders)
          .values({
            tableId: input.tableId,
            status: "Pending",
            totalAmount: 0,
          })
          .returning()
        orderId = newOrder[0].id
        isNew = true
      }

      // 3. Add order items
      for (const item of input.items) {
        // Validate dish exists
        const dish = await db.select().from(dishes).where(eq(dishes.id, item.dishId)).get()
        if (!dish) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Dish ${item.dishId} not found` })
        }

        await db.insert(orderItems).values({
          orderId,
          dishId: item.dishId,
          quantity: item.quantity,
          priceAtOrder: dish.price,
          specialInstructions: item.specialInstructions,
        })
      }

      // 4. Recalculate total amount
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
      const totalAmount = items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0)

      await db
        .update(orders)
        .set({ totalAmount, updatedAt: new Date() })
        .where(eq(orders.id, orderId))

      return {
        orderId,
        isNew,
        totalAmount,
        itemCount: items.length,
      }
    }),
})
```

**Run test (should pass)**:

```bash
bun test routers/orders.test.ts
# ✅ Tests pass
```

#### Step 3: Refactor (Refactor Phase)

```typescript
// Extract helper functions for reusability and clarity
async function getActiveOrderForTable(tableId: number) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.tableId, tableId), ne(orders.status, "Paid")))
    .get()
}

async function calculateOrderTotal(orderId: number): Promise<number> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  return items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0)
}

// Refactor mutation to use helper functions
export const ordersRouter = router({
  create: publicProcedure.input(createOrderSchema).mutation(async ({ input }) => {
    const table = await validateTableExists(input.tableId)
    const existingOrder = await getActiveOrderForTable(input.tableId)

    const orderId = existingOrder?.id ?? (await createNewOrder(input.tableId))
    await addItemsToOrder(orderId, input.items)
    const totalAmount = await calculateOrderTotal(orderId)

    await updateOrderTotal(orderId, totalAmount)

    return {
      orderId,
      isNew: !existingOrder,
      totalAmount,
      itemCount: input.items.length,
    }
  }),
})
```

**Run tests again (ensure still passing)**:

```bash
bun test routers/orders.test.ts
# ✅ Tests still pass after refactor
```

### Testing Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test packages/api/tests/routers/orders.test.ts

# Run with coverage
bun test --coverage

# Watch mode (re-run on file changes)
bun test --watch
```

---

## Implementation Priority (Following Spec)

### P1: Core MVP (Implement First)

1. **User Story 1**: Customer Self-Service Ordering
   - Routes: `orders.create`, `orders.submit`, `dishes.getAll`
   - UI: `/` (QR landing), `/menu`, `/order-confirmation`
   - Tests: E2E customer ordering flow

2. **User Story 2**: Kitchen Order Management
   - Routes: `orders.getKitchenOrders`, `orders.updateStatus`
   - UI: `/kitchen` dashboard
   - WebSocket: Real-time order notifications
   - Tests: Kitchen workflow integration tests

### P2: Enhanced Functionality

3. **User Story 3**: Staff-Assisted Ordering
   - Routes: `auth.login`, `orders.create` (authenticated)
   - UI: `/login`, `/staff/orders/create`
   - Tests: Staff order creation flow

4. **User Story 4**: Order Status Tracking and Serving
   - Routes: `orders.getServingOrders`
   - UI: `/serving` dashboard
   - WebSocket: Ready-to-serve notifications
   - Tests: Serving workflow tests

5. **User Story 6**: Cash Payment Processing
   - Routes: `payments.create`, `payments.getHistory`
   - UI: `/payment`, `/history`
   - Tests: Payment workflow tests

### P3: Inventory Management

6. **User Story 5**: Inventory Management and Alerts
   - Routes: `inventory.getAll`, `inventory.adjustStock`, `inventory.getLowStockAlerts`
   - UI: `/inventory` dashboard
   - WebSocket: Low-stock alerts
   - Tests: Inventory tracking tests

---

## Key Files to Start With

### 1. Database Schema

- **File**: `packages/db/src/schema/orders.ts`
- **Action**: Define `orders` and `orderItems` tables using Drizzle

### 2. tRPC Router

- **File**: `packages/api/src/routers/orders.ts`
- **Action**: Implement `orders.create` procedure with Zod validation

### 3. React Route

- **File**: `apps/web/src/routes/index.tsx`
- **Action**: Create customer ordering page (QR landing)

### 4. WebSocket Handler

- **File**: `apps/server/src/websocket.ts`
- **Action**: Set up connection management and broadcast functions

---

## Useful Commands

### Development

```bash
# Start backend
bun --cwd apps/server dev

# Start frontend
bun --cwd apps/web dev

# Run both (from root)
bun run dev
```

### Database

```bash
# Generate migration from schema changes
bun --cwd packages/db db:generate

# Apply migrations
bun --cwd packages/db db:migrate

# Reset database (drop all tables and re-seed)
bun --cwd packages/db db:reset
```

### Code Quality

```bash
# Type checking
bun run check-types

# Linting
bun run lint

# Formatting
bun run format

# Run all quality checks
bun run ci
```

### Testing

```bash
# Unit tests
bun test

# Integration tests
bun test tests/integration

# E2E tests (requires running servers)
bun test tests/e2e

# Coverage report
bun test --coverage
open coverage/index.html
```

---

## Debugging Tips

### Backend Debugging

1. Add breakpoints in VS Code
2. Run with Bun inspector: `bun --inspect apps/server/src/index.ts`
3. Use VS Code "Attach to Process" debugger

### Frontend Debugging

1. React DevTools browser extension
2. TanStack Router DevTools (built-in)
3. tRPC DevTools: `http://localhost:3000/trpc-panel`

### Database Inspection

```bash
# Open SQLite database
sqlite3 apps/server/local.db

# Run query
sqlite> SELECT * FROM orders;

# Show schema
sqlite> .schema orders
```

---

## Common Issues & Solutions

### Issue: `DATABASE_URL` not found

**Solution**: Ensure `.env` file exists in `apps/server/` directory

### Issue: Port 3000 already in use

**Solution**: Kill existing process or change `PORT` in `.env`

### Issue: TypeScript errors after schema changes

**Solution**: Run `bun run db:generate` to regenerate types

### Issue: WebSocket not connecting

**Solution**: Verify backend is running and WebSocket upgrade is enabled in Hono config

---

## Next Steps After Setup

1. ✅ Verify all tests in `packages/db/tests/` pass
2. ✅ Complete Phase 0 research (read `research.md`)
3. ✅ Review data model (`data-model.md`)
4. ✅ Study API contracts (`contracts/*.md`)
5. 🚀 Begin TDD implementation of P1 user stories

---

## Resources

- **Bun Documentation**: [https://bun.sh/docs](https://bun.sh/docs)
- **Hono Documentation**: [https://hono.dev/](https://hono.dev/)
- **tRPC Documentation**: [https://trpc.io/docs](https://trpc.io/docs)
- **Drizzle ORM**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **TanStack Router**: [https://tanstack.com/router](https://tanstack.com/router)
- **Better-Auth**: [https://better-auth.com/docs](https://better-auth.com/docs)
- **shadcn/ui**: [https://ui.shadcn.com/](https://ui.shadcn.com/)

---

**Phase 1 Complete**: Development environment guide created. Ready for Phase 2 (task breakdown) via `/speckit.tasks` command.
