import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, tables, dishes, ingredients, recipes, orders, payments, orderItems } from "@learn-bettert/db";
import type { Context } from "../../src/context";
import { mockWsNotifier } from "../setup";

/**
 * Better-Auth Integration Test with Improved Test Isolation
 * 
 * This test validates that Better-Auth integration is working correctly
 * with role-based access control for the payment processing workflow.
 * 
 * Tests:
 * 1. User authentication context with roles (Manager, KitchenStaff, Waiter)
 * 2. Role-based authorization for payment operations
 * 3. Payment processing with authenticated users
 * 4. Payment history access restricted to managers
 * 
 * Test Isolation Strategy:
 * - Each test uses unique table numbers to prevent conflicts
 * - beforeEach: Replenish ingredient stock
 * - afterEach: Clean up orders and payments created during test
 */

describe("Better-Auth Integration: Payment Processing with Role-Based Access", () => {
	let testTableId: number;
	let testDishId: number;
	let testIngredientId: number;
	let createdOrderIds: number[] = [];

	// Mock contexts for different authenticated users with Better-Auth roles
	const waiterContext: Context = {
		session: {
			session: {
				id: "session-waiter-001",
				userId: "waiter-test-001",
				expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
				token: "test-token-waiter",
				ipAddress: "127.0.0.1",
				userAgent: "test-agent",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			user: {
				id: "waiter-test-001",
				name: "Test Waiter",
				email: "waiter@test.com",
				emailVerified: false,
				image: null,
				role: "Waiter",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		user: {
			id: "waiter-test-001",
			name: "Test Waiter",
			email: "waiter@test.com",
			emailVerified: false,
			image: null,
			role: "Waiter",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		role: "Waiter",
		db,
	};

	const managerContext: Context = {
		session: {
			session: {
				id: "session-manager-001",
				userId: "manager-test-001",
				expiresAt: new Date(Date.now() + 86400000),
				token: "test-token-manager",
				ipAddress: "127.0.0.1",
				userAgent: "test-agent",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			user: {
				id: "manager-test-001",
				name: "Test Manager",
				email: "manager@test.com",
				emailVerified: false,
				image: null,
				role: "Manager",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		user: {
			id: "manager-test-001",
			name: "Test Manager",
			email: "manager@test.com",
			emailVerified: false,
			image: null,
			role: "Manager",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		role: "Manager",
		db,
	};

	const customerContext: Context = {
		session: null,
		user: null,
		role: null,
		db,
	wsNotifier: mockWsNotifier,
	};

	const kitchenStaffContext: Context = {
		session: {
			session: {
				id: "session-chef-001",
				userId: "chef-test-001",
				expiresAt: new Date(Date.now() + 86400000),
				token: "test-token-chef",
				ipAddress: "127.0.0.1",
				userAgent: "test-agent",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			user: {
				id: "chef-test-001",
				name: "Test Chef",
				email: "chef@test.com",
				emailVerified: false,
				image: null,
				role: "KitchenStaff",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		user: {
			id: "chef-test-001",
			name: "Test Chef",
			email: "chef@test.com",
			emailVerified: false,
			image: null,
			role: "KitchenStaff",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		role: "KitchenStaff",
		db,
	};

	beforeAll(async () => {
		// Create test users in database
		const { user } = await import("@learn-bettert/db");
		
		const existingWaiter = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "waiter-test-001"),
		});
		if (!existingWaiter) {
			await db.insert(user).values({
				id: "waiter-test-001",
				name: "Test Waiter",
				email: "waiter@test.com",
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
				email: "manager@test.com",
				emailVerified: false,
				role: "Manager",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		const existingChef = await db.query.user.findFirst({
			where: (users, { eq }) => eq(users.id, "chef-test-001"),
		});
		if (!existingChef) {
			await db.insert(user).values({
				id: "chef-test-001",
				name: "Test Chef",
				email: "chef@test.com",
				emailVerified: false,
				role: "KitchenStaff",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Setup test data
		const existingTable = await db.query.tables.findFirst({
			where: (tables, { eq }) => eq(tables.number, 900),
		});
		if (!existingTable) {
			const [table] = await db.insert(tables).values({
				number: 900,
				qrCode: "https://app.restauranthub.com/?table=900",
				capacity: 4,
			}).returning();
			testTableId = table.id;
		} else {
			testTableId = existingTable.id;
		}

		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Auth Test Ingredient"),
		});
		if (!existingIngredient) {
			const [ingredient] = await db.insert(ingredients).values({
				name: "Auth Test Ingredient",
				quantity: 100,
				unit: "kg",
				threshold: 10,
			}).returning();
			testIngredientId = ingredient.id;
		} else {
			testIngredientId = existingIngredient.id;
		}

		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Auth Test Dish"),
		});
		if (!existingDish) {
			const [dish] = await db.insert(dishes).values({
				name: "Auth Test Dish",
				description: "Test dish for auth integration",
				price: 2500, // $25.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 1.0,
			});
		} else {
			testDishId = existingDish.id;
		}
	});

	beforeEach(async () => {
		// Replenish ingredient stock before each test
		await db.update(ingredients)
			.set({ quantity: 100 })
			.where(eq(ingredients.id, testIngredientId));
		
		// Reset order tracking
		createdOrderIds = [];
	});

	afterEach(async () => {
		// Clean up all orders and payments created during the test
		for (const orderId of createdOrderIds) {
			// Delete payments first (foreign key constraint)
			await db.delete(payments).where(eq(payments.orderId, orderId));
			// Delete order items
			await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
			// Delete order
			await db.delete(orders).where(eq(orders.id, orderId));
		}
	});

	test("Waiter can process payment (Better-Auth role check)", async () => {
		const waiterCaller = appRouter.createCaller(waiterContext);
		const customerCaller = appRouter.createCaller(customerContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		createdOrderIds.push(createResult.orderId);
		
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Waiter processes payment
		const paymentResult = await waiterCaller.payments.create({
			orderId: createResult.orderId,
			amount: 2500,
			method: "Cash",
		});

		expect(paymentResult).toBeDefined();
		expect(paymentResult.paymentId).toBeGreaterThan(0);
		expect(paymentResult.amount).toBe(2500);
	});

	test("Manager can process payment (Better-Auth role check)", async () => {
		const managerCaller = appRouter.createCaller(managerContext);
		const customerCaller = appRouter.createCaller(customerContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		createdOrderIds.push(createResult.orderId);
		
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await managerCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await managerCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await managerCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await managerCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Manager processes payment
		const paymentResult = await managerCaller.payments.create({
			orderId: createResult.orderId,
			amount: 2500,
			method: "Cash",
		});

		expect(paymentResult).toBeDefined();
		expect(paymentResult.paymentId).toBeGreaterThan(0);
	});

	test("KitchenStaff can process payment (Better-Auth role check)", async () => {
		const kitchenCaller = appRouter.createCaller(kitchenStaffContext);
		const customerCaller = appRouter.createCaller(customerContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		createdOrderIds.push(createResult.orderId);
		
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await kitchenCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await kitchenCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await kitchenCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await kitchenCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Kitchen staff processes payment
		const paymentResult = await kitchenCaller.payments.create({
			orderId: createResult.orderId,
			amount: 2500,
			method: "Cash",
		});

		expect(paymentResult).toBeDefined();
		expect(paymentResult.paymentId).toBeGreaterThan(0);
	});

	test("Customer cannot process payment (Better-Auth authorization)", async () => {
		const customerCaller = appRouter.createCaller(customerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Create and complete order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 1 }],
		});
		createdOrderIds.push(createResult.orderId);
		
		await customerCaller.orders.submit({ orderId: createResult.orderId });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Customer tries to process payment (should fail)
		try {
			await customerCaller.payments.create({
				orderId: createResult.orderId,
				amount: 2500,
				method: "Cash",
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("FORBIDDEN");
			expect(error.message).toContain("Staff access required");
		}
	});

	test("Only Manager can view payment history (Better-Auth authorization)", async () => {
		const managerCaller = appRouter.createCaller(managerContext);
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Manager can view payment history
		const historyResult = await managerCaller.payments.getHistory({
			tableId: testTableId,
		});

		expect(historyResult).toBeDefined();
		expect(historyResult.payments).toBeDefined();
		expect(Array.isArray(historyResult.payments)).toBe(true);

		// Waiter cannot view payment history
		try {
			await waiterCaller.payments.getHistory({
				tableId: testTableId,
			});
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.code).toBe("FORBIDDEN");
			expect(error.message).toContain("Manager access required");
		}
	});

	test("Better-Auth context includes session and user information", async () => {
		const waiterCaller = appRouter.createCaller(waiterContext);

		// Verify context has session data
		expect(waiterContext.session).toBeDefined();
		expect(waiterContext.session?.user).toBeDefined();
		expect(waiterContext.session?.user.role).toBe("Waiter");
		expect(waiterContext.user).toBeDefined();
		expect(waiterContext.user?.email).toBe("waiter@test.com");
		expect(waiterContext.role).toBe("Waiter");

		// Verify manager context
		expect(managerContext.session).toBeDefined();
		expect(managerContext.session?.user.role).toBe("Manager");
		expect(managerContext.role).toBe("Manager");

		// Verify kitchen staff context
		expect(kitchenStaffContext.session).toBeDefined();
		expect(kitchenStaffContext.session?.user.role).toBe("KitchenStaff");
		expect(kitchenStaffContext.role).toBe("KitchenStaff");
	});

	test("Complete payment workflow with Better-Auth user tracking", async () => {
		const waiterCaller = appRouter.createCaller(waiterContext);
		const customerCaller = appRouter.createCaller(customerContext);
		const managerCaller = appRouter.createCaller(managerContext);

		// Create order
		const createResult = await customerCaller.orders.create({
			tableId: testTableId,
			items: [{ dishId: testDishId, quantity: 2 }],
		});
		createdOrderIds.push(createResult.orderId);
		
		await customerCaller.orders.submit({ orderId: createResult.orderId });

		// Complete order workflow with authenticated waiter
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "InKitchen" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "ReadyToServe" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Served" });
		await waiterCaller.orders.updateStatus({ orderId: createResult.orderId, newStatus: "Completed" });

		// Process payment
		const paymentResult = await waiterCaller.payments.create({
			orderId: createResult.orderId,
			amount: 5000, // 2 * $25.00
			method: "Cash",
		});

		// Verify payment in history as manager
		const history = await managerCaller.payments.getHistory({
			tableId: testTableId,
		});

		const payment = history.payments.find(p => p.id === paymentResult.paymentId);
		expect(payment).toBeDefined();
		expect(payment!.amount).toBe(5000);
		expect(payment!.tableNumber).toBe(900);

		// Verify order status
		const order = await db.query.orders.findFirst({
			where: (orders, { eq }) => eq(orders.id, createResult.orderId),
		});
		expect(order!.status).toBe("Paid");
	});
});
