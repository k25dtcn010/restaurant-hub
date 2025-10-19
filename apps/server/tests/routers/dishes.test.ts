import { beforeAll, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import {
  db,
  dishes,
  dishVariants,
  eq,
  ingredients,
  orderItems,
  orders,
  recipes,
  tables,
} from "@/db"

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

/**
 * T066-RED: Test for dishes.createVariant
 * TDD Red Phase: This test should FAIL before implementation
 * Contract: Add variant to dish (name, price, displayOrder)
 */
describe("Dishes Router - dishes.createVariant (T066)", () => {
  let testDishId: number

  beforeAll(async () => {
    // Create test ingredient
    const [ingredient] = await db
      .insert(ingredients)
      .values({
        name: "Test Flour for Variant",
        unit: "kg",
        quantity: 100,
        minQuantity: 10,
        costPerUnit: 500,
      })
      .returning()

    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Pizza for Variants",
        description: "Test pizza to test variant creation",
        price: 1200, // Base price $12.00
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    testDishId = dish!.id
  })

  test("Manager can create a variant for a dish", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const result = await caller.dishes.createVariant({
      dishId: testDishId,
      name: "Small",
      price: 800, // $8.00
      displayOrder: 0,
    })

    expect(result).toBeDefined()
    expect(result.variantId).toBeTypeOf("number")
    expect(result.name).toBe("Small")

    // Verify in database
    const variant = await db.query.dishVariants.findFirst({
      where: (dishVariants, { eq }) => eq(dishVariants.id, result.variantId),
    })
    expect(variant).toBeDefined()
    expect(variant?.name).toBe("Small")
    expect(variant?.price).toBe(800)
    expect(variant?.dishId).toBe(testDishId)
  })

  test("Multiple variants can be created with different display orders", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const medium = await caller.dishes.createVariant({
      dishId: testDishId,
      name: "Medium",
      price: 1200, // $12.00
      displayOrder: 1,
    })

    const large = await caller.dishes.createVariant({
      dishId: testDishId,
      name: "Large",
      price: 1600, // $16.00
      displayOrder: 2,
    })

    expect(medium.variantId).toBeTypeOf("number")
    expect(large.variantId).toBeTypeOf("number")
    expect(medium.variantId).not.toBe(large.variantId)
  })

  test("Non-manager cannot create variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "waiter-1" },
      role: "waiter",
    } as Context)

    await expect(
      caller.dishes.createVariant({
        dishId: testDishId,
        name: "Extra Large",
        price: 2000,
        displayOrder: 3,
      })
    ).rejects.toThrow()
  })

  test("Cannot create variant for non-existent dish", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    await expect(
      caller.dishes.createVariant({
        dishId: 99999,
        name: "Small",
        price: 800,
        displayOrder: 0,
      })
    ).rejects.toThrow("Dish ID 99999 does not exist")
  })
})

/**
 * T067-RED: Test for dishes.updateVariant
 * TDD Red Phase: This test should FAIL before implementation
 * Contract: Update variant fields (name, price, displayOrder)
 */
describe("Dishes Router - dishes.updateVariant (T067)", () => {
  let testDishId: number
  let testVariantId: number

  beforeAll(async () => {
    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Dish for Update Variant",
        description: "Test dish",
        price: 1000,
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    testDishId = dish!.id

    // Create test variant
    const [variant] = await db
      .insert(dishVariants)
      .values({
        dishId: testDishId,
        name: "Original Name",
        price: 1000,
        displayOrder: 0,
      })
      .returning()

    testVariantId = variant!.id
  })

  test("Manager can update variant name", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const result = await caller.dishes.updateVariant({
      variantId: testVariantId,
      name: "Updated Name",
    })

    expect(result).toBeDefined()
    expect(result.updatedFields).toContain("name")

    // Verify in database
    const variant = await db.query.dishVariants.findFirst({
      where: (dishVariants, { eq }) => eq(dishVariants.id, testVariantId),
    })
    expect(variant?.name).toBe("Updated Name")
  })

  test("Manager can update variant price", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const result = await caller.dishes.updateVariant({
      variantId: testVariantId,
      price: 1500,
    })

    expect(result.updatedFields).toContain("price")

    const variant = await db.query.dishVariants.findFirst({
      where: (dishVariants, { eq }) => eq(dishVariants.id, testVariantId),
    })
    expect(variant?.price).toBe(1500)
  })

  test("Manager can update display order", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const result = await caller.dishes.updateVariant({
      variantId: testVariantId,
      displayOrder: 5,
    })

    expect(result.updatedFields).toContain("displayOrder")

    const variant = await db.query.dishVariants.findFirst({
      where: (dishVariants, { eq }) => eq(dishVariants.id, testVariantId),
    })
    expect(variant?.displayOrder).toBe(5)
  })

  test("Cannot update non-existent variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    await expect(
      caller.dishes.updateVariant({
        variantId: 99999,
        name: "Updated",
      })
    ).rejects.toThrow("Variant ID 99999 does not exist")
  })

  test("Non-manager cannot update variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "waiter-1" },
      role: "waiter",
    } as Context)

    await expect(
      caller.dishes.updateVariant({
        variantId: testVariantId,
        name: "Hacked Name",
      })
    ).rejects.toThrow()
  })
})

