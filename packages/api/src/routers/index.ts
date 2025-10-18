import { publicProcedure, router } from "../index"
import { categoriesRouter } from "./categories"
import { dishesRouter } from "./dishes"
import { inventoryRouter } from "./inventory"
import { ordersRouter } from "./orders"
import { paymentsRouter } from "./payments"
import { tablesRouter } from "./tables"

/**
 * Main tRPC application router - aggregates all sub-routers
 * Reference: plan.md Task 1.6 - Setup tRPC Infrastructure
 *
 * Phase 3 Backend Implementation (T045, T048, T053):
 * ✅ tables: QR code validation, table management
 * ✅ dishes: Menu display, dish availability
 * ✅ orders: Order creation, submission, status management
 *
 * Phase 7: User Story 5 (T103):
 * ✅ inventory: Ingredient stock management, low-stock alerts
 *
 * Phase 8: User Story 6 (T119):
 * ✅ payments: Cash payment processing, payment history
 *
 * Phase 2: Foundational (T015):
 * ✅ categories: Menu category management and dish organization
 */
export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: "OK", timestamp: new Date().toISOString() }
  }),
  // Phase 3: User Story 1 routers
  tables: tablesRouter,
  dishes: dishesRouter,
  orders: ordersRouter,
  // Phase 7: User Story 5 router (T103)
  inventory: inventoryRouter,
  // Phase 8: User Story 6 router (T119)
  payments: paymentsRouter,
  // Phase 2: Foundational (T015) - Advanced Operations Management
  categories: categoriesRouter,
})

export type AppRouter = typeof appRouter
