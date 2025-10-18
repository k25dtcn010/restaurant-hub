import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, tables, ingredients, dishes, recipes, orders, orderItems, payments } from "@learn-bettert/db";
import type { Context } from "../../src/context";

/**
 * T113: Integration test for payment flow and table session clearing
 * 
 * This test validates the complete User Story 6 payment workflow:
 * 1. Order is created and completed through all stages
 * 2. Payment is processed with correct amount validation
 * 3. Order status is updated to Paid
 * 4. Table session is cleared (new orders allowed)
 * 5. Payment history is tracked
 * 
 * Acceptance: spec.md User Story 6 - Scenarios 1-3
 * Business Logic: payments-router.md - clear table session after payment
 */

// Mock contexts for different roles
const customerContext: Context = {
	session: null,
	user: null,
	role: null,
	db,
};

const waiterContext: Context = {
	session: null,
	user: { id: "waiter-test-001", email: "waiter@test.com", name: "Test Waiter" } as any,
	role: "Waiter",
	db,
};

const managerContext: Context = {
	session: null,
	user: { id: "manager-test-001", email: "manager@test.com", name: "Test Manager" } as any,
	role: "Manager",
	db,
};

describe("Integration: Complete Payment Flow (T113)", () => {
	let testTableId: number;
	let testDishId1: number;
	let testDishId2: number;
	let testIngredientId: number;

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
			where: (tables, { eq }) => eq(tables.number, 800),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Payment Flow Test Ingredient"),
		});
		const existingDish1 = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Payment Flow Test Burger"),
		});
		const existingDish2 = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Payment Flow Test Fries"),
		});

		if (existingTable && existingIngredient && existingDish1 && existingDish2) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId1 = existingDish1.id;
			testDishId2 = existingDish2.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 800,
				qrCode: "https://app.restauranthub.com/?table=800",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Payment Flow Test Ingredient",
				quantity: 500,
				unit: "kg",
				threshold: 50,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dishes
			const [dish1] = await db.insert(dishes).values({
				name: "Payment Flow Test Burger",
				description: "Delicious burger for payment flow test",
				price: 1200, // $12.00
				isAvailable: true,
			}).returning();
			testDishId1 = dish1.id;

			const [dish2] = await db.insert(dishes).values({
				name: "Payment Flow Test Fries",
				description: "Crispy fries for payment flow test",
				price: 500, // $5.00
				isAvailable: true,
			}).returning();
			testDishId2 = dish2.id;

			// Create recipes
			await db.insert(recipes).values([
				{
					dishId: testDishId1,
					ingredientId: testIngredientId,
					quantityRequired: 0.3,
				},
				{
					dishId: testDishId2,
					ingredientId: testIngredientId,
					quantityRequired: 0.2,
				},
			]);
		}
	});

	beforeEach(async () => {
		// Replenish ingredient stock before each test
		await db.update(ingredients)
			.set({ quantity: 500 })
			.where(eq(ingredients.id, testIngredientId));

		// Clean up test orders and payments
		const testOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of testOrders) {
			await db.delete(payments).where(eq(payments.orderId, order.id));
			await db.delete(orders).where(eq(orders.id, order.id));
		}
	});

	test("Complete payment flow: order → submit → complete → pay → clear table", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// STEP 1: Customer creates order via QR code
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [
				{
					dishId: testDishId1,
					quantity: 2, // 2 burgers = $24.00
					specialInstructions: "No onions",
				},
				{
					dishId: testDishId2,
					quantity: 3, // 3 fries = $15.00
				},
			],
		});

		expect(createResult.orderId).toBeGreaterThan(0);
		expect(createResult.isNew).toBe(true);
		const orderId = createResult.orderId;

		// STEP 2: Customer submits order (inventory reduction happens here)
		const submitResult = await customerCaller.orders.submit({ orderId });
		expect(submitResult.status).toBe("Pending");

		// STEP 3: Kitchen processes order (Pending → InKitchen → ReadyToServe)
		await waiterCaller.orders.updateStatus({ orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId, newStatus: "ReadyToServe" });

		// STEP 4: Waiter serves order (ReadyToServe → Served → Completed)
		await waiterCaller.orders.updateStatus({ orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId, newStatus: "Completed" });

		// Verify order is ready for payment
		const orderBeforePayment = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, orderId),
		});
		expect(orderBeforePayment!.status).toBe("Completed");
		expect(orderBeforePayment!.totalAmount).toBe(3900); // (2 * 1200) + (3 * 500) = 3900

		// STEP 5: Waiter processes payment
		const paymentResult = await waiterCaller.payments.create({
			orderId,
			amount: 3900,
			method: "Cash",
		});

		expect(paymentResult.paymentId).toBeGreaterThan(0);
		expect(paymentResult.orderId).toBe(orderId);
		expect(paymentResult.amount).toBe(3900);
		expect(paymentResult.method).toBe("Cash");
		expect(paymentResult.tableId).toBe(testTableId);

		// STEP 6: Verify order status updated to Paid
		const orderAfterPayment = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, orderId),
		});
		expect(orderAfterPayment!.status).toBe("Paid");

		// STEP 7: Verify table session cleared (new orders allowed)
		const newOrderResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId1, quantity: 1 }],
		});

		expect(newOrderResult.orderId).toBeGreaterThan(orderId);
		expect(newOrderResult.isNew).toBe(true);

		// STEP 8: Verify payment appears in history
		const managerCaller = appRouter.createCaller(managerContext);
		const historyResult = await managerCaller.payments.getHistory({
			tableId: testTableId,
		});

		expect(historyResult.payments.length).toBeGreaterThanOrEqual(1);
		const payment = historyResult.payments.find(p => p.id === paymentResult.paymentId);
		expect(payment).toBeDefined();
		expect(payment!.amount).toBe(3900);
		expect(payment!.tableNumber).toBe(800);
	});

	test("Payment validation: reject payment with incorrect amount", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId1, quantity: 1 }], // $12.00
		});
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Try to pay with wrong amount
		try {
			await waiterCaller.payments.create({
				orderId: createResult.orderId,
				amount: 1000, // Wrong! Should be 1200
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			expect(error.message).toContain("amount");
		}

		// Verify order still in Completed status (not Paid)
		const order = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, createResult.orderId),
		});
		expect(order!.status).toBe("Completed");
	});

	test("Payment validation: reject payment for non-completed order", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Create order but don't complete it
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId1, quantity: 1 }],
		});
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		// Order is in Pending status, not Completed

		// Try to pay for non-completed order
		try {
			await waiterCaller.payments.create({
				orderId: createResult.orderId,
				amount: 1200,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			expect(error.message).toContain("status");
		}
	});

	test("Table session: prevent duplicate payment for same order", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId1, quantity: 1 }],
		});
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// First payment succeeds
		await waiterCaller.payments.create({
			orderId: createResult.orderId,
			amount: 1200,
			method: "Cash",
		});

		// Second payment for same order should fail
		try {
			await waiterCaller.payments.create({
				orderId: createResult.orderId,
				amount: 1200,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("BAD_REQUEST");
			// The error could be either "already paid" or "already exists" depending on validation order
			expect(error.message.toLowerCase()).toMatch(/(already|paid|completed)/);
		}
	});

	test("Table session: multiple orders can be paid sequentially", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Create, complete, and pay first order
		const order1 = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId1, quantity: 1 }],
		});
		await customerCaller.orders.submit({ orderId: order1.orderId });
		await waiterCaller.orders.updateStatus({ orderId: order1.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: order1.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: order1.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: order1.orderId, newStatus: "Completed" });
		await waiterCaller.payments.create({
			orderId: order1.orderId,
			amount: 1200,
			method: "Cash",
		});

		// Create, complete, and pay second order
		const order2 = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId2, quantity: 2 }],
		});
		await customerCaller.orders.submit({ orderId: order2.orderId });
		await waiterCaller.orders.updateStatus({ orderId: order2.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: order2.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: order2.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: order2.orderId, newStatus: "Completed" });
		await waiterCaller.payments.create({
			orderId: order2.orderId,
			amount: 1000,
			method: "Cash",
		});

		// Verify both payments exist
		const managerCaller = appRouter.createCaller(managerContext);
		const history = await managerCaller.payments.getHistory({ tableId: testTableId });
		expect(history.payments.length).toBeGreaterThanOrEqual(2);
		expect(history.totalRevenue).toBeGreaterThanOrEqual(2200);
	});

	test("Payment history: revenue calculation across multiple tables", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);
		const managerCaller = appRouter.createCaller(managerContext);

		// Create and pay multiple orders
		const orderAmounts = [1200, 500, 1000]; // burger ($12), fries ($5), 2x fries ($10)
		for (const amount of orderAmounts) {
			const dishId = amount === 1200 ? testDishId1 : testDishId2;
			const quantity = amount === 1200 ? 1 : amount === 500 ? 1 : 2;

			const order = await customerCaller.orders.create({
				tableId: testTableId,
				items: [{ dishId, quantity }],
			});
			await customerCaller.orders.submit({ orderId: order.orderId });
			await waiterCaller.orders.updateStatus({ orderId: order.orderId, newStatus: "InKitchen" });
			await waiterCaller.orders.updateStatus({ orderId: order.orderId, newStatus: "ReadyToServe" });
			await waiterCaller.orders.updateStatus({ orderId: order.orderId, newStatus: "Served" });
			await waiterCaller.orders.updateStatus({ orderId: order.orderId, newStatus: "Completed" });
			await waiterCaller.payments.create({
				orderId: order.orderId,
				amount,
				method: "Cash",
			});
		}

		// Verify total revenue
		const history = await managerCaller.payments.getHistory({ tableId: testTableId });
		const expectedRevenue = orderAmounts.reduce((sum, amt) => sum + amt, 0);
		expect(history.totalRevenue).toBeGreaterThanOrEqual(expectedRevenue);
	});
});
