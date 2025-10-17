import { publicProcedure, router } from "../index";
import { tablesRouter } from "./tables";
import { dishesRouter } from "./dishes";
import { ordersRouter } from "./orders";

/**
 * Main tRPC application router - aggregates all sub-routers
 * Reference: plan.md Task 1.6 - Setup tRPC Infrastructure
 *
 * Phase 3 Backend Implementation (T045, T048, T053):
 * ✅ tables: QR code validation, table management
 * ✅ dishes: Menu display, dish availability
 * ✅ orders: Order creation, submission, status management
 * 
 * Future sub-routers:
 * - inventory: Ingredient stock management, low-stock alerts
 * - payments: Cash payment processing
 */
export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return { status: "OK", timestamp: new Date().toISOString() };
	}),
	// Phase 3: User Story 1 routers
	tables: tablesRouter,
	dishes: dishesRouter,
	orders: ordersRouter,
	// Future routers will be added here:
	// inventory: inventoryRouter,
	// payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
