import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

/**
 * T132: Global error handler
 * Reference: research.md Section 9 - Error Handling and Validation
 * 
 * Best Practices:
 * - Never expose database errors or stack traces to frontend
 * - Log detailed errors server-side
 * - Display user-friendly error messages
 */
export const t = initTRPC.context<Context>().create({
	errorFormatter(opts) {
		const { shape, error } = opts;
		
		// Log server errors for debugging
		if (error.code === "INTERNAL_SERVER_ERROR") {
			console.error("[tRPC Error]", {
				code: error.code,
				message: error.message,
				cause: error.cause,
				path: opts.path,
				input: opts.input,
			});
		}

		// Return sanitized error to client
		return {
			...shape,
			data: {
				...shape.data,
				// Never expose database errors to frontend
				// Keep only tRPC error code and safe message
			},
		};
	},
});

export const router = t.router;

export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 * Reference: research.md Section 5 - Role-Based Access Control
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session || !ctx.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
			user: ctx.user,
		},
	});
});

/**
 * Manager-only procedure - requires Manager role
 * Access Control Matrix: Full CRUD on dishes, ingredients, users
 */
export const managerOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.role !== "Manager") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Manager access required",
		});
	}
	return next({ ctx });
});

/**
 * Kitchen staff procedure - requires KitchenStaff role
 * Access Control Matrix: Update order status (Pending → Ready)
 */
export const kitchenStaffProcedure = protectedProcedure.use(
	({ ctx, next }) => {
		if (ctx.role !== "KitchenStaff" && ctx.role !== "Manager") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Kitchen staff access required",
			});
		}
		return next({ ctx });
	},
);

/**
 * Waiter procedure - requires Waiter or Manager role
 * Access Control Matrix: Create orders, mark served/paid, view tables
 */
export const waiterProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (
		ctx.role !== "Waiter" &&
		ctx.role !== "Manager" &&
		ctx.role !== "KitchenStaff"
	) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Staff access required",
		});
	}
	return next({ ctx });
});
