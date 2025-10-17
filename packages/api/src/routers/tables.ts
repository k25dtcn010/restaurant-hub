import { z } from "zod";
import { publicProcedure, router, waiterProcedure, managerOnlyProcedure } from "../index";
import { eq } from "drizzle-orm";

/**
 * Tables Router
 * Contract: specs/001-restaurant-hub-mvp/contracts/tables-router.md
 * 
 * T043-T045: Tables router implementation
 * Handles table management and QR code validation
 */

export const tablesRouter = router({
	/**
	 * T044: tables.getAll - Get all tables with active order status
	 * Auth: Required (Manager, Waiter)
	 * Contract: tables-router.md Procedure 1
	 */
	getAll: waiterProcedure.query(async ({ ctx }) => {
		const { db } = ctx;

		// Get all tables with their active orders
		const allTables = await db.query.tables.findMany({
			orderBy: (tables, { asc }) => [asc(tables.number)],
		});

		// Get all unpaid orders to determine which tables have active orders
		const activeOrders = await db.query.orders.findMany({
			where: (orders, { ne }) => ne(orders.status, "Paid"),
			columns: {
				id: true,
				tableId: true,
			},
		});

		// Map tables with active order information
		const tables = allTables.map((table) => {
			const activeOrder = activeOrders.find((order) => order.tableId === table.id);
			return {
				id: table.id,
				number: table.number,
				qrCode: table.qrCode,
				capacity: table.capacity,
				hasActiveOrder: !!activeOrder,
				activeOrderId: activeOrder?.id ?? null,
				createdAt: table.createdAt,
			};
		});

		return { tables };
	}),

	/**
	 * T043: tables.getById - Validate table exists (QR code scan)
	 * Auth: Public (used by customers)
	 * Contract: tables-router.md Procedure 2
	 */
	getById: publicProcedure
		.input(
			z.object({
				tableId: z.number().int().positive(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const { db } = ctx;
			const { tableId } = input;

			const table = await db.query.tables.findFirst({
				where: (tables, { eq }) => eq(tables.id, tableId),
			});

			if (!table) {
				return {
					id: tableId,
					number: 0,
					qrCode: "",
					capacity: 0,
					isValid: false,
				};
			}

			return {
				id: table.id,
				number: table.number,
				qrCode: table.qrCode,
				capacity: table.capacity,
				isValid: true,
			};
		}),

	/**
	 * tables.create - Create new table with QR code (setup phase)
	 * Auth: Manager only
	 * Contract: tables-router.md Procedure 3
	 */
	create: managerOnlyProcedure
		.input(
			z.object({
				number: z.number().int().min(1).max(30),
				capacity: z.number().int().positive(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { number, capacity } = input;

			// Check if table number already exists
			const existing = await db.query.tables.findFirst({
				where: (tables, { eq }) => eq(tables.number, number),
			});

			if (existing) {
				throw new Error(`Table number ${number} already exists`);
			}

			// Generate QR code URL
			const qrCode = `https://app.restauranthub.com/?table=${number}`;

			const [table] = await db.insert(db.schema.tables).values({
				number,
				qrCode,
				capacity,
			}).returning();

			return {
				tableId: table.id,
				number: table.number,
				qrCode: table.qrCode,
				capacity: table.capacity,
			};
		}),

	/**
	 * tables.update - Update table metadata
	 * Auth: Manager only
	 * Contract: tables-router.md Procedure 4
	 */
	update: managerOnlyProcedure
		.input(
			z.object({
				tableId: z.number().int().positive(),
				capacity: z.number().int().positive().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { tableId, capacity } = input;

			const table = await db.query.tables.findFirst({
				where: (tables, { eq }) => eq(tables.id, tableId),
			});

			if (!table) {
				throw new Error(`Table ID ${tableId} does not exist`);
			}

			const updates: any = {};
			if (capacity !== undefined) {
				updates.capacity = capacity;
			}

			await db.update(db.schema.tables)
				.set(updates)
				.where(eq(db.schema.tables.id, tableId));

			return {
				tableId,
				capacity: capacity ?? table.capacity,
				updatedAt: new Date(),
			};
		}),

	/**
	 * tables.delete - Delete table (only if no order history)
	 * Auth: Manager only
	 * Contract: tables-router.md Procedure 5
	 */
	delete: managerOnlyProcedure
		.input(
			z.object({
				tableId: z.number().int().positive(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { tableId } = input;

			const table = await db.query.tables.findFirst({
				where: (tables, { eq }) => eq(tables.id, tableId),
			});

			if (!table) {
				throw new Error(`Table ID ${tableId} does not exist`);
			}

			// Check if table has any orders
			const orders = await db.query.orders.findMany({
				where: (orders, { eq }) => eq(orders.tableId, tableId),
				limit: 1,
			});

			if (orders.length > 0) {
				throw new Error(`Cannot delete table ${tableId}: has order history`);
			}

			// Hard delete table
			await db.delete(db.schema.tables).where(eq(db.schema.tables.id, tableId));

			return {
				tableId,
				deleted: true,
			};
		}),
});
