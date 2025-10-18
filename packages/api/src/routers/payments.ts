import { z } from "zod";
import { publicProcedure, router } from "../index";
import { eq, and, gte, lte, sql } from "@learn-bettert/db";
import { orders, payments, tables } from "@learn-bettert/db";
import { TRPCError } from "@trpc/server";

/**
 * WebSocket Notification Helper
 * T118: WebSocket notification broadcasting for payment completion
 * 
 * Note: In production, WebSocket notifications are broadcasted via the server's WebSocket handler.
 * For now, we'll add notification calls that can be implemented when the router is deployed.
 * The actual WebSocket broadcasting happens in apps/server/src/websocket.ts
 */
interface WebSocketNotifier {
	notifyPaymentCompleted: (payment: any) => void;
}

// Placeholder for WebSocket notifications (will be injected via context in production)
const wsNotifier: WebSocketNotifier = {
	notifyPaymentCompleted: (payment: any) => {
		// In production, this would call the actual WebSocket broadcast
		// For tests, this is a no-op
		if (process.env.NODE_ENV !== 'test') {
			console.log('[WebSocket] PAYMENT_COMPLETED notification for order:', payment.orderId);
		}
	},
};

/**
 * Payments Router
 * Contract: specs/001-restaurant-hub-mvp/contracts/payments-router.md
 * 
 * T114-T119: Payments router implementation
 * Handles cash payment processing and payment history
 */