/**
 * T068-RED: Test for dishes.deleteVariant
 * TDD Red Phase: This test should FAIL before implementation
 * Contract: Delete variant if not used in orders
 */
describe("Dishes Router - dishes.deleteVariant (T068)", () => {
  let testDishId: number
  let unusedVariantId: number
  let usedVariantId: number

  beforeAll(async () => {
    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Dish for Delete Variant",
        description: "Test dish",
        price: 1000,
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    testDishId = dish!.id

    // Create unused variant
    const [unusedVariant] = await db
      .insert(dishVariants)
      .values({
        dishId: testDishId,
        name: "Unused Variant",
        price: 800,
        displayOrder: 0,
      })
      .returning()

    unusedVariantId = unusedVariant!.id

    // Create used variant
    const [usedVariant] = await db
      .insert(dishVariants)
      .values({
        dishId: testDishId,
        name: "Used Variant",
        price: 1200,
        displayOrder: 1,
      })
      .returning()

    usedVariantId = usedVariant!.id

    // Create a table for order
    const [table] = await db
      .insert(tables)
      .values({
        number: 999,
        qrCode: "TEST-QR-999",
        capacity: 4,
      })
      .returning()

    // Create order with the used variant
    const [order] = await db
      .insert(orders)
      .values({
        tableId: table!.id,
        status: "pending",
        totalAmount: 1200,
      })
      .returning()

    // Create order item with the variant
    await db.insert(orderItems).values({
      orderId: order!.id,
      dishId: testDishId,
      quantity: 1,
      priceAtOrder: 1200,
      variantId: usedVariantId,
    })
  })

  test("Manager can delete unused variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    const result = await caller.dishes.deleteVariant({
      variantId: unusedVariantId,
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("deleted successfully")

    // Verify deletion
    const variant = await db.query.dishVariants.findFirst({
      where: (dishVariants, { eq }) => eq(dishVariants.id, unusedVariantId),
    })
    expect(variant).toBeUndefined()
  })

  test("Cannot delete variant used in orders", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    await expect(
      caller.dishes.deleteVariant({
        variantId: usedVariantId,
      })
    ).rejects.toThrow("Cannot delete variant that is used in orders")
  })

  test("Cannot delete non-existent variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "manager-1" },
      role: "manager",
    } as Context)

    await expect(
      caller.dishes.deleteVariant({
        variantId: 99999,
      })
    ).rejects.toThrow("Variant ID 99999 does not exist")
  })

  test("Non-manager cannot delete variant", async () => {
    const caller = appRouter.createCaller({
      ...mockContext,
      user: { id: "waiter-1" },
      role: "waiter",
    } as Context)

    await expect(
      caller.dishes.deleteVariant({
        variantId: unusedVariantId,
      })
    ).rejects.toThrow()
  })
})

/**
 * T069-RED: Test for dishes.listVariants
 * TDD Red Phase: This test should FAIL before implementation
 * Contract: Get all variants for dish, ordered by displayOrder
 */
