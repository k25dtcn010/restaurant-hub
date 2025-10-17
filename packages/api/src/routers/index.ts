import { publicProcedure, router } from "../index";

/**
 * Main tRPC application router - aggregates all sub-routers
 * Reference: plan.md Task 1.6 - Setup tRPC Infrastructure
 *
 * Sub-routers will be added as features are implemented:
 * - tables: QR code validation, table management
 * - dishes: Menu display, dish availability
 * - orders: Order creation, submission, status management
 * - inventory: Ingredient stock management, low-stock alerts
 * - payments: Cash payment processing
 */
export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return { status: "OK", timestamp: new Date().toISOString() };
	}),
	// Sub-routers will be added here as they are implemented:
	// tables: tablesRouter,
	// dishes: dishesRouter,
	// orders: ordersRouter,
	// inventory: inventoryRouter,
	// payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
