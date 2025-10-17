import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, tables, ingredients, dishes, recipes, orders, orderItems, orderStatusHistory } from "@learn-bettert/db";
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
		// Check if test data already exists from previous run
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 100),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Tomato"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Pasta"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table (use number > 30 to avoid conflicts with seed data)
			const [table] = await db.insert(tables).values({
				number: 100,
				qrCode: "https://app.restauranthub.com/?table=100",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Tomato",
				quantity: 50,
				unit: "kg",
				threshold: 5,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Pasta",
				description: "Delicious pasta",
				price: 1500, // $15.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 2.0,
			});
		}
	});

	beforeEach(async () => {
		// Clean up any test orders before each test
		const testOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of testOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
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
		// Check if test data already exists from previous run
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 101),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Chicken"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Burger"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table (use number > 30 to avoid conflicts with seed data)
			const [table] = await db.insert(tables).values({
				number: 101,
				qrCode: "https://app.restauranthub.com/?table=101",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Chicken",
				quantity: 30,
				unit: "kg",
				threshold: 3,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Burger",
				description: "Juicy burger",
				price: 1800, // $18.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.3,
			});
		}
	});

	beforeEach(async () => {
		// Clean up any previous test orders
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock before each test
		await db.update(ingredients)
			.set({ quantity: 30 })
			.where(eq(ingredients.id, testIngredientId));

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
		await db.update(ingredients)
			.set({ quantity: 0.1 })
			.where(eq(ingredients.id, testIngredientId));

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

/**
 * T060: Contract test for orders.getKitchenOrders
 * Contract: orders-router.md Procedure 8
 * TDD Red Phase: This test should FAIL before implementation
 */
describe("Orders Router - orders.getKitchenOrders (T060)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let pendingOrderId: number;
	let inKitchenOrderId: number;

	beforeAll(async () => {
		// Check if test data already exists
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 102),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Pizza Dough"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Pizza"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 102,
				qrCode: "https://app.restauranthub.com/?table=102",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Pizza Dough",
				quantity: 20,
				unit: "kg",
				threshold: 2,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Pizza",
				description: "Delicious pizza",
				price: 1200,
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
		// Clean up previous test orders
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock
		await db.update(ingredients)
			.set({ quantity: 20 })
			.where(eq(ingredients.id, testIngredientId));

		// Create test orders in different states
		const caller = appRouter.createCaller(mockContext);
		
		// Create and submit order 1 (will be Pending)
		const result1 = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		await caller.orders.submit({ orderId: result1.orderId });
		pendingOrderId = result1.orderId;

		// Create order 2 and manually set it to InKitchen for testing
		const result2 = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		await caller.orders.submit({ orderId: result2.orderId });
		await db.update(orders)
			.set({ status: "InKitchen" })
			.where(eq(orders.id, result2.orderId));
		inKitchenOrderId = result2.orderId;
	});

	test("should return orders with kitchen statuses (Pending, InKitchen, ReadyToServe)", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getKitchenOrders({});

		expect(result).toBeDefined();
		expect(result.orders).toBeDefined();
		expect(Array.isArray(result.orders)).toBe(true);
		
		// Should include our test orders
		const testOrders = result.orders.filter((o: any) => 
			o.id === pendingOrderId || o.id === inKitchenOrderId
		);
		expect(testOrders.length).toBeGreaterThan(0);
	});

	test("should filter orders by status", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getKitchenOrders({
			status: ["Pending"],
		});

		expect(result.orders).toBeDefined();
		const pendingOrders = result.orders.filter((o: any) => o.status === "Pending");
		expect(pendingOrders.length).toBeGreaterThan(0);
		
		// Should not include InKitchen orders
		const inKitchenOrders = result.orders.filter((o: any) => o.status === "InKitchen");
		expect(inKitchenOrders.length).toBe(0);
	});

	test("should include table number and items in response", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getKitchenOrders({});
		
		const testOrder = result.orders.find((o: any) => o.id === pendingOrderId);
		expect(testOrder).toBeDefined();
		expect(testOrder.tableNumber).toBeDefined();
		expect(testOrder.items).toBeDefined();
		expect(Array.isArray(testOrder.items)).toBe(true);
		expect(testOrder.items.length).toBeGreaterThan(0);
	});

	test("should calculate wait time for orders", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getKitchenOrders({});
		
		const testOrder = result.orders.find((o: any) => o.id === pendingOrderId);
		expect(testOrder).toBeDefined();
		expect(testOrder.waitTime).toBeDefined();
		expect(typeof testOrder.waitTime).toBe("number");
		expect(testOrder.waitTime).toBeGreaterThanOrEqual(0);
	});
});

