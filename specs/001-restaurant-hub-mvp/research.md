# Research: RestaurantHub MVP

**Phase**: Phase 0 - Outline & Research  
**Date**: 2025-10-17  
**Branch**: `001-restaurant-hub-mvp`

## Purpose

This document resolves all technical unknowns and establishes best practices for implementing RestaurantHub using the Better-T-Stack. All NEEDS CLARIFICATION items from the Technical Context are addressed with specific technology choices, rationale, and implementation patterns.

---

## 1. Real-Time Notification Architecture

### Decision: WebSocket via Hono WebSocket Support

**Rationale**:
- Hono 4.8+ provides built-in WebSocket support through `hono/ws` adapter
- Bidirectional communication enables server-to-client push for order notifications
- Lower latency than polling or SSE for real-time kitchen/serving dashboards
- Connection persistence allows instant notification delivery (< 5 second requirement)
- Better-T-Stack already uses Hono; no additional framework needed

**Implementation Pattern**:
```typescript
// apps/server/src/websocket.ts
import { createBunWebSocket } from 'hono/bun'

const { upgradeWebSocket, websocket } = createBunWebSocket()

// Connection management per user role
const connections = {
  kitchen: new Set<WebSocket>(),
  serving: new Set<WebSocket>(),
  manager: new Set<WebSocket>()
}

// Broadcast to specific role
function notifyKitchen(order: Order) {
  connections.kitchen.forEach(ws => {
    ws.send(JSON.stringify({ type: 'NEW_ORDER', order }))
  })
}
```

**Alternatives Considered**:
- **Server-Sent Events (SSE)**: Unidirectional only; requires polling for client actions
- **Long polling**: Higher server load, not truly real-time
- **Socket.io**: Additional dependency; Hono native support is sufficient

**Integration Points**:
- Server: `apps/server/src/websocket.ts` handles connections and broadcasting
- API: tRPC mutation procedures trigger WebSocket notifications after DB updates
- Frontend: React hook `useWebSocket()` manages connection lifecycle and message handling

---

## 2. Database Schema Design for Order Lifecycle

### Decision: Drizzle ORM with SQLite Relations and Status Enum

**Rationale**:
- Drizzle provides type-safe schema definition with automatic TypeScript type generation
- SQLite JSON support for flexible order metadata (special instructions, modifications)
- Foreign key constraints ensure referential integrity (Order → OrderItem → Dish → Recipe → Ingredient)
- Status enum enforces valid transitions: `Pending → In Kitchen → Ready to Serve → Served → Completed → Paid`
- Timestamps tracked per status change via audit trail pattern

**Schema Structure**:
```typescript
// packages/db/src/schema/orders.ts
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableId: integer('table_id').notNull().references(() => tables.id),
  status: text('status', { enum: ['Pending', 'InKitchen', 'ReadyToServe', 'Served', 'Completed', 'Paid'] }).notNull().default('Pending'),
  totalAmount: integer('total_amount').notNull(), // Stored in cents
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  dishId: integer('dish_id').notNull().references(() => dishes.id),
  quantity: integer('quantity').notNull(),
  priceAtOrder: integer('price_at_order').notNull(), // Historical price in cents
  specialInstructions: text('special_instructions'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const orderStatusHistory = sqliteTable('order_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  changedBy: integer('user_id').references(() => users.id),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})
```

**Alternatives Considered**:
- **Separate tables per status**: Over-normalized; difficult to query order lifecycle
- **Document database (MongoDB)**: Better-T-Stack standardizes on relational DB; type safety harder to maintain
- **PostgreSQL**: Requires external server; SQLite (local) + Turso (production) aligns with stack goals

**Best Practices**:
- Store monetary values as integers (cents) to avoid floating-point errors
- Capture `priceAtOrder` in `OrderItem` for historical accuracy (menu prices may change)
- Cascade deletes on `OrderItem` when `Order` is deleted (referential integrity)
- Index `orders.tableId` and `orders.status` for fast dashboard queries

---

## 3. Inventory Management and Stock Validation

### Decision: Transactional Stock Reduction with Optimistic Locking

