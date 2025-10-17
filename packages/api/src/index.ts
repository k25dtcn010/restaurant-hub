import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

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