/**
 * T061: Contract test for orders.updateStatus
 * Contract: orders-router.md Procedure 5
 * TDD Red Phase: This test should FAIL before implementation
 */
describe("Orders Router - orders.updateStatus (T061)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let testOrderId: number;
	let testUserId: number;

	beforeAll(async () => {
		// Check if test data already exists
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 103),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Salad"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Caesar Salad"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 103,
				qrCode: "https://app.restauranthub.com/?table=103",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Salad",
				quantity: 15,
				unit: "kg",
				threshold: 1,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Caesar Salad",
				description: "Fresh salad",
				price: 900,
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.2,
			});
		}
	});

	beforeEach(async () => {
		// Clean up previous test orders
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock
		await db.update(ingredients)
			.set({ quantity: 15 })
			.where(eq(ingredients.id, testIngredientId));

		// Create and submit a test order
		const caller = appRouter.createCaller(mockContext);
		const result = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		await caller.orders.submit({ orderId: result.orderId });
		testOrderId = result.orderId;
	});

	test("should update order status to InKitchen", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "InKitchen",
		});

		expect(result).toBeDefined();
		expect(result.orderId).toBe(testOrderId);
		expect(result.status).toBe("InKitchen");
		expect(result.updatedAt).toBeDefined();

		// Verify in database
		const updatedOrder = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, testOrderId),
		});
		expect(updatedOrder?.status).toBe("InKitchen");
	});

	test("should update order status to ReadyToServe", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// First transition to InKitchen
		await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "InKitchen",
		});

		// Then to ReadyToServe
		const result = await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "ReadyToServe",
		});

		expect(result.status).toBe("ReadyToServe");
	});

	test("should create status history entry", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "InKitchen",
		});

		const history = await db.query.orderStatusHistory.findMany({
			where: (history, { eq }) => eq(history.orderId, testOrderId),
		});

		// Should have at least 2 entries (Pending from submit + InKitchen from updateStatus)
		expect(history.length).toBeGreaterThanOrEqual(2);
		
		const inKitchenEntry = history.find((h: any) => h.status === "InKitchen");
		expect(inKitchenEntry).toBeDefined();
	});

	test("should return error for invalid status transition", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// Cannot jump from Pending directly to Served
		await expect(
			caller.orders.updateStatus({
				orderId: testOrderId,
				newStatus: "Served",
			})
		).rejects.toThrow();
	});

	test("should return error when order does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.updateStatus({
				orderId: 99999,
				newStatus: "InKitchen",
			})
		).rejects.toThrow();
	});
});

/**
 * T067: Contract test for orders.getById
 * Contract: orders-router.md Procedure 6
 * TDD Red Phase: This test should FAIL before implementation
 */
describe("Orders Router - orders.getById (T067)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let testOrderId: number;

	beforeAll(async () => {
		// Check if test data already exists
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 104),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Beef"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Steak"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 104,
				qrCode: "https://app.restauranthub.com/?table=104",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Beef",
				quantity: 25,
				unit: "kg",
				threshold: 3,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Steak",
				description: "Grilled steak",
				price: 2500,
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.4,
			});
		}
	});

	beforeEach(async () => {
		// Clean up previous test orders
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock
		await db.update(ingredients)
			.set({ quantity: 25 })
			.where(eq(ingredients.id, testIngredientId));

		// Create and submit a test order
		const caller = appRouter.createCaller(mockContext);
		const result = await caller.orders.create({
			tableId: testTableId,
			items: [
				{ 
					dishId: testDishId, 
					quantity: 2,
					specialInstructions: "Medium rare"
				}
			],
		});
		await caller.orders.submit({ orderId: result.orderId });
		testOrderId = result.orderId;
	});

	test("should return complete order details", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getById({
			orderId: testOrderId,
		});

		expect(result).toBeDefined();
		expect(result.id).toBe(testOrderId);
		expect(result.tableId).toBe(testTableId);
		expect(result.tableNumber).toBeDefined();
		expect(result.status).toBe("Pending");
		expect(result.totalAmount).toBeGreaterThan(0);
		expect(result.createdAt).toBeDefined();
		expect(result.updatedAt).toBeDefined();
	});

	test("should include order items with dish details", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getById({
			orderId: testOrderId,
		});

		expect(result.items).toBeDefined();
		expect(Array.isArray(result.items)).toBe(true);
		expect(result.items.length).toBe(1);
		
		const item = result.items[0];
		expect(item.dishId).toBe(testDishId);
		expect(item.dishName).toBe("Test Steak");
		expect(item.quantity).toBe(2);
		expect(item.priceAtOrder).toBe(2500);
		expect(item.specialInstructions).toBe("Medium rare");
	});

	test("should include status history", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getById({
			orderId: testOrderId,
		});

		expect(result.statusHistory).toBeDefined();
		expect(Array.isArray(result.statusHistory)).toBe(true);
		expect(result.statusHistory.length).toBeGreaterThan(0);
		
		const historyEntry = result.statusHistory[0];
		expect(historyEntry.status).toBe("Pending");
		expect(historyEntry.changedAt).toBeDefined();
	});

	test("should return error when order does not exist", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await expect(
			caller.orders.getById({ orderId: 99999 })
		).rejects.toThrow();
	});
});