**Rationale**:
- Prevent negative inventory through atomic read-check-update operations
- Drizzle transactions ensure all-or-nothing stock deductions when order is submitted
- Concurrent order submissions handled via database-level checks
- Recipe-based ingredient calculation: `Dish → Recipe → Ingredient` with quantities

**Implementation Pattern**:
```typescript
// packages/api/src/routers/orders.ts
async function submitOrder(orderId: number) {
  return db.transaction(async (tx) => {
    // 1. Get order items with recipes
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    
    // 2. Calculate total ingredient requirements
    const ingredientRequirements = calculateIngredients(items)
    
    // 3. Check stock levels (for update lock)
    for (const [ingredientId, requiredQty] of Object.entries(ingredientRequirements)) {
      const ingredient = await tx.select().from(ingredients).where(eq(ingredients.id, ingredientId)).for('update')
      if (ingredient.quantity < requiredQty) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Insufficient stock for ${ingredient.name}` })
      }
    }
    
    // 4. Deduct stock
    for (const [ingredientId, requiredQty] of Object.entries(ingredientRequirements)) {
      await tx.update(ingredients).set({ quantity: sql`quantity - ${requiredQty}` }).where(eq(ingredients.id, ingredientId))
    }
    
    // 5. Update order status
    await tx.update(orders).set({ status: 'Pending' }).where(eq(orders.id, orderId))
  })
}
```

**Alternatives Considered**:
- **Check-then-update without transaction**: Race condition; two simultaneous orders could overdraw stock
- **Pessimistic locking on ingredient table**: High contention; slower performance
- **Event sourcing with inventory ledger**: Over-engineered for MVP; adds complexity

**Best Practices**:
- Use database transactions for atomic stock operations
- Display real-time ingredient availability on customer menu (check stock before adding to cart)
- Low-stock alerts at 20% of threshold (proactive warning before zero)
- Inventory adjustments (restocking) log audit trail with `userId` and `timestamp`

---

## 4. QR Code Generation and Table Session Management

### Decision: QR Code as URL with Table ID Parameter

**Rationale**:
- QR code encodes URL: `https://app.restauranthub.com/?table=5`
- Table number extracted from query parameter and validated against `tables` table
- Session tied to `tableId` in browser localStorage + server-side active order check
- No QR code image generation needed initially; can use free QR generator service for printing

**Implementation Pattern**:
```typescript
// apps/web/src/routes/index.tsx (customer ordering page)
function CustomerOrderPage() {
  const searchParams = useSearch() // TanStack Router
  const tableId = searchParams.table
  
  // Check for active order at this table
  const { data: activeOrder } = trpc.orders.getActiveOrderByTable.useQuery({ tableId })
  
  // If active order exists, add to it; otherwise start new order
  const orderId = activeOrder?.id ?? null
}
```

**Table Session Logic**:
- Customer scans QR → `tableId` loaded → check for unpaid order at table
- If unpaid order exists → add items to existing order (FR-004)
- If no order exists → create new order with status `Pending`
- When order marked `Paid` → table session cleared (FR-029)

**Alternatives Considered**:
- **Dynamic QR with order ID**: Requires backend to generate QR per session; complicates multi-customer scenario
- **NFC tags**: Requires specialized hardware; QR codes work with any smartphone
- **Unique session tokens**: Adds complexity; table number is sufficient identifier

**Best Practices**:
- QR codes are static (printed once per table); URL endpoint handles session logic
- Validate `tableId` exists in database before allowing order creation (prevent invalid table access)
- Display table number prominently in customer UI for verification

---

## 5. Role-Based Access Control with Better-Auth

### Decision: Better-Auth with Role-Based Middleware

**Rationale**:
- Better-Auth 1.3+ provides built-in role management and session handling
- Roles: `Manager`, `KitchenStaff`, `Waiter` defined in database schema
- tRPC context includes authenticated user and role; procedures check permissions
- httpOnly cookies for session tokens (secure, XSS-resistant)