describe("Dishes Router - dishes.listVariants (T069)", () => {
  let testDishId: number

  beforeAll(async () => {
    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Dish for List Variants",
        description: "Test dish",
        price: 1000,
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    testDishId = dish!.id

    // Create multiple variants with different display orders
    await db.insert(dishVariants).values([
      {
        dishId: testDishId,
        name: "Large",
        price: 1600,
        displayOrder: 2,
      },
      {
        dishId: testDishId,
        name: "Small",
        price: 800,
        displayOrder: 0,
      },
      {
        dishId: testDishId,
        name: "Medium",
        price: 1200,
        displayOrder: 1,
      },
    ])
  })

  test("Public can list variants ordered by displayOrder", async () => {
    const caller = appRouter.createCaller(mockContext)

    const result = await caller.dishes.listVariants({
      dishId: testDishId,
    })

    expect(result.variants).toBeDefined()
    expect(result.variants.length).toBe(3)

    // Check ordering by displayOrder
    expect(result.variants[0]?.name).toBe("Small") // displayOrder: 0
    expect(result.variants[1]?.name).toBe("Medium") // displayOrder: 1
    expect(result.variants[2]?.name).toBe("Large") // displayOrder: 2

    // Check price values
    expect(result.variants[0]?.price).toBe(800)
    expect(result.variants[1]?.price).toBe(1200)
    expect(result.variants[2]?.price).toBe(1600)
  })

  test("Returns empty array for dish with no variants", async () => {
    const caller = appRouter.createCaller(mockContext)

    // Create dish without variants
    const [dishNoVariants] = await db
      .insert(dishes)
      .values({
        name: "Dish Without Variants",
        description: "No variants",
        price: 500,
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    const result = await caller.dishes.listVariants({
      dishId: dishNoVariants!.id,
    })

    expect(result.variants).toBeDefined()
    expect(result.variants.length).toBe(0)
  })

  test("Throws error for non-existent dish", async () => {
    const caller = appRouter.createCaller(mockContext)

    await expect(
      caller.dishes.listVariants({
        dishId: 99999,
      })
    ).rejects.toThrow("Dish ID 99999 does not exist")
  })
})

/**
 * T070-RED: Test extending dishes.getDishDetails with variants
 * Note: Implementation already done in T019, just verifying it works
 */
describe("Dishes Router - dishes.getDishDetails with variants (T070)", () => {
  let testDishId: number

  beforeAll(async () => {
    // Create test ingredient
    const [ingredient] = await db
      .insert(ingredients)
      .values({
        name: "Test Ingredient for Variant Details",
        unit: "kg",
        quantity: 50,
        minQuantity: 10,
        costPerUnit: 300,
      })
      .returning()

    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Test Dish with Variants Details",
        description: "Test dish",
        price: 1000,
        photoUrl: null,
        isAvailable: true,
      })
      .returning()

    testDishId = dish!.id

    // Create recipe
    await db.insert(recipes).values({
      dishId: testDishId,
      ingredientId: ingredient!.id,
      quantityRequired: 2,
    })

    // Create variants
    await db.insert(dishVariants).values([
      {
        dishId: testDishId,
        name: "Small",
        price: 700,
        displayOrder: 0,
      },
      {
        dishId: testDishId,
        name: "Large",
        price: 1300,
        displayOrder: 1,
      },
    ])
  })

  test("getDishDetails includes variants array", async () => {
    const caller = appRouter.createCaller(mockContext)

    const result = await caller.dishes.getById({
      dishId: testDishId,
    })

    expect(result).toBeDefined()
    expect(result.variants).toBeDefined()
    expect(result.variants.length).toBe(2)

    // Check variant details
    expect(result.variants[0]?.name).toBe("Small")
    expect(result.variants[0]?.price).toBe(700)
    expect(result.variants[1]?.name).toBe("Large")
    expect(result.variants[1]?.price).toBe(1300)

    // Verify ordering by displayOrder
    expect(result.variants[0]?.displayOrder).toBe(0)
    expect(result.variants[1]?.displayOrder).toBe(1)
  })
})

/**
 * T081-T083: Backend tests for User Story 4 - Temporary Item Hiding
 * Contract: Phase 6 implementation
 */