/**
 * T085: Contract test for orders.getServingOrders with ReadyToServe filter
 * T086: Contract test for order status transitions (Served, Completed)
 * Contract: orders-router.md Procedure 9
 * TDD Red Phase: These tests should FAIL before implementation
 */
describe("Orders Router - orders.getServingOrders (T085)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let readyOrderId: number;
	let servedOrderId: number;

	beforeAll(async () => {
		// Check if test data already exists
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 105),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Serving Ingredient"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Serving Dish"),
		});

		if (existingTable && existingIngredient && existingDish) {
			testTableId = existingTable.id;
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test table
			const [table] = await db.insert(tables).values({
				number: 105,
				qrCode: "https://app.restauranthub.com/?table=105",
				capacity: 4,
			}).returning();
			testTableId = table.id;

			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Serving Ingredient",
				quantity: 30,
				unit: "kg",
				threshold: 3,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Serving Dish",
				description: "Dish for serving tests",
				price: 1800,
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.3,
			});
		}
	});

	beforeEach(async () => {
		// Clean up previous test orders (cascade will delete related records)
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock
		await db.update(ingredients)
			.set({ quantity: 30 })
			.where(eq(ingredients.id, testIngredientId));

		// Create test orders in ReadyToServe and Served states
		const caller = appRouter.createCaller(mockContext);
		
		// Create and submit order 1, then mark as ReadyToServe
		const result1 = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 2 }],
		});
		await caller.orders.submit({ orderId: result1.orderId });
		// Move to InKitchen then ReadyToServe
		await caller.orders.updateStatus({
			orderId: result1.orderId,
			newStatus: "InKitchen",
		});
		await caller.orders.updateStatus({
			orderId: result1.orderId,
			newStatus: "ReadyToServe",
		});
		readyOrderId = result1.orderId;

		// Create and submit order 2, then mark as Served
		const result2 = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		await caller.orders.submit({ orderId: result2.orderId });
		await caller.orders.updateStatus({
			orderId: result2.orderId,
			newStatus: "InKitchen",
		});
		await caller.orders.updateStatus({
			orderId: result2.orderId,
			newStatus: "ReadyToServe",
		});
		await caller.orders.updateStatus({
			orderId: result2.orderId,
			newStatus: "Served",
		});
		servedOrderId = result2.orderId;
	});

	test("should return orders with ReadyToServe and Served statuses", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({});

		expect(result.orders).toBeDefined();
		expect(result.orders.length).toBeGreaterThanOrEqual(2);
		
		// Should include our test orders
		const orderIds = result.orders.map((o) => o.id);
		expect(orderIds).toContain(readyOrderId);
		expect(orderIds).toContain(servedOrderId);

		// Verify orders have correct statuses
		const readyOrder = result.orders.find((o) => o.id === readyOrderId);
		const servedOrder = result.orders.find((o) => o.id === servedOrderId);
		
		expect(readyOrder?.status).toBe("ReadyToServe");
		expect(servedOrder?.status).toBe("Served");
	});

	test("should filter orders by status (ReadyToServe only)", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({
			status: ["ReadyToServe"],
		});

		expect(result.orders).toBeDefined();
		
		// Should only include ReadyToServe orders
		const hasReady = result.orders.some((o) => o.id === readyOrderId);
		const hasServed = result.orders.some((o) => o.id === servedOrderId);
		
		expect(hasReady).toBe(true);
		expect(hasServed).toBe(false);

		// All orders should have ReadyToServe status
		result.orders.forEach((order) => {
			expect(order.status).toBe("ReadyToServe");
		});
	});

	test("should include table number and items in response", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({});

		const testOrder = result.orders.find((o) => o.id === readyOrderId);
		expect(testOrder).toBeDefined();
		expect(testOrder?.tableNumber).toBe(105);
		expect(testOrder?.items).toBeDefined();
		expect(testOrder?.items.length).toBeGreaterThan(0);
		
		// Check item structure
		const firstItem = testOrder?.items[0];
		expect(firstItem?.dishName).toBeDefined();
		expect(firstItem?.quantity).toBeDefined();
	});

	test("should include readySince timestamp and calculate waitTime", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({});

		const testOrder = result.orders.find((o) => o.id === readyOrderId);
		expect(testOrder).toBeDefined();
		
		// Should have readySince timestamp
		expect(testOrder?.readySince).toBeDefined();
		expect(testOrder?.readySince).toBeInstanceOf(Date);
		
		// Should have waitTime in minutes (should be very small for just-created orders)
		expect(testOrder?.waitTime).toBeDefined();
		expect(typeof testOrder?.waitTime).toBe("number");
		expect(testOrder?.waitTime).toBeGreaterThanOrEqual(0);
	});

	test("should include totalAmount in response", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({});

		const testOrder = result.orders.find((o) => o.id === readyOrderId);
		expect(testOrder).toBeDefined();
		expect(testOrder?.totalAmount).toBeDefined();
		expect(typeof testOrder?.totalAmount).toBe("number");
		expect(testOrder?.totalAmount).toBeGreaterThan(0);
	});

	test("should sort by waitTime descending (longest waiting first)", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.getServingOrders({});

		expect(result.orders.length).toBeGreaterThan(0);
		
		// Check that orders are sorted by waitTime descending
		for (let i = 0; i < result.orders.length - 1; i++) {
			const current = result.orders[i];
			const next = result.orders[i + 1];
			expect(current.waitTime).toBeGreaterThanOrEqual(next.waitTime);
		}
	});
});

