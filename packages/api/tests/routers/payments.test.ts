import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, tables, ingredients, dishes, recipes, orders, orderItems, payments } from "@learn-bettert/db";
import type { Context } from "../../src/context";
import { mockWsNotifier } from "../setup";

/**
 * T111: Contract test for payments.create
 * T112: Contract test for payments.getHistory
 * Contract: payments-router.md Procedures 1 & 3
 * 
 * Test Isolation Strategy:
 * - beforeEach: Replenish ingredient stock and create fresh test order
 * - afterEach: Clean up created test data
 * - Each test suite uses unique table numbers
 */

// Mock contexts for different roles
const waiterContext: Context = {
	session: null,
	user: { id: "waiter-test-001", email: "waiter@test.com", name: "Test Waiter" } as any,
	role: "Waiter",
	db,
	wsNotifier: mockWsNotifier,
};

const managerContext: Context = {
	session: null,
	user: { id: "manager-test-001", email: "manager@test.com", name: "Test Manager" } as any,
	role: "Manager",
	db,
	wsNotifier: mockWsNotifier,
};

const customerContext: Context = {
	session: null,
	user: null,
	role: null,
	db,
	wsNotifier: mockWsNotifier,
};

describe("Payments Router - payments.create (T111)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let testOrderId: number;

	beforeAll(async () => {
		// Create test users first
		const { user } = await import("@learn-bettert/db");
		const existingWaiter = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "waiter-test-001"),
		});
		if (!existingWaiter) {
			await db.insert(user).values({
				id: "waiter-test-001",
				name: "Test Waiter",
				email: "waiter-payment-test@test.com",
				emailVerified: false,
				role: "Waiter",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		const existingManager = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "manager-test-001"),
		});
		if (!existingManager) {
			await db.insert(user).values({
				id: "manager-test-001",
				name: "Test Manager",
				email: "manager-payment-test@test.com",
				emailVerified: false,
				role: "Manager",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Check if test data already exists
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 700),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Payment Test Ingredient"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Payment Test Dish"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 700,
				qrCode: "https://app.restauranthub.com/?table=700",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Payment Test Ingredient",
				quantity: 100,
				unit: "kg",
				threshold: 10,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Payment Test Dish",
				description: "Test dish for payment",
				price: 2000, // $20.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 1.0,
			});
		}
	});

	beforeEach(async () => {
		// Replenish ingredient stock before each test
		await db.update(ingredients)
			.set({ quantity: 100 })
			.where(eq(ingredients.id, testIngredientId));

		// Clean up test orders and payments
		const testOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of testOrders) {
			// Delete payments first (foreign key constraint)
			await db.delete(payments).where(eq(payments.orderId, order.id));
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Create a completed order for payment tests
		const caller = appRouter.createCaller(customerContext);
		const createResult = await caller.orders.create({
			tableId: testTableId,
			items: [
				{
					dishId: testDishId,
					quantity: 2,
					specialInstructions: "Test order for payment",
				},
			],
		});
		testOrderId = createResult.orderId;

		// Submit and complete the order through proper workflow
		await caller.orders.submit({ orderId: testOrderId });
		
		// Update order status through proper transitions: Pending → InKitchen → ReadyToServe → Served → Completed
		const waiterCaller = appRouter.createCaller(waiterContext);
		await waiterCaller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "InKitchen",
		});
		await waiterCaller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "ReadyToServe",
		});
		await waiterCaller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Served",
		});
		await waiterCaller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Completed",
		});
	});

	test("should create payment for completed order with correct amount", async () => {
		const caller = appRouter.createCaller(waiterContext);

		// Get order to verify total
		const order = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, testOrderId),
		});
		expect(order).toBeDefined();
		expect(order!.totalAmount).toBe(4000); // 2 dishes * $20.00

		const result = await caller.payments.create({
			orderId: testOrderId,
			amount: 4000,
			method: "Cash",
		});

		expect(result).toBeDefined();
		expect(result.paymentId).toBeGreaterThan(0);
		expect(result.orderId).toBe(testOrderId);
		expect(result.amount).toBe(4000);
		expect(result.method).toBe("Cash");
		expect(result.paidAt).toBeInstanceOf(Date);
		expect(result.tableId).toBe(testTableId);

		// Verify payment record created in database
		const payment = await db.query.payments.findFirst({
			where: (payments, { eq }) => eq(payments.id, result.paymentId),
		});
		expect(payment).toBeDefined();
		expect(payment!.amount).toBe(4000);

		// Verify order status updated to Paid
		const updatedOrder = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, testOrderId),
		});
		expect(updatedOrder!.status).toBe("Paid");
	});

	test("should reject payment with incorrect amount", async () => {
		const caller = appRouter.createCaller(waiterContext);

		try {
			await caller.payments.create({
				orderId: testOrderId,
				amount: 3000, // Wrong amount (should be 4000)
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			expect(error.message).toContain("amount");
		}
	});

	test("should reject payment for non-completed order", async () => {
		const caller = appRouter.createCaller(waiterContext);
		const customerCaller = appRouter.createCaller(customerContext);

		// Find or create a different table to ensure we get a new order
		let tempTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 701),
		});

		if (!tempTable) {
			// Create temp table if it doesn't exist
			const [newTable] = await db.insert(tables).values({
				number: 701,
				qrCode: "https://app.restauranthub.com/?table=701-test",
				capacity: 4,
			}).returning();
			tempTable = newTable;
		}

		// Create an order at a different table in Pending status
		const createResult = await customerCaller.orders.create({
			tableId: tempTable.id,
			items: [{ dishId: testDishId, quantity: 1 }],
		});

		// Get the order to check its total
		const order = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, createResult.orderId),
		});

		try {
			await caller.payments.create({
				orderId: createResult.orderId,
				amount: order!.totalAmount,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			expect(error.message).toContain("status");
		}

		// Clean up order items and order
		await db.delete(orderItems).where(eq(orderItems.orderId, createResult.orderId));
		await db.delete(orders).where(eq(orders.id, createResult.orderId));
	});

	test("should reject duplicate payment for same order", async () => {
		const caller = appRouter.createCaller(waiterContext);

		// Create first payment (testOrderId is already in Completed status from beforeEach)
		await caller.payments.create({
			orderId: testOrderId,
			amount: 4000,
			method: "Cash",
		});

		// Try to create second payment for same order (now in Paid status)
		try {
			await caller.payments.create({
				orderId: testOrderId,
				amount: 4000,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			// Order is now in Paid status, so the error will be about status, not duplicate
			expect(error.message.toLowerCase()).toMatch(/(already|paid|status)/);
		}
	});

	test("should reject payment from unauthorized user (customer)", async () => {
		const caller = appRouter.createCaller(customerContext);

		try {
			await caller.payments.create({
				orderId: testOrderId,
				amount: 4000,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("FORBIDDEN");
		}
	});

	test("should allow manager to create payment", async () => {
		const caller = appRouter.createCaller(managerContext);

		const result = await caller.payments.create({
			orderId: testOrderId,
			amount: 4000,
			method: "Cash",
		});

		expect(result).toBeDefined();
		expect(result.paymentId).toBeGreaterThan(0);
	});

	test("should clear table session after payment (allow new orders)", async () => {
		const caller = appRouter.createCaller(waiterContext);

		// Create payment
		await caller.payments.create({
			orderId: testOrderId,
			amount: 4000,
			method: "Cash",
		});

		// Verify we can create a new order for the same table
		const customerCaller = appRouter.createCaller(customerContext);
		const newOrder = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});

		expect(newOrder.orderId).toBeGreaterThan(testOrderId);
		expect(newOrder.isNew).toBe(true);
	});
});