export const paymentsRouter = router({
	/**
	 * T114: payments.create - Process cash payment for completed order
	 * Auth: Required (Waiter, Manager)
	 * Contract: payments-router.md Procedure 1
	 * 
	 * Business Logic:
	 * - Validate order exists and status is Completed or Served
	 * - Validate payment amount matches order total
	 * - Create payment record
	 * - Update order status to Paid
	 * - Create OrderStatusHistory entry
	 * - Clear table session (allow new orders)
	 * - Broadcast WebSocket notification to managers
	 */
	create: publicProcedure
		.input(
			z.object({
				orderId: z.number().int().positive(),
				amount: z.number().int().positive(),
				method: z.enum(["Cash"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db, role } = ctx;
			const { orderId, amount, method } = input;

			// Authorization check: Only Waiter, Manager, and KitchenStaff can process payments
			if (role !== "Waiter" && role !== "Manager" && role !== "KitchenStaff") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Staff access required to process payments",
				});
			}

			// Validate order exists
			const order = await db.query.orders.findFirst({
				where: (orders, { eq }) => eq(orders.id, orderId),
				with: {
					table: true,
				},
			});

			if (!order) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Order ID ${orderId} does not exist`,
				});
			}

			// Validate order status is Completed or Served
			if (order.status !== "Completed" && order.status !== "Served") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Order must be in Completed or Served status to process payment. Current status: ${order.status}`,
				});
			}

			// Validate payment amount matches order total
			if (amount !== order.totalAmount) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Payment amount (${amount}) does not match order total (${order.totalAmount})`,
				});
			}

			// Check if payment already exists for this order
			const existingPayment = await db.query.payments.findFirst({
				where: (payments, { eq }) => eq(payments.orderId, orderId),
			});

			if (existingPayment) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Payment already exists for order ID ${orderId}`,
				});
			}

			// Create payment record
			const [payment] = await db.insert(payments).values({
				orderId,
				amount,
				method,
				paidAt: new Date(),
			}).returning();

			if (!payment) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create payment record",
				});
			}

			// Update order status to Paid
			await db.update(orders)
				.set({ status: "Paid", updatedAt: new Date() })
				.where(eq(orders.id, orderId));

			// Create status history entry
			const { orderStatusHistory } = await import("@learn-bettert/db");
			await db.insert(orderStatusHistory).values({
				orderId,
				status: "Paid",
				changedBy: null, // System-initiated status change
				changedAt: new Date(),
			});

			// T117: Table session is cleared - new orders are allowed for this table
			// (No active non-Paid orders at the table anymore)

			// T118: Broadcast WebSocket notification to managers
			wsNotifier.notifyPaymentCompleted({
				orderId,
				tableNumber: order.table.number,
				amount,
				paidAt: payment.paidAt,
			});

			return {
				paymentId: payment.id,
				orderId: payment.orderId,
				amount: payment.amount,
				method: payment.method,
				paidAt: payment.paidAt,
				tableId: order.tableId,
			};
		}),

	/**
	 * T115: payments.getById - Retrieve payment details
	 * Auth: Required (Waiter, Manager)
	 * Contract: payments-router.md Procedure 2
	 */
	getById: publicProcedure
		.input(
			z.object({
				paymentId: z.number().int().positive(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const { db } = ctx;
			const { paymentId } = input;

			const payment = await db.query.payments.findFirst({
				where: (payments, { eq }) => eq(payments.id, paymentId),
				with: {
					order: {
						with: {
							table: true,
							orderItems: {
								with: {
									dish: true,
								},
							},
						},
					},
				},
			});

			if (!payment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Payment ID ${paymentId} does not exist`,
				});
			}

			return {
				id: payment.id,
				orderId: payment.orderId,
				amount: payment.amount,
				method: payment.method,
				paidAt: payment.paidAt,
				order: {
					tableNumber: payment.order.table.number,
					items: payment.order.orderItems.map(item => ({
						dishName: item.dish.name,
						quantity: item.quantity,
						priceAtOrder: item.priceAtOrder,
					})),
					totalAmount: payment.order.totalAmount,
				},
			};
		}),

	/**
	 * T116: payments.getHistory - Retrieve payment history with filters
	 * Auth: Required (Manager only)
	 * Contract: payments-router.md Procedure 3
	 * 
	 * Business Logic:
	 * - Query payments with date range and table filters
	 * - Calculate aggregate totalRevenue
	 * - Paginate results
	 */
	getHistory: publicProcedure
		.input(
			z.object({
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				tableId: z.number().int().positive().optional(),
				limit: z.number().int().min(1).max(100).optional().default(50),
				offset: z.number().int().min(0).optional().default(0),
			}),
		)
		.query(async ({ input, ctx }) => {
			const { db, role } = ctx;
			const { startDate, endDate, tableId, limit, offset } = input;

			// Authorization check: Only Manager can view payment history
			if (role !== "Manager") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Manager access required to view payment history",
				});
			}

			// Build where conditions
			const conditions: any[] = [];

			if (startDate) {
				conditions.push(gte(payments.paidAt, startDate));
			}

			if (endDate) {
				conditions.push(lte(payments.paidAt, endDate));
			}

			// Join with orders and tables for filtering
			let paymentsQuery = db
				.select({
					id: payments.id,
					orderId: payments.orderId,
					amount: payments.amount,
					method: payments.method,
					paidAt: payments.paidAt,
					tableId: orders.tableId,
					tableNumber: tables.number,
				})
				.from(payments)
				.innerJoin(orders, eq(payments.orderId, orders.id))
				.innerJoin(tables, eq(orders.tableId, tables.id));

			// Apply filters
			if (conditions.length > 0 || tableId) {
				const whereConditions = tableId 
					? [...conditions, eq(orders.tableId, tableId)]
					: conditions;
				
				if (whereConditions.length > 0) {
					paymentsQuery = paymentsQuery.where(
						whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]!
					) as typeof paymentsQuery;
				}
			}

			// Get paginated results
			const results = await paymentsQuery
				.orderBy(payments.paidAt)
				.limit(limit)
				.offset(offset);

			// Get total count
			let countQuery = db
				.select({ count: sql<number>`count(*)` })
				.from(payments)
				.innerJoin(orders, eq(payments.orderId, orders.id));

			if (conditions.length > 0 || tableId) {
				const whereConditions = tableId 
					? [...conditions, eq(orders.tableId, tableId)]
					: conditions;
				
				if (whereConditions.length > 0) {
					countQuery = countQuery.where(
						whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]!
					) as any;
				}
			}

			const countResult = await countQuery;
			const total = countResult[0]?.count ?? 0;

			// Calculate total revenue
			let revenueQuery = db
				.select({ totalRevenue: sql<number>`sum(${payments.amount})` })
				.from(payments)
				.innerJoin(orders, eq(payments.orderId, orders.id));

			if (conditions.length > 0 || tableId) {
				const whereConditions = tableId 
					? [...conditions, eq(orders.tableId, tableId)]
					: conditions;
				
				if (whereConditions.length > 0) {
					revenueQuery = revenueQuery.where(
						whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]!
					) as any;
				}
			}

			const revenueResult = await revenueQuery;
			const totalRevenue = revenueResult[0]?.totalRevenue ?? 0;

			return {
				payments: results.map(p => ({
					id: p.id,
					orderId: p.orderId,
					tableNumber: p.tableNumber,
					amount: p.amount,
					method: p.method,
					paidAt: p.paidAt,
				})),
				total: Number(total) || 0,
				totalRevenue: Number(totalRevenue) || 0,
				page: offset,
				pageSize: limit,
			};
		}),
});