/**
 * T086: Contract test for order status transitions (Served, Completed)
 * Contract: orders-router.md Procedure 5
 * Testing Served and Completed status transitions
 */
describe("Orders Router - status transitions to Served/Completed (T086)", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let testOrderId: number;

	beforeAll(async () => {
		// Reuse test data from table 105 (created in T085 tests)
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 105),
		});
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Serving Ingredient"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Serving Dish"),
		});

		// These should exist from the previous test suite, but handle case where they don't
		if (!existingTable || !existingIngredient || !existingDish) {
			throw new Error("Test data from T085 suite not found. Run T085 tests first.");
		}

		testTableId = existingTable.id;
		testIngredientId = existingIngredient.id;
		testDishId = existingDish.id;
	});

	beforeEach(async () => {
		// Clean up previous test orders (cascade will delete related records)
		const previousOrders = await db.query.orders.findMany({
			where: (orders, { eq }) => eq(orders.tableId, testTableId),
		});
		for (const order of previousOrders) {
			await db.delete(orders).where(eq(orders.id, order.id));
		}

		// Reset ingredient stock
		await db.update(ingredients)
			.set({ quantity: 30 })
			.where(eq(ingredients.id, testIngredientId));

		// Create a test order and move it to ReadyToServe
		const caller = appRouter.createCaller(mockContext);
		const result = await caller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		await caller.orders.submit({ orderId: result.orderId });
		await caller.orders.updateStatus({
			orderId: result.orderId,
			newStatus: "InKitchen",
		});
		await caller.orders.updateStatus({
			orderId: result.orderId,
			newStatus: "ReadyToServe",
		});
		testOrderId = result.orderId;
	});

	test("should transition from ReadyToServe to Served", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Served",
		});

		expect(result.status).toBe("Served");
		expect(result.orderId).toBe(testOrderId);
		expect(result.updatedAt).toBeDefined();
	});

	test("should transition from Served to Completed", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// First move to Served
		await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Served",
		});

		// Then move to Completed
		const result = await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Completed",
		});

		expect(result.status).toBe("Completed");
		expect(result.orderId).toBe(testOrderId);
	});

	test("should create status history for Served transition", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		await caller.orders.updateStatus({
			orderId: testOrderId,
			newStatus: "Served",
		});

		// Get order details to check status history
		const orderDetails = await caller.orders.getById({
			orderId: testOrderId,
		});

		expect(orderDetails.statusHistory).toBeDefined();
		const servedHistory = orderDetails.statusHistory.find(
			(h) => h.status === "Served"
		);
		expect(servedHistory).toBeDefined();
		expect(servedHistory?.changedAt).toBeDefined();
	});

	test("should not allow invalid status transitions", async () => {
		const caller = appRouter.createCaller(mockContext);
		
		// Try to go from ReadyToServe directly to Paid (should fail)
		await expect(
			caller.orders.updateStatus({
				orderId: testOrderId,
				newStatus: "Paid",
			})
		).rejects.toThrow();
	});
});
