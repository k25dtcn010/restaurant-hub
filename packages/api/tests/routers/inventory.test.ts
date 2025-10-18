import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, ingredients, dishes, recipes } from "@learn-bettert/db";
import type { Context } from "../../src/context";
import { mockWsNotifier } from "../setup";

/**
 * Phase 7 - User Story 5: Inventory Management Tests (TDD Red Phase)
 * 
 * T095: Contract test for inventory.getAll
 * T096: Contract test for inventory.adjustStock
 * T097: Contract test for inventory.updateThreshold
 * T098: Integration test for low-stock alerts
 * 
 * Contract: inventory-router.md
 * These tests should FAIL before implementation (Red phase)
 */

// Mock context for testing (Manager role required for inventory operations)
const mockManagerContext: Context = {
	session: {
		id: "test-session",
		userId: "manager-001",
		expiresAt: new Date(Date.now() + 86400000),
		token: "test-token",
		ipAddress: "127.0.0.1",
		userAgent: "test-agent",
	},
	user: {
		id: "manager-001",
		email: "admin@restauranthub.com",
		name: "Admin Manager",
		role: "Manager",
	},
	role: "Manager",
	db,
};

const mockKitchenContext: Context = {
	session: null,
	user: {
		id: "chef-001",
		email: "chef@restauranthub.com",
		name: "Head Chef",
		role: "KitchenStaff",
	},
	role: "KitchenStaff",
	db,
};

describe("Inventory Router - inventory.getAll (T095)", () => {
	let testIngredient1Id: number;
	let testIngredient2Id: number;
	let testDishId: number;

	beforeAll(async () => {
		// Check if test ingredients already exist
		const existingIngredient1 = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Tomatoes Inventory"),
		});
		const existingIngredient2 = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Flour Inventory"),
		});

		if (existingIngredient1 && existingIngredient2) {
			testIngredient1Id = existingIngredient1.id;
			testIngredient2Id = existingIngredient2.id;

			// Reset quantities for consistent test results
			await db.update(ingredients)
				.set({ quantity: 50, threshold: 10 })
				.where(eq(ingredients.id, testIngredient1Id));
			await db.update(ingredients)
				.set({ quantity: 3, threshold: 5 })
				.where(eq(ingredients.id, testIngredient2Id));
		} else {
			// Create test ingredients
			const [ingredient1] = await db.insert(ingredients).values({
				name: "Test Tomatoes Inventory",
				quantity: 50,
				unit: "kg",
				threshold: 10,
			}).returning();
			testIngredient1Id = ingredient1.id;

			// Create low-stock ingredient
			const [ingredient2] = await db.insert(ingredients).values({
				name: "Test Flour Inventory",
				quantity: 3, // Below threshold of 5
				unit: "kg",
				threshold: 5,
			}).returning();
			testIngredient2Id = ingredient2.id;
		}

		// Check if test dish exists
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Pasta Inventory"),
		});

		if (existingDish) {
			testDishId = existingDish.id;
		} else {
			// Create test dish that uses ingredient1
			const [dish] = await db.insert(dishes).values({
				name: "Test Pasta Inventory",
				description: "Test dish for inventory",
				price: 1500,
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe linking dish to ingredient
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredient1Id,
				quantityRequired: 2.0,
			});
		}
	});

	test("should return all ingredients with stock levels", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({});

		expect(result).toBeDefined();
		expect(result.ingredients).toBeArray();
		expect(result.ingredients.length).toBeGreaterThan(0);

		// Find our test ingredients
		const testIngredient1 = result.ingredients.find(i => i.id === testIngredient1Id);
		expect(testIngredient1).toBeDefined();
		expect(testIngredient1?.name).toBe("Test Tomatoes Inventory");
		expect(testIngredient1?.quantity).toBe(50);
		expect(testIngredient1?.unit).toBe("kg");
		expect(testIngredient1?.threshold).toBe(10);
		expect(testIngredient1?.isLowStock).toBe(false);
	});

	test("should calculate isLowStock flag correctly", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({});

		// Check low-stock ingredient
		const lowStockIngredient = result.ingredients.find(i => i.id === testIngredient2Id);
		expect(lowStockIngredient).toBeDefined();
		expect(lowStockIngredient?.quantity).toBe(3);
		expect(lowStockIngredient?.threshold).toBe(5);
		expect(lowStockIngredient?.isLowStock).toBe(true);

		// Check normal stock ingredient
		const normalStockIngredient = result.ingredients.find(i => i.id === testIngredient1Id);
		expect(normalStockIngredient?.isLowStock).toBe(false);
	});

	test("should sort low-stock items first", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({});

		// Find indices of our test ingredients
		const lowStockIndex = result.ingredients.findIndex(i => i.id === testIngredient2Id);
		const normalStockIndex = result.ingredients.findIndex(i => i.id === testIngredient1Id);

		// Low stock should appear before normal stock (or at least not be after if names affect sorting)
		if (lowStockIndex !== -1 && normalStockIndex !== -1) {
			// Either low stock is first, or they're sorted by name within their low-stock groups
			expect(lowStockIndex).toBeLessThanOrEqual(result.ingredients.filter(i => i.isLowStock).length);
		}
	});

	test("should include dish usage when includeRecipes=true", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({ includeRecipes: true });

		const testIngredient = result.ingredients.find(i => i.id === testIngredient1Id);
		expect(testIngredient).toBeDefined();
		expect(testIngredient?.usedInDishes).toBeDefined();
		expect(testIngredient?.usedInDishes).toBeArray();
		
		if (testIngredient?.usedInDishes && testIngredient.usedInDishes.length > 0) {
			const dishUsage = testIngredient.usedInDishes.find(d => d.dishId === testDishId);
			expect(dishUsage).toBeDefined();
			expect(dishUsage?.dishName).toBe("Test Pasta Inventory");
			expect(dishUsage?.quantityRequired).toBe(2.0);
		}
	});

	test("should require Manager role", async () => {
		const caller = appRouter.createCaller(mockKitchenContext);
		
		await expect(caller.inventory.getAll({})).rejects.toThrow();
	});
});

