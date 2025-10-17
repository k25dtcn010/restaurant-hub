import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db } from "@learn-bettert/db";
import type { Context } from "../../src/context";

/**
 * T040: Contract test for orders.create
 * T041: Contract test for orders.submit with inventory reduction
 * Contract: orders-router.md Procedures 1 & 2
 * TDD Red Phase: These tests should FAIL before implementation
 */

// Mock context for testing
const mockContext: Context = {
	session: null,
	user: null,
	role: null,
	db,
};

describe("Orders Router - orders.create", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;

	beforeAll(async () => {
		// Create test table
		const [table] = await db.insert(db.schema.tables).values({
			number: 10,
			qrCode: "https://app.restauranthub.com/?table=10",
			capacity: 4,
		}).returning();
		testTableId = table.id;

		// Create test ingredient
		const [ingredient] = await db.insert(db.schema.ingredients).values({
			name: "Test Tomato",
			quantity: 50,
			unit: "kg",
			threshold: 5,
		}).returning();
		testIngredientId = ingredient.id;

		// Create test dish
		const [dish] = await db.insert(db.schema.dishes).values({
			name: "Test Pasta",
			description: "Delicious pasta",
			price: 1500, // $15.00
			isAvailable: true,
		}).returning();
		testDishId = dish.id;

		// Create recipe
		await db.insert(db.schema.recipes).values({
			dishId: testDishId,
			ingredientId: testIngredientId,
			quantityRequired: 2.0,
		});
	});

	beforeEach(async () => {
		// Clean up any test orders before each test
		const testOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of testOrders) {
			await db.delete(db.schema.orders).where(db.eq(db.schema.orders.id, order.id));
		}
	});

	test("should create new order for table without active order", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.create({
			tableId: testTableId,
			items: [
				{
					dishId: testDishId,
					quantity: 2,
					specialInstructions: "Extra sauce",
				},
			],
		});

		expect(result).toBeDefined();
		expect(result.orderId).toBeDefined();
		expect(result.isNew).toBe(true);
		expect(result.totalAmount).toBe(3000); // 2 * $15.00
		expect(result.itemCount).toBe(2);
	});

	test("should add items to existing unpaid order", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// Create first order
		const firstResult = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});

		// Add more items to same table
		const secondResult = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});

		expect(secondResult.orderId).toBe(firstResult.orderId);
		expect(secondResult.isNew).toBe(false);
		expect(secondResult.totalAmount).toBe(3000); // 2 * $15.00
		expect(secondResult.itemCount).toBe(2);
	});

	test("should return error when table does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.create({
				tableId: 99999,
				items: [{ dishId: testDishId, quantity: 1 }],
			})
		).rejects.toThrow();
	});

	test("should return error when dish does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.create({
				tableId: testTableId,
				items: [{ dishId: 99999, quantity: 1 }],
			})
		).rejects.toThrow();
	});

	test("should validate quantity is positive", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.create({
				tableId: testTableId,
				items: [{ dishId: testDishId, quantity: 0 }],
			})
		).rejects.toThrow();
	});
});

describe("Orders Router - orders.submit", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let testOrderId: number;

	beforeAll(async () => {
		// Create test table
		const [table] = await db.insert(db.schema.tables).values({
			number: 11,
			qrCode: "https://app.restauranthub.com/?table=11",
			capacity: 4,
		}).returning();
		testTableId = table.id;

		// Create test ingredient
		const [ingredient] = await db.insert(db.schema.ingredients).values({
			name: "Test Chicken",
			quantity: 30,
			unit: "kg",
			threshold: 3,
		}).returning();
		testIngredientId = ingredient.id;

		// Create test dish
		const [dish] = await db.insert(db.schema.dishes).values({
			name: "Test Burger",
			description: "Juicy burger",
			price: 1800, // $18.00
			isAvailable: true,
		}).returning();
		testDishId = dish.id;

		// Create recipe
		await db.insert(db.schema.recipes).values({
			dishId: testDishId,
			ingredientId: testIngredientId,
			quantityRequired: 0.3,
		});
	});

	beforeEach(async () => {
		// Reset ingredient stock before each test
		await db.update(db.schema.ingredients)
			.set({ quantity: 30 })
			.where(db.eq(db.schema.ingredients.id, testIngredientId));

		// Create a fresh order for submission tests
		const caller = appRouter.createCaller(mockContext);
		const result = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 2 }],
		});
		testOrderId = result.orderId;
	});

	test("should submit order and reduce inventory", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// Get initial stock
		const beforeStock = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.id, testIngredientId),
		});

		// Submit order
		const result = await caller.orders.submit({ orderId: testOrderId });

		expect(result).toBeDefined();
		expect(result.orderId).toBe(testOrderId);
		expect(result.status).toBe("Pending");
		expect(result.submittedAt).toBeDefined();

		// Verify inventory reduced
		const afterStock = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.id, testIngredientId),
		});

		// 2 burgers * 0.3 kg = 0.6 kg reduced
		expect(afterStock!.quantity).toBe(beforeStock!.quantity - 0.6);
	});

	test("should return error when order does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.submit({ orderId: 99999 })
		).rejects.toThrow();
	});

	test("should return error when insufficient stock", async () => {
		// Set stock too low
		await db.update(db.schema.ingredients)
			.set({ quantity: 0.1 })
			.where(db.eq(db.schema.ingredients.id, testIngredientId));

		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.submit({ orderId: testOrderId })
		).rejects.toThrow();
	});

	test("should create order status history entry", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await caller.orders.submit({ orderId: testOrderId });

		const history = await db.query.orderStatusHistory.findMany({
			where: (history, { eq }) => eq(history.orderId, testOrderId),
		});

		expect(history.length).toBeGreaterThan(0);
		expect(history[0].status).toBe("Pending");
	});
});