**Implementation Pattern**:
```typescript
// packages/auth/src/index.ts
export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        enum: ['Manager', 'KitchenStaff', 'Waiter'],
        required: true,
      }
    }
  }
})

// packages/api/src/context.ts
export async function createContext({ req }: { req: Request }) {
  const session = await auth.api.getSession({ headers: req.headers })
  return {
    user: session?.user ?? null,
    role: session?.user?.role ?? null,
  }
}

// Protected procedure example
const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return opts.next({ ctx: opts.ctx })
})

const managerOnlyProcedure = protectedProcedure.use(async (opts) => {
  if (opts.ctx.role !== 'Manager') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return opts.next()
})
```

**Alternatives Considered**:
- **JWT tokens**: More complex to manage; Better-Auth provides session management out-of-box
- **Custom auth system**: Reinventing wheel; Better-Auth integrates seamlessly with Bun + Hono
- **API keys**: Less secure for staff; username+password is standard

**Access Control Matrix**:
| Role          | Dashboard Access                              | Permissions                                    |
|---------------|-----------------------------------------------|------------------------------------------------|
| Manager       | All (inventory, orders, kitchen, serving)     | Full CRUD on dishes, ingredients, users        |
| Kitchen Staff | Kitchen dashboard only                        | Update order status (Pending → Ready)          |
| Waiter        | Order creation, serving dashboard, payment    | Create orders, mark served/paid, view tables   |
| Customer      | No auth required (QR code access)             | View menu, add items to order, submit          |

---

## 6. Frontend State Management and Real-Time Updates

### Decision: TanStack Query (React Query) + WebSocket Integration

**Rationale**:
- tRPC client built on TanStack Query; provides caching, refetching, optimistic updates
- WebSocket messages trigger query invalidation to refresh UI
- No additional state management library needed (Redux, Zustand); React Query handles server state
- Component-level subscriptions to WebSocket events for real-time dashboard updates

**Implementation Pattern**:
```typescript
// apps/web/src/hooks/useOrderNotifications.ts
export function useOrderNotifications() {
  const utils = trpc.useUtils()
  const ws = useWebSocket()
  
  useEffect(() => {
    ws.on('NEW_ORDER', (order) => {
      // Invalidate kitchen orders query to trigger refetch
      utils.orders.getKitchenOrders.invalidate()
      
      // Show toast notification
      toast.success(`New order from Table ${order.tableId}`)
    })
    
    ws.on('ORDER_STATUS_CHANGED', (orderId) => {
      // Invalidate specific order query
      utils.orders.getById.invalidate({ id: orderId })
    })
  }, [ws, utils])
}
```

**Alternatives Considered**:
- **Redux**: Overkill for MVP; TanStack Query sufficient for server state
- **Polling**: Inefficient; WebSocket push is real-time requirement
- **Zustand/Jotai**: Unnecessary for server-driven state; React Query handles async state

**Best Practices**:
- Use optimistic updates for order status changes (instant UI feedback, rollback on error)
- Invalidate queries selectively (only affected data, not entire cache)
- Debounce WebSocket message handlers to prevent excessive re-renders

---

## 7. Testing Strategy for TDD Workflow

### Decision: Bun Test with Vitest-Compatible API + Playwright E2E

**Rationale**:
- Bun's native test runner is fast and compatible with Vitest/Jest syntax
- Better-T-Stack requires TDD-first: write tests before implementation (Red-Green-Refactor)
- Unit tests for tRPC procedures, integration tests for API workflows, E2E for user stories
- Test coverage enforced at 80% minimum via `bun test --coverage`

**Test Layers**:

**1. Unit Tests** (packages/api/tests/routers/)
```typescript
// packages/api/tests/routers/orders.test.ts
import { describe, test, expect } from 'bun:test'
import { appRouter } from '../../src/index'

describe('Orders Router', () => {
  test('submitOrder should reduce ingredient stock', async () => {
    const caller = appRouter.createCaller({ user: mockUser, role: 'Waiter' })
    
    // Arrange: Create order with 2 burgers (each requires 1 patty)
    const orderId = await caller.orders.create({ tableId: 5, items: [{ dishId: 1, quantity: 2 }] })
    
    // Act: Submit order
    await caller.orders.submit({ id: orderId })
    
    // Assert: Check ingredient stock reduced by 2
    const ingredient = await caller.inventory.getById({ id: 1 }) // Patty
    expect(ingredient.quantity).toBe(initialStock - 2)
  })
})
```