describe("Inventory Router - inventory.adjustStock (T096)", () => {
	let testIngredientId: number;

	beforeEach(async () => {
		// Create fresh test ingredient for each test
		const [ingredient] = await db.insert(ingredients).values({
			name: `Test Adjust Stock ${Date.now()}`,
			quantity: 50,
			unit: "kg",
			threshold: 10,
		}).returning();
		testIngredientId = ingredient.id;
	});

	test("should increase stock with positive adjustment", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		const result = await caller.inventory.adjustStock({
			ingredientId: testIngredientId,
			adjustment: 25,
			reason: "Received delivery",
		});

		expect(result).toBeDefined();
		expect(result.ingredientId).toBe(testIngredientId);
		expect(result.oldQuantity).toBe(50);
		expect(result.newQuantity).toBe(75);
		expect(result.adjustment).toBe(25);

		// Verify in database
		const updated = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.id, testIngredientId),
		});
		expect(updated?.quantity).toBe(75);
	});

	test("should decrease stock with negative adjustment", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		const result = await caller.inventory.adjustStock({
			ingredientId: testIngredientId,
			adjustment: -20,
			reason: "Spoilage",
		});

		expect(result.oldQuantity).toBe(50);
		expect(result.newQuantity).toBe(30);
		expect(result.adjustment).toBe(-20);
	});

	test("should prevent negative quantity", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		await expect(
			caller.inventory.adjustStock({
				ingredientId: testIngredientId,
				adjustment: -60, // Would result in -10
			})
		).rejects.toThrow(/negative quantity/i);
	});

	test("should return error for non-existent ingredient", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		await expect(
			caller.inventory.adjustStock({
				ingredientId: 999999,
				adjustment: 10,
			})
		).rejects.toThrow();
	});

	test("should update updatedAt timestamp", async () => {
		const beforeUpdate = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.id, testIngredientId),
		});

		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.adjustStock({
			ingredientId: testIngredientId,
			adjustment: 5,
		});

		expect(result.updatedAt).toBeDefined();
		if (beforeUpdate?.updatedAt) {
			expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.updatedAt.getTime());
		}
	});

	test("should require Manager role", async () => {
		const caller = appRouter.createCaller(mockKitchenContext);
		
		await expect(
			caller.inventory.adjustStock({
				ingredientId: testIngredientId,
				adjustment: 10,
			})
		).rejects.toThrow();
	});
});

describe("Inventory Router - inventory.updateThreshold (T097)", () => {
	let testIngredientId: number;

	beforeEach(async () => {
		// Create test ingredient
		const [ingredient] = await db.insert(ingredients).values({
			name: `Test Threshold ${Date.now()}`,
			quantity: 50,
			unit: "kg",
			threshold: 10,
		}).returning();
		testIngredientId = ingredient.id;
	});

	test("should update threshold successfully", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		const result = await caller.inventory.updateThreshold({
			ingredientId: testIngredientId,
			threshold: 20,
		});

		expect(result).toBeDefined();
		expect(result.ingredientId).toBe(testIngredientId);
		expect(result.threshold).toBe(20);

		// Verify in database
		const updated = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.id, testIngredientId),
		});
		expect(updated?.threshold).toBe(20);
	});

	test("should recompute isLowStock after threshold change", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		// Set threshold above current quantity (50)
		const result = await caller.inventory.updateThreshold({
			ingredientId: testIngredientId,
			threshold: 60, // Now 50 < 60, so should be low stock
		});

		expect(result.isLowStock).toBe(true);
	});

	test("should prevent negative threshold", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		await expect(
			caller.inventory.updateThreshold({
				ingredientId: testIngredientId,
				threshold: -5,
			})
		).rejects.toThrow(/Too small|negative|>=0/i);
	});

	test("should return error for non-existent ingredient", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		await expect(
			caller.inventory.updateThreshold({
				ingredientId: 999999,
				threshold: 10,
			})
		).rejects.toThrow();
	});

	test("should require Manager role", async () => {
		const caller = appRouter.createCaller(mockKitchenContext);
		
		await expect(
			caller.inventory.updateThreshold({
				ingredientId: testIngredientId,
				threshold: 15,
			})
		).rejects.toThrow();
	});
});