describe("Dishes Router - Item Hiding (T081-T083)", () => {
  let testDishId: number
  let hiddenTestDishId: number

  beforeAll(async () => {
    // Create test dishes for hiding feature
    const visibleDish = await db
      .insert(dishes)
      .values({
        name: "Visible Test Dish",
        description: "This dish should be visible",
        price: 2000,
        isAvailable: true,
        isHidden: false,
      })
      .returning()
    testDishId = visibleDish[0]!.id

    const hiddenDish = await db
      .insert(dishes)
      .values({
        name: "Hidden Test Dish",
        description: "This dish should be hidden",
        price: 2500,
        isAvailable: true,
        isHidden: true,
      })
      .returning()
    hiddenTestDishId = hiddenDish[0]!.id
  })

  describe("T082: dishes.getAll with hidden dish filtering", () => {
    test("should exclude hidden dishes by default", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.dishes.getAll({})

      expect(result).toBeDefined()
      expect(result.dishes).toBeDefined()

      const visibleDish = result.dishes.find((d) => d.id === testDishId)
      const hiddenDish = result.dishes.find((d) => d.id === hiddenTestDishId)

      expect(visibleDish).toBeDefined()
      expect(hiddenDish).toBeUndefined()
    })

    test("should include hidden dishes when includeHidden=true", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.dishes.getAll({ includeHidden: true })

      expect(result).toBeDefined()
      expect(result.dishes).toBeDefined()

      const visibleDish = result.dishes.find((d) => d.id === testDishId)
      const hiddenDish = result.dishes.find((d) => d.id === hiddenTestDishId)

      expect(visibleDish).toBeDefined()
      expect(hiddenDish).toBeDefined()
    })

    test("should return isHidden flag in dish data", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.dishes.getAll({ includeHidden: true })

      const hiddenDish = result.dishes.find((d) => d.id === hiddenTestDishId)
      expect(hiddenDish?.isHidden).toBe(true)

      const visibleDish = result.dishes.find((d) => d.id === testDishId)
      expect(visibleDish?.isHidden).toBe(false)
    })
  })

  describe("T081: dishes.update with isHidden field", () => {
    test("should update isHidden field to true", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.update({
        dishId: testDishId,
        isHidden: true,
      })

      expect(result).toBeDefined()
      expect(result.updatedFields).toContain("isHidden")

      // Verify in database
      const updatedDish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, testDishId),
      })
      expect(updatedDish?.isHidden).toBe(true)
    })

    test("should update isHidden field to false", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.update({
        dishId: hiddenTestDishId,
        isHidden: false,
      })

      expect(result).toBeDefined()
      expect(result.updatedFields).toContain("isHidden")

      // Verify in database
      const updatedDish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, hiddenTestDishId),
      })
      expect(updatedDish?.isHidden).toBe(false)
    })

    test("should not allow non-manager to update isHidden", async () => {
      const caller = appRouter.createCaller(mockContext)

      await expect(
        caller.dishes.update({
          dishId: testDishId,
          isHidden: true,
        })
      ).rejects.toThrow()
    })
  })

  describe("T083: dishes.toggleVisibility procedure", () => {
    test("should toggle isHidden from false to true", async () => {
      // First, ensure dish is visible
      await db.update(dishes).set({ isHidden: false }).where(eq(dishes.id, testDishId))

      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result).toBeDefined()
      expect(result.isHidden).toBe(true)

      // Verify in database
      const updatedDish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, testDishId),
      })
      expect(updatedDish?.isHidden).toBe(true)
    })

    test("should toggle isHidden from true to false", async () => {
      // First, ensure dish is hidden
      await db.update(dishes).set({ isHidden: true }).where(eq(dishes.id, testDishId))

      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result).toBeDefined()
      expect(result.isHidden).toBe(false)

      // Verify in database
      const updatedDish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, testDishId),
      })
      expect(updatedDish?.isHidden).toBe(false)
    })

    test("should return updated dish data with toggle", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result).toBeDefined()
      expect(result.id).toBe(testDishId)
      expect(result.name).toBeDefined()
      expect(result.description).toBeDefined()
      expect(result.price).toBeDefined()
    })

    test("should throw error for non-existent dish", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.dishes.toggleVisibility({
          dishId: 99999,
        })
      ).rejects.toThrow()
    })

    test("should not allow non-manager to toggle visibility", async () => {
      const caller = appRouter.createCaller(mockContext)

      await expect(
        caller.dishes.toggleVisibility({
          dishId: testDishId,
        })
      ).rejects.toThrow()
    })
  })
})