describe("Payments Router - payments.getHistory (T112)", () => {
	let testTableId1: number;
	let testTableId2: number;
	let testDishId: number;
	let testIngredientId: number;
	let paymentIds: number[] = [];

	beforeAll(async () => {
		// Create test users first (reuse from previous suite if they already exist)
		const { user } = await import("@learn-bettert/db");
		const existingWaiter = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "waiter-test-001"),
		});
		if (!existingWaiter) {
			await db.insert(user).values({
				id: "waiter-test-001",
				name: "Test Waiter",
				email: "waiter-payment-test@test.com",
				emailVerified: false,
				role: "Waiter",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		const existingManager = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "manager-test-001"),
		});
		if (!existingManager) {
			await db.insert(user).values({
				id: "manager-test-001",
				name: "Test Manager",
				email: "manager-payment-test@test.com",
				emailVerified: false,
				role: "Manager",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Check if test data already exists  
		const existingTable1 = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 710),
		});
		const existingTable2 = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 711),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Payment History Test Ingredient"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Payment History Test Dish"),
		});

		if (existingTable1 && existingTable2 && existingIngredient && existingDish) {
			testTableId1 = existingTable1.id;
			testTableId2 = existingTable2.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test tables with unique numbers to avoid conflicts
			const [table1] = await db.insert(tables).values({
				number: 710,
				qrCode: "https://app.restauranthub.com/?table=710",
				capacity: 4,
			}).returning();
			testTableId1 = table1.id;

			const [table2] = await db.insert(tables).values({
				number: 711,
				qrCode: "https://app.restauranthub.com/?table=711",
				capacity: 6,
			}).returning();
			testTableId2 = table2.id;

			// Create test ingredient and dish
			const [ingredient] = await db.insert(ingredients).values({
				name: "Payment History Test Ingredient",
				quantity: 200,
				unit: "kg",
				threshold: 20,
			}).returning();
			testIngredientId = ingredient.id;

			const [dish] = await db.insert(dishes).values({
				name: "Payment History Test Dish",
				description: "Test dish for payment history",
				price: 1500, // $15.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.5,
			});
		}
	});

	beforeEach(async () => {
		// Replenish ingredient stock before each test
		await db.update(ingredients)
			.set({ quantity: 200 })
			.where(eq(ingredients.id, testIngredientId));

		// Clean up previous test data
		paymentIds = [];
		const testOrders1 = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId1),
		});
		const testOrders2 = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId2),
		});
		
		for (const order of [...testOrders1, ...testOrders2]) {
			await db.delete(payments).where(eq(payments.orderId, order.id));
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Create multiple completed orders and payments for testing
		const waiterCaller = appRouter.createCaller(waiterContext);
		const customerCaller = appRouter.createCaller(customerContext);

		// Create 3 orders for table 710
		for (let i = 0; i < 3; i++) {
			const createResult = await customerCaller.orders.create({
				tableId: testTableId1,
				items: [{ dishId: testDishId, quantity: 1 + i }],
			});
			await customerCaller.orders.submit({ orderId: createResult.orderId });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });
			const paymentResult = await waiterCaller.payments.create({
				orderId: createResult.orderId,
				amount: 1500 * (1 + i),
				method: "Cash",
			});
			paymentIds.push(paymentResult.paymentId);
		}

		// Create 2 orders for table 711
		for (let i = 0; i < 2; i++) {
			const createResult = await customerCaller.orders.create({
				tableId: testTableId2,
				items: [{ dishId: testDishId, quantity: 2 }],
			});
			await customerCaller.orders.submit({ orderId: createResult.orderId });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
			await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });
			const paymentResult = await waiterCaller.payments.create({
				orderId: createResult.orderId,
				amount: 3000,
				method: "Cash",
			});
			paymentIds.push(paymentResult.paymentId);
		}
	});

	test("should retrieve all payment history for manager", async () => {
		const caller = appRouter.createCaller(managerContext);

		const result = await caller.payments.getHistory({});

		expect(result).toBeDefined();
		expect(result.payments).toBeDefined();
		expect(result.payments.length).toBeGreaterThanOrEqual(5);
		expect(result.total).toBeGreaterThanOrEqual(5);
		expect(result.totalRevenue).toBeGreaterThan(0);
		
		// Verify payment structure
		const payment = result.payments[0];
		expect(payment.id).toBeGreaterThan(0);
		expect(payment.orderId).toBeGreaterThan(0);
		expect(payment.tableNumber).toBeGreaterThan(0);
		expect(payment.amount).toBeGreaterThan(0);
		expect(payment.method).toBe("Cash");
		expect(payment.paidAt).toBeInstanceOf(Date);
	});

	test("should filter payment history by table", async () => {
		const caller = appRouter.createCaller(managerContext);

		const result = await caller.payments.getHistory({
			tableId: testTableId1,
		});

		expect(result.payments).toBeDefined();
		expect(result.payments.length).toBe(3);
		expect(result.payments.every(p => p.tableNumber === 710)).toBe(true);
	});

	test("should paginate payment history", async () => {
		const caller = appRouter.createCaller(managerContext);

		const page1 = await caller.payments.getHistory({
			limit: 2,
			offset: 0,
		});

		expect(page1.payments.length).toBe(2);
		expect(page1.page).toBe(0);
		expect(page1.pageSize).toBe(2);

		const page2 = await caller.payments.getHistory({
			limit: 2,
			offset: 2,
		});

		expect(page2.payments.length).toBeGreaterThan(0);
		expect(page2.page).toBe(2);
		expect(page2.pageSize).toBe(2);

		// Verify no duplicate payments between pages
		const page1Ids = page1.payments.map(p => p.id);
		const page2Ids = page2.payments.map(p => p.id);
		const intersection = page1Ids.filter(id => page2Ids.includes(id));
		expect(intersection.length).toBe(0);
	});

	test("should calculate total revenue correctly", async () => {
		const caller = appRouter.createCaller(managerContext);

		const result = await caller.payments.getHistory({});

		// Calculate expected revenue from our test payments
		// Table 710: 1500 + 3000 + 4500 = 9000
		// Table 711: 3000 + 3000 = 6000
		// Total: 15000
		const expectedRevenue = 1500 + 3000 + 4500 + 3000 + 3000;
		
		expect(result.totalRevenue).toBeGreaterThanOrEqual(expectedRevenue);
	});

	test("should reject getHistory from non-manager user", async () => {
		const caller = appRouter.createCaller(waiterContext);

		try {
			await caller.payments.getHistory({});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("FORBIDDEN");
		}
	});

	test("should respect limit parameter maximum", async () => {
		const caller = appRouter.createCaller(managerContext);

		try {
			await caller.payments.getHistory({
				limit: 200, // Should be rejected (max is 100)
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
		}
	});
});