describe("Inventory Router - Low Stock Alerts Integration (T098)", () => {
	let lowStockIngredient1Id: number;
	let lowStockIngredient2Id: number;
	let normalStockIngredientId: number;

	beforeAll(async () => {
		// Check if test ingredients already exist
		const existingIngredient1 = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Low Stock Onions"),
		});
		const existingIngredient2 = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Low Stock Peppers"),
		});
		const existingIngredient3 = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Normal Stock Rice"),
		});

		if (existingIngredient1 && existingIngredient2 && existingIngredient3) {
			lowStockIngredient1Id = existingIngredient1.id;
			lowStockIngredient2Id = existingIngredient2.id;
			normalStockIngredientId = existingIngredient3.id;

			// Reset quantities for consistent test results
			await db.update(ingredients)
				.set({ quantity: 2, threshold: 10 })
				.where(eq(ingredients.id, lowStockIngredient1Id));
			await db.update(ingredients)
				.set({ quantity: 5, threshold: 15 })
				.where(eq(ingredients.id, lowStockIngredient2Id));
			await db.update(ingredients)
				.set({ quantity: 100, threshold: 20 })
				.where(eq(ingredients.id, normalStockIngredientId));
		} else {
			// Create low-stock ingredients
			const [ingredient1] = await db.insert(ingredients).values({
				name: "Test Low Stock Onions",
				quantity: 2,
				unit: "kg",
				threshold: 10,
			}).returning();
			lowStockIngredient1Id = ingredient1.id;

			const [ingredient2] = await db.insert(ingredients).values({
				name: "Test Low Stock Peppers",
				quantity: 5,
				unit: "kg",
				threshold: 15, // More critical (larger deficit)
			}).returning();
			lowStockIngredient2Id = ingredient2.id;

			// Create normal stock ingredient
			const [ingredient3] = await db.insert(ingredients).values({
				name: "Test Normal Stock Rice",
				quantity: 100,
				unit: "kg",
				threshold: 20,
			}).returning();
			normalStockIngredientId = ingredient3.id;
		}
	});

	test("should identify all low-stock ingredients", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({});

		const lowStockItems = result.ingredients.filter(i => i.isLowStock);
		
		// Should include our low-stock test ingredients
		expect(lowStockItems.length).toBeGreaterThanOrEqual(2);
		
		const hasIngredient1 = lowStockItems.some(i => i.id === lowStockIngredient1Id);
		const hasIngredient2 = lowStockItems.some(i => i.id === lowStockIngredient2Id);
		
		expect(hasIngredient1).toBe(true);
		expect(hasIngredient2).toBe(true);
	});

	test("should not flag normal stock items as low", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		const result = await caller.inventory.getAll({});

		const normalStockItem = result.ingredients.find(i => i.id === normalStockIngredientId);
		expect(normalStockItem).toBeDefined();
		expect(normalStockItem?.isLowStock).toBe(false);
	});

	test("should trigger low-stock status when threshold is raised above quantity", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		// Update threshold to make normal stock item low
		const result = await caller.inventory.updateThreshold({
			ingredientId: normalStockIngredientId,
			threshold: 150, // Above current 100
		});

		expect(result.isLowStock).toBe(true);

		// Restore for other tests
		await caller.inventory.updateThreshold({
			ingredientId: normalStockIngredientId,
			threshold: 20,
		});
	});

	test("should clear low-stock status when stock is increased above threshold", async () => {
		const caller = appRouter.createCaller(mockManagerContext);
		
		// Increase stock above threshold
		const result = await caller.inventory.adjustStock({
			ingredientId: lowStockIngredient1Id,
			adjustment: 20, // 2 + 20 = 22, which is > threshold of 10
		});

		// Check if it's no longer low stock
		const allInventory = await caller.inventory.getAll({});
		const updatedItem = allInventory.ingredients.find(i => i.id === lowStockIngredient1Id);
		expect(updatedItem?.isLowStock).toBe(false);
	});
});
