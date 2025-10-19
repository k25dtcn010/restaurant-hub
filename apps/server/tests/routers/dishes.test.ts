import { beforeAll, describe, expect, test } from "bun:test"
import { db, dishes, eq, ingredients, recipes } from "@/db"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { mockWsNotifier } from "../setup"

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
  wsNotifier: mockWsNotifier,
}

describe("Dishes Router - dishes.getAll", () => {
  let testDishId: number
  let testIngredientId: number

  beforeAll(async () => {
    // Check if test data already exists from previous run
    const existingIngredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Test Flour"),
    })
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Test Pizza"),
    })

    if (existingIngredient && existingDish) {
      testIngredientId = existingIngredient.id
      testDishId = existingDish.id

      // Ensure recipe exists
      const existingRecipe = await db.query.recipes.findFirst({
        where: (recipes, { and, eq }) =>
          and(eq(recipes.dishId, testDishId), eq(recipes.ingredientId, testIngredientId)),
      })

      if (!existingRecipe) {
        // Create recipe if it doesn't exist
        await db.insert(recipes).values({
          dishId: testDishId,
          ingredientId: testIngredientId,
          quantityRequired: 0.5,
        })
      }
    } else {
      // Create test ingredient
      const [ingredient] = await db
        .insert(ingredients)
        .values({
          name: "Test Flour",
          quantity: 100,
          unit: "kg",
          threshold: 10,
        })
        .returning()
      testIngredientId = ingredient.id

      // Create test dish
      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Test Pizza",
          description: "Delicious test pizza",
          price: 1200, // $12.00
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id

      // Create recipe linking dish to ingredient
      await db.insert(recipes).values({
        dishId: testDishId,
        ingredientId: testIngredientId,
        quantityRequired: 0.5,
      })
    }
  })

  test("should return all available dishes by default", async () => {
    // Ensure ingredient has stock (reset from previous test)
    await db.update(ingredients).set({ quantity: 100 }).where(eq(ingredients.id, testIngredientId))

    const caller = appRouter.createCaller(mockContext)

    const result = await caller.dishes.getAll({})

    expect(result).toBeDefined()
    expect(result.dishes).toBeArray()
    expect(result.dishes.length).toBeGreaterThan(0)

    const testDish = result.dishes.find((d) => d.id === testDishId)
    expect(testDish).toBeDefined()
    expect(testDish?.name).toBe("Test Pizza")
    expect(testDish?.price).toBe(1200)
    expect(testDish?.isAvailable).toBe(true)
  })

  test("should mark dish unavailable when ingredient is out of stock", async () => {
    // Reduce ingredient stock to 0
    await db.update(ingredients).set({ quantity: 0 }).where(eq(ingredients.id, testIngredientId))

    const caller = appRouter.createCaller(mockContext)
    // Use includeDisabled: true to see unavailable dishes
    const result = await caller.dishes.getAll({ includeDisabled: true })

    const testDish = result.dishes.find((d) => d.id === testDishId)
    expect(testDish).toBeDefined()
    expect(testDish?.isAvailable).toBe(false)

    // Restore stock for other tests
    await db.update(ingredients).set({ quantity: 100 }).where(eq(ingredients.id, testIngredientId))
  })

  test("should include disabled dishes when includeDisabled=true", async () => {
    // Create a disabled dish
    const [disabledDish] = await db
      .insert(dishes)
      .values({
        name: "Disabled Dish",
        description: "Not available",
        price: 1000,
        isAvailable: false,
      })
      .returning()

    const caller = appRouter.createCaller(mockContext)
    const result = await caller.dishes.getAll({ includeDisabled: true })

    const foundDisabled = result.dishes.find((d) => d.id === disabledDish.id)
    expect(foundDisabled).toBeDefined()
  })

  test("should filter out disabled dishes by default", async () => {
    const caller = appRouter.createCaller(mockContext)
    const result = await caller.dishes.getAll({})

    const hasDisabledDish = result.dishes.some((d) => d.isAvailable === false)
    expect(hasDisabledDish).toBe(false)
  })
})

/**
 * T052: Test for dishes.update with flag fields
 * Testing: isRecommended, isChefSpecial, orderPriority flags
 * TDD Red Phase: These tests should FAIL before implementation
 */

// Mock manager context for testing
const mockManagerContext: Context = {
  session: { id: "test-session", userId: "manager-user-id" } as any,
  user: { id: "manager-user-id", email: "manager@test.com", name: "Test Manager" } as any,
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Dishes Router - dishes.update with flag fields (T052)", () => {
  let testDishId: number

  beforeAll(async () => {
    // Create a test dish for flag updates
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Burger for Flags",
        description: "A burger to test flag updates",
        price: 1500,
        isAvailable: true,
        isRecommended: false,
        isChefSpecial: false,
        orderPriority: 0,
      })
      .returning()
    testDishId = dish.id
  })

  test("should update isRecommended flag", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      isRecommended: true,
    })

    expect(result).toBeDefined()
    expect(result.updatedFields).toContain("isRecommended")

    // Verify in database
    const updatedDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(updatedDish?.isRecommended).toBe(true)
  })

  test("should update isChefSpecial flag", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      isChefSpecial: true,
    })

    expect(result).toBeDefined()
    expect(result.updatedFields).toContain("isChefSpecial")

    // Verify in database
    const updatedDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(updatedDish?.isChefSpecial).toBe(true)
  })

  test("should update orderPriority within valid range (0-100)", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      orderPriority: 90,
    })

    expect(result).toBeDefined()
    expect(result.updatedFields).toContain("orderPriority")

    // Verify in database
    const updatedDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(updatedDish?.orderPriority).toBe(90)
  })

  test("should reject orderPriority outside valid range (0-100)", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    // Test value > 100
    await expect(
      caller.dishes.update({
        dishId: testDishId,
        orderPriority: 150,
      })
    ).rejects.toThrow()

    // Test negative value
    await expect(
      caller.dishes.update({
        dishId: testDishId,
        orderPriority: -10,
      })
    ).rejects.toThrow()
  })

  test("should update multiple flags at once", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      isRecommended: true,
      isChefSpecial: true,
      orderPriority: 80,
    })

    expect(result).toBeDefined()
    expect(result.updatedFields).toContain("isRecommended")
    expect(result.updatedFields).toContain("isChefSpecial")
    expect(result.updatedFields).toContain("orderPriority")

    // Verify in database
    const updatedDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(updatedDish?.isRecommended).toBe(true)
    expect(updatedDish?.isChefSpecial).toBe(true)
    expect(updatedDish?.orderPriority).toBe(80)
  })
})
