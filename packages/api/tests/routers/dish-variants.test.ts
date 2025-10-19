import { beforeAll, describe, expect, test } from "bun:test"
import { db, dishes, dishVariants, eq, ingredients, recipes } from "@learn-bettert/db"

import type { Context } from "../../src/context"
import { appRouter } from "../../src/routers/index"
import { mockWsNotifier } from "../setup"

/**
 * T066-T070: Contract tests for dish variants CRUD
 * TDD Red Phase: Tests for variant management
 * 
 * Test Coverage:
 * - T066: dishes.createVariant - Add variant to dish
 * - T067: dishes.updateVariant - Update variant fields  
 * - T068: dishes.deleteVariant - Delete variant (check orderItems first)
 * - T069: dishes.listVariants - Get all variants for dish
 * - T070: dishes.getById includes variants array
 */

// Mock context for testing - manager role required for variant management
const mockManagerContext: Context = {
  session: { id: "test-session", userId: "manager-test-001" },
  user: { id: "manager-test-001", name: "Test Manager", role: "Manager" },
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

const mockPublicContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

describe("Dishes Router - Variant Management (T066-T070)", () => {
  let testDishId: number
  let testIngredientId: number

  beforeAll(async () => {
    // Create test ingredient
    const existingIngredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Test Ingredient for Variants"),
    })

    if (existingIngredient) {
      testIngredientId = existingIngredient.id
    } else {
      const [ingredient] = await db
        .insert(ingredients)
        .values({
          name: "Test Ingredient for Variants",
          quantity: 100,
          unit: "kg",
          threshold: 10,
        })
        .returning()
      testIngredientId = ingredient.id
    }

    // Create test dish
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Test Pizza with Variants"),
    })

    if (existingDish) {
      testDishId = existingDish.id
    } else {
      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Test Pizza with Variants",
          description: "Test pizza for variant testing",
          price: 1200, // Base price $12.00
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id

      // Create recipe
      await db.insert(recipes).values({
        dishId: testDishId,
        ingredientId: testIngredientId,
        quantityRequired: 0.5,
      })
    }
  })

  describe("T066: dishes.createVariant", () => {
    test("should create a variant for a dish", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.createVariant({
        dishId: testDishId,
        name: "Small",
        price: 1000, // $10.00
        displayOrder: 1,
      })

      expect(result).toBeDefined()
      expect(result.variantId).toBeNumber()
      expect(result.name).toBe("Small")
      expect(result.price).toBe(1000)

      // Verify variant was created in database
      const variant = await db.query.dishVariants.findFirst({
        where: (dishVariants, { eq }) => eq(dishVariants.id, result.variantId),
      })

      expect(variant).toBeDefined()
      expect(variant?.dishId).toBe(testDishId)
      expect(variant?.name).toBe("Small")
    })

    test("should fail if dish does not exist", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.dishes.createVariant({
          dishId: 99999,
          name: "Large",
          price: 1500,
          displayOrder: 2,
        })
      ).rejects.toThrow()
    })

    test("should require manager role", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      await expect(
        caller.dishes.createVariant({
          dishId: testDishId,
          name: "Medium",
          price: 1200,
          displayOrder: 2,
        })
      ).rejects.toThrow()
    })
  })

  describe("T067: dishes.updateVariant", () => {
    let variantId: number

    beforeAll(async () => {
      // Create variant for update tests
      const [variant] = await db
        .insert(dishVariants)
        .values({
          dishId: testDishId,
          name: "Test Update Variant",
          price: 1300,
          displayOrder: 5,
        })
        .returning()
      variantId = variant.id
    })

    test("should update variant name", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.updateVariant({
        variantId,
        name: "Updated Name",
      })

      expect(result).toBeDefined()
      expect(result.variantId).toBe(variantId)
      expect(result.updatedFields).toContain("name")

      // Verify in database
      const variant = await db.query.dishVariants.findFirst({
        where: (dishVariants, { eq }) => eq(dishVariants.id, variantId),
      })
      expect(variant?.name).toBe("Updated Name")
    })

    test("should update variant price", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.updateVariant({
        variantId,
        price: 1500,
      })

      expect(result.updatedFields).toContain("price")

      const variant = await db.query.dishVariants.findFirst({
        where: (dishVariants, { eq }) => eq(dishVariants.id, variantId),
      })
      expect(variant?.price).toBe(1500)
    })

    test("should update variant displayOrder", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.updateVariant({
        variantId,
        displayOrder: 10,
      })

      expect(result.updatedFields).toContain("displayOrder")

      const variant = await db.query.dishVariants.findFirst({
        where: (dishVariants, { eq }) => eq(dishVariants.id, variantId),
      })
      expect(variant?.displayOrder).toBe(10)
    })

    test("should fail if variant does not exist", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.dishes.updateVariant({
          variantId: 99999,
          name: "Nonexistent",
        })
      ).rejects.toThrow()
    })
  })

  describe("T068: dishes.deleteVariant", () => {
    test("should delete variant if not used in orders", async () => {
      // Create a variant to delete
      const [variant] = await db
        .insert(dishVariants)
        .values({
          dishId: testDishId,
          name: "Delete Me",
          price: 1000,
          displayOrder: 99,
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.deleteVariant({
        variantId: variant.id,
      })

      expect(result).toBeDefined()
      expect(result.deleted).toBe(true)
      expect(result.variantId).toBe(variant.id)

      // Verify deleted from database
      const deletedVariant = await db.query.dishVariants.findFirst({
        where: (dishVariants, { eq }) => eq(dishVariants.id, variant.id),
      })
      expect(deletedVariant).toBeUndefined()
    })

    test("should fail if variant does not exist", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.dishes.deleteVariant({
          variantId: 99999,
        })
      ).rejects.toThrow()
    })

    // Note: Test for "variant used in orders" will be added after order integration
  })

  describe("T069: dishes.listVariants", () => {
    let dish2Id: number

    beforeAll(async () => {
      // Create another dish with multiple variants
      const [dish2] = await db
        .insert(dishes)
        .values({
          name: "Test Coffee with Sizes",
          description: "Coffee for variant listing test",
          price: 300, // Base price $3.00
          isAvailable: true,
        })
        .returning()
      dish2Id = dish2.id

      // Create multiple variants with different display orders
      await db.insert(dishVariants).values([
        { dishId: dish2Id, name: "Large", price: 500, displayOrder: 3 },
        { dishId: dish2Id, name: "Small", price: 300, displayOrder: 1 },
        { dishId: dish2Id, name: "Medium", price: 400, displayOrder: 2 },
      ])
    })

    test("should list all variants for a dish ordered by displayOrder", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      const result = await caller.dishes.listVariants({
        dishId: dish2Id,
      })

      expect(result).toBeDefined()
      expect(result.variants).toBeArray()
      expect(result.variants.length).toBe(3)

      // Verify ordering
      expect(result.variants[0].name).toBe("Small")
      expect(result.variants[0].displayOrder).toBe(1)
      expect(result.variants[1].name).toBe("Medium")
      expect(result.variants[1].displayOrder).toBe(2)
      expect(result.variants[2].name).toBe("Large")
      expect(result.variants[2].displayOrder).toBe(3)
    })

    test("should return empty array for dish without variants", async () => {
      // Create dish without variants
      const [dishNoVariants] = await db
        .insert(dishes)
        .values({
          name: "Test Dish No Variants",
          description: "No variants",
          price: 500,
          isAvailable: true,
        })
        .returning()

      const caller = appRouter.createCaller(mockPublicContext)

      const result = await caller.dishes.listVariants({
        dishId: dishNoVariants.id,
      })

      expect(result.variants).toBeArray()
      expect(result.variants.length).toBe(0)
    })

    test("should fail if dish does not exist", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      await expect(
        caller.dishes.listVariants({
          dishId: 99999,
        })
      ).rejects.toThrow()
    })
  })

  describe("T070: dishes.getById includes variants", () => {
    test("should include variants array in dish details", async () => {
      // Create dish with variants for this test
      const [testDish] = await db
        .insert(dishes)
        .values({
          name: "Test Dish for GetById",
          description: "Testing variant inclusion",
          price: 1000,
          isAvailable: true,
        })
        .returning()

      await db.insert(dishVariants).values([
        { dishId: testDish.id, name: "Small", price: 800, displayOrder: 1 },
        { dishId: testDish.id, name: "Large", price: 1200, displayOrder: 2 },
      ])

      const caller = appRouter.createCaller(mockPublicContext)

      const result = await caller.dishes.getById({
        dishId: testDish.id,
      })

      expect(result).toBeDefined()
      expect(result.variants).toBeArray()
      expect(result.variants.length).toBe(2)
      expect(result.variants[0].name).toBe("Small")
      expect(result.variants[0].price).toBe(800)
      expect(result.variants[1].name).toBe("Large")
      expect(result.variants[1].price).toBe(1200)
    })
  })
})