**2. Integration Tests** (apps/server/tests/integration/)
```typescript
// Test full request/response cycle including WebSocket notification
test('Order submission triggers kitchen WebSocket notification', async () => {
  const ws = await connectWebSocket('ws://localhost:3000/ws?role=kitchen')
  
  // Submit order via HTTP
  await fetch('http://localhost:3000/trpc/orders.submit', { ... })
  
  // Assert WebSocket message received
  const message = await waitForMessage(ws, 5000)
  expect(message.type).toBe('NEW_ORDER')
})
```

**3. E2E Tests** (tests/e2e/)
```typescript
// Playwright test for User Story 1 (Customer Self-Service Ordering)
test('Customer can scan QR, view menu, and submit order', async ({ page }) => {
  // Given: Customer scans table QR code
  await page.goto('http://localhost:3001/?table=5')
  
  // When: They view the menu
  await expect(page.locator('h1')).toContainText('Menu - Table 5')
  
  // Then: They see all available dishes
  const dishes = await page.locator('[data-testid="dish-card"]').count()
  expect(dishes).toBeGreaterThan(0)
  
  // When: They select a dish and submit order
  await page.locator('[data-testid="dish-1"]').click()
  await page.locator('[data-testid="add-to-order"]').click()
  await page.locator('[data-testid="submit-order"]').click()
  
  // Then: Order is created and kitchen is notified
  await expect(page.locator('[data-testid="order-submitted"]')).toBeVisible()
})
```

**Alternatives Considered**:
- **Jest**: Requires Node.js; Bun test runner is faster and native
- **Cypress**: More resource-intensive than Playwright; Playwright has better TypeScript support
- **Manual testing only**: Violates constitution TDD-first principle

**Best Practices**:
- Write test first (Red), implement minimum code to pass (Green), refactor (Refactor cycle)
- Use test fixtures for seeding database with sample data
- Mock external dependencies (WebSocket, Better-Auth) in unit tests
- Run integration tests against ephemeral SQLite database (isolated, fast)

---

## 8. Performance Optimization Strategies

### Decision: Database Indexing + tRPC Batching + React Code Splitting

**Rationale**:
- P95 < 200ms requires optimized database queries and minimal network overhead
- Indexes on frequently queried columns: `orders.status`, `orders.tableId`, `ingredients.quantity`
- tRPC automatic batching combines multiple queries into single HTTP request
- React lazy loading + code splitting reduces initial bundle size (< 500KB target)

**Implementation**:

**1. Database Indexes**
```typescript
// packages/db/src/schema/orders.ts
export const orders = sqliteTable('orders', {
  // ... columns
}, (table) => ({
  statusIdx: index('orders_status_idx').on(table.status),
  tableIdx: index('orders_table_idx').on(table.tableId),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}))
```

**2. tRPC Query Batching**
```typescript
// apps/web/src/utils/trpc.ts
export const trpc = createTRPCReact<AppRouter>()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      maxURLLength: 2083, // Batch queries into single request
    }),
  ],
})
```

**3. React Code Splitting**
```typescript
// apps/web/src/main.tsx
const KitchenDashboard = lazy(() => import('./routes/kitchen'))
const InventoryDashboard = lazy(() => import('./routes/inventory'))

// TanStack Router will automatically code-split routes
```

**Alternatives Considered**:
- **Denormalization**: Premature optimization; normalize first, denormalize if needed
- **Redis caching**: Over-engineered for MVP; SQLite + Drizzle query caching sufficient
- **GraphQL DataLoader**: tRPC batching provides similar benefits without additional layer

