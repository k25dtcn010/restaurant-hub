import { describe, test, expect, beforeAll } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, ingredients, dishes, recipes } from "@learn-bettert/db";
import type { Context } from "../../src/context";

/**
 * T039: Contract test for dishes.getAll
 * Contract: dishes-router.md Procedure 1
 * TDD Red Phase: This test should FAIL before implementation
 */

// Mock context for testing
const mockContext: Context = {
	session: null,
	user: null,
	role: null,
	db,
};

describe("Dishes Router - dishes.getAll", () => {
	let testDishId: number;
	let testIngredientId: number;

	beforeAll(async () => {
		// Check if test data already exists from previous run
		const existingIngredient = await db.query.ingredients.findFirst({
			where: (ingredients, { eq }) => eq(ingredients.name, "Test Flour"),
		});
		const existingDish = await db.query.dishes.findFirst({
			where: (dishes, { eq }) => eq(dishes.name, "Test Pizza"),
		});

		if (existingIngredient && existingDish) {
			testIngredientId = existingIngredient.id;
			testDishId = existingDish.id;
		} else {
			// Create test ingredient
			const [ingredient] = await db.insert(ingredients).values({
				name: "Test Flour",
				quantity: 100,
				unit: "kg",
				threshold: 10,
			}).returning();
			testIngredientId = ingredient.id;

			// Create test dish
			const [dish] = await db.insert(dishes).values({
				name: "Test Pizza",
				description: "Delicious test pizza",
				price: 1200, // $12.00
				isAvailable: true,
			}).returning();
			testDishId = dish.id;

			// Create recipe linking dish to ingredient
			await db.insert(recipes).values({
				dishId: testDishId,
				ingredientId: testIngredientId,
				quantityRequired: 0.5,
			});
		}
	});

	test("should return all available dishes by default", async () => {
		// Ensure ingredient has stock (reset from previous test)
		await db.update(ingredients)
			.set({ quantity: 100 })
			.where(eq(ingredients.id, testIngredientId));

		const caller = appRouter.createCaller(mockContext);
		
		const result = await caller.dishes.getAll({});

		expect(result).toBeDefined();
		expect(result.dishes).toBeArray();
		expect(result.dishes.length).toBeGreaterThan(0);
		
		const testDish = result.dishes.find(d => d.id === testDishId);
		expect(testDish).toBeDefined();
		expect(testDish?.name).toBe("Test Pizza");
		expect(testDish?.price).toBe(1200);
		expect(testDish?.isAvailable).toBe(true);
	});

	test("should mark dish unavailable when ingredient is out of stock", async () => {
		// Reduce ingredient stock to 0
		await db.update(ingredients)
			.set({ quantity: 0 })
			.where(eq(ingredients.id, testIngredientId));

		const caller = appRouter.createCaller(mockContext);
		// Use includeDisabled: true to see unavailable dishes
		const result = await caller.dishes.getAll({ includeDisabled: true });

		const testDish = result.dishes.find(d => d.id === testDishId);
		expect(testDish).toBeDefined();
		expect(testDish?.isAvailable).toBe(false);

		// Restore stock for other tests
		await db.update(ingredients)
			.set({ quantity: 100 })
			.where(eq(ingredients.id, testIngredientId));
	});

	test("should include disabled dishes when includeDisabled=true", async () => {
		// Create a disabled dish
		const [disabledDish] = await db.insert(dishes).values({
			name: "Disabled Dish",
			description: "Not available",
			price: 1000,
			isAvailable: false,
		}).returning();

		const caller = appRouter.createCaller(mockContext);
		const result = await caller.dishes.getAll({ includeDisabled: true });

		const foundDisabled = result.dishes.find(d => d.id === disabledDish.id);
		expect(foundDisabled).toBeDefined();
	});

	test("should filter out disabled dishes by default", async () => {
		const caller = appRouter.createCaller(mockContext);
		const result = await caller.dishes.getAll({});

		const hasDisabledDish = result.dishes.some(d => d.isAvailable === false);
		expect(hasDisabledDish).toBe(false);
	});
});