**Monitoring**:
- Log query execution time in development (Drizzle's `logger` option)
- Use Bun's built-in performance profiling: `bun --inspect`
- Lighthouse CI for frontend performance metrics (TTI, FCP, LCP)

---

## 9. Error Handling and Validation

### Decision: Zod Schemas for Input Validation + tRPC Error Codes

**Rationale**:
- Zod provides runtime validation and automatic TypeScript type inference
- tRPC input schemas defined with Zod; invalid requests return typed errors
- Better-Auth errors (authentication failures) mapped to tRPC error codes
- User-facing error messages comply with constitution UX principle (friendly, actionable)

**Implementation Pattern**:
```typescript
// packages/api/src/routers/orders.ts
export const ordersRouter = router({
  submit: protectedProcedure
    .input(z.object({
      orderId: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Business logic
        return await submitOrder(input.orderId)
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot submit order: ${error.dishName} is currently unavailable.`,
          })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit order. Please try again.',
        })
      }
    }),
})
```

**Error Categories**:
| Error Type          | tRPC Code               | User Message Example                          |
|---------------------|-------------------------|-----------------------------------------------|
| Invalid input       | `BAD_REQUEST`           | "Invalid table number. Please scan QR again." |
| Insufficient stock  | `BAD_REQUEST`           | "Burger is currently unavailable."            |
| Unauthorized        | `UNAUTHORIZED`          | "Please log in to access this page."          |
| Forbidden           | `FORBIDDEN`             | "You don't have permission to edit menu."     |
| Not found           | `NOT_FOUND`             | "Order not found."                            |
| Server error        | `INTERNAL_SERVER_ERROR` | "Something went wrong. Please try again."     |

**Alternatives Considered**:
- **Class-based exceptions**: Less idiomatic in TypeScript; Zod + tRPC pattern preferred
- **HTTP status codes only**: Less type-safe; tRPC error codes provide better DX
- **Generic error messages**: Violates UX principle; specific, actionable messages required

**Best Practices**:
- Never expose database errors or stack traces to frontend
- Log detailed errors server-side (Bun's console with context)
- Display toast notifications for transient errors (network failures)
- Show inline validation errors for form inputs (Better-Auth forms, order creation)

---

## 10. Deployment and Environment Configuration

### Decision: Turso for Production DB + Environment-Specific Configs

**Rationale**:
- Development: Local SQLite file (`local.db`) for fast iteration
- Production: Turso (hosted SQLite) provides global edge replication
- Environment variables validated at startup using Zod schema
- Secrets (.env files) never committed to repository (git-ignored)

**Environment Configuration**:
```typescript
// apps/server/src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const env = envSchema.parse(process.env)
```

**.env.example**:
```bash
# Database (local development)
DATABASE_URL=file:./local.db

# Database (production - Turso)
# DATABASE_URL=libsql://your-db.turso.io
# DATABASE_AUTH_TOKEN=your-token-here

# Server
PORT=3000
NODE_ENV=development

# Better-Auth
BETTER_AUTH_SECRET=generate-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000
```

**Alternatives Considered**:
- **PostgreSQL**: Requires separate server; Turso provides SQLite edge hosting
- **Supabase**: More opinionated; Better-T-Stack uses Turso + Better-Auth pattern
- **Firebase**: Not part of Better-T-Stack; avoid vendor lock-in

**Deployment Checklist**:
1. Create Turso database: `turso db create restauranthub`
2. Get auth token: `turso db tokens create restauranthub`
3. Run migrations: `bun run db:migrate`
4. Seed initial data (tables, default admin user)
5. Deploy apps/server to production (Fly.io, Railway, etc.)
6. Deploy apps/web to Vercel/Netlify with `VITE_API_URL` env var

---

## Summary

All technical unknowns resolved. Key decisions:
1. **Real-time**: Hono WebSocket for bidirectional push notifications
2. **Database**: Drizzle + SQLite with transactions for inventory safety
3. **Auth**: Better-Auth role-based access control (Manager, Kitchen, Waiter)
4. **Frontend**: TanStack Query + Router for type-safe, real-time UI
5. **Testing**: Bun test with TDD-first workflow (80% coverage minimum)
6. **Performance**: Indexed queries, tRPC batching, React code splitting
7. **Validation**: Zod schemas for runtime safety + TypeScript inference
8. **Deployment**: Local SQLite (dev) → Turso (production)

**Readiness for Phase 1**: All architectural patterns defined. Ready to proceed with data model and API contracts design.
