import { beforeAll, describe, expect, test } from "bun:test"
import { categories, db, dishes, dishCategories, eq } from "@learn-bettert/db"

import type { Context } from "../../src/context"
import { appRouter } from "../../src/routers/index"
import { mockWsNotifier } from "../setup"

/**
 * T065.1: Integration Test - Category Workflow End-to-End
 * 
 * Test Flow:
 * 1. Manager creates "Appetizers" category
 * 2. Manager creates "Spring Rolls" dish
 * 3. Manager assigns "Spring Rolls" to "Appetizers" category
 * 4. Customer views menu and sees "Spring Rolls" in "Appetizers" category
 * 5. Customer filters menu by "Appetizers" and sees "Spring Rolls"
 * 6. Customer filters by another category and doesn't see "Spring Rolls"
 * 
 * Following TDD approach per Constitution § I
 */

// Mock context for manager user
const mockManagerContext: Context = {
  session: { id: "test-session", userId: "manager-user-id" } as any,
  user: { id: "manager-user-id", email: "manager@test.com", name: "Test Manager" } as any,
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Mock context for public/customer user
const mockCustomerContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

describe("T065.1: Category Workflow Integration Test", () => {
  let appetizersCategoryId: number
  let otherCategoryId: number
  let springRollsDishId: number
  const caller = appRouter.createCaller(mockManagerContext)
  const customerCaller = appRouter.createCaller(mockCustomerContext)

  test("Step 1: Manager creates 'Appetizers' category", async () => {
    // Clean up first
    const existing = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.name, "Integration Test Appetizers"),
    })

    if (existing) {
      await db.delete(categories).where(eq(categories.id, existing.id))
    }

    // Create category
    const result = await caller.categories.create({
      name: "Integration Test Appetizers",
      displayOrder: 1,
      iconUrl: null, // Use null instead of emoji since API expects URL
    })

    expect(result.name).toBe("Integration Test Appetizers")
    expect(result.displayOrder).toBe(1)
    expect(result.isHidden).toBe(false)

    appetizersCategoryId = result.id
  })

  test("Step 1b: Manager creates another category for filtering test", async () => {
    // Create another category
    const result = await caller.categories.create({
      name: "Integration Test Main Course",
      displayOrder: 2,
      iconUrl: null,
    })
    
    expect(result.name).toBe("Integration Test Main Course")
    otherCategoryId = result.id
  })

  test("Step 2: Manager creates 'Spring Rolls' dish", async () => {
    // Clean up first
    const existing = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Integration Test Spring Rolls"),
    })

    if (existing) {
      await db.delete(dishes).where(eq(dishes.id, existing.id))
    }

    // Create dish with test recipe (we need at least one ingredient)
    const ingredient = await db.query.ingredients.findFirst()

    if (!ingredient) {
      throw new Error("No test ingredient available")
    }

    const result = await caller.dishes.create({
      name: "Integration Test Spring Rolls",
      description: "Crispy vegetable spring rolls",
      price: 895, // $8.95
      photoUrl: null,
      recipe: [
        {
          ingredientId: ingredient.id,
          quantityRequired: 1,
        },
      ],
      isRecommended: false,
      isChefSpecial: false,
      orderPriority: 0,
    })

    expect(result.dishId).toBeGreaterThan(0)
    springRollsDishId = result.dishId
  })

  test("Step 3: Manager assigns 'Spring Rolls' to 'Appetizers' category", async () => {
    // Assign dish to category
    const result = await caller.categories.assignDishes({
      categoryId: appetizersCategoryId,
      dishIds: [springRollsDishId],
    })

    expect(result.success).toBe(true)
    expect(result.assignedCount).toBe(1)

    // Verify assignment in database
    const assignment = await db.query.dishCategories.findFirst({
      where: (dishCategories, { and, eq }) =>
        and(
          eq(dishCategories.categoryId, appetizersCategoryId),
          eq(dishCategories.dishId, springRollsDishId)
        ),
    })

    expect(assignment).toBeTruthy()
  })

  test("Step 4: Customer views categories and sees 'Appetizers' with dish count", async () => {
    const result = await customerCaller.categories.list({
      visibleOnly: true,
    })

    // Find our test category
    const appetizersCategory = result.find((c: any) => c.id === appetizersCategoryId)

    expect(appetizersCategory).toBeTruthy()
    expect(appetizersCategory.name).toBe("Integration Test Appetizers")
    expect(appetizersCategory.dishCount).toBeGreaterThanOrEqual(1)
    expect(appetizersCategory.isHidden).toBe(false)
  })

  test("Step 5: Customer lists dishes in 'Appetizers' and sees 'Spring Rolls'", async () => {
    const result = await customerCaller.categories.listDishes({
      categoryId: appetizersCategoryId,
    })

    // Check that Spring Rolls is in the list
    const springRolls = result.find((d: any) => d.dishId === springRollsDishId)

    expect(springRolls).toBeTruthy()
    expect(springRolls.dishName).toBe("Integration Test Spring Rolls")
  })

  test("Step 6: Customer lists dishes in other category and doesn't see 'Spring Rolls'", async () => {
    const result = await customerCaller.categories.listDishes({
      categoryId: otherCategoryId,
    })

    // Spring Rolls should NOT be in Main Course category
    const springRolls = result.find((d: any) => d.dishId === springRollsDishId)

    expect(springRolls).toBeUndefined()
  })

  test("Step 7: Manager can toggle category visibility and customer sees the change", async () => {
    // Hide the category
    await caller.categories.toggleVisibility({
      id: appetizersCategoryId,
      isHidden: true,
    })

    // Customer should not see hidden category
    const visibleCategories = await customerCaller.categories.list({
      visibleOnly: true,
    })

    const hiddenCategory = visibleCategories.find((c: any) => c.id === appetizersCategoryId)
    expect(hiddenCategory).toBeUndefined()

    // Show it again
    await caller.categories.toggleVisibility({
      id: appetizersCategoryId,
      isHidden: false,
    })

    // Customer should see it now
    const visibleCategories2 = await customerCaller.categories.list({
      visibleOnly: true,
    })

    const visibleCategory = visibleCategories2.find((c: any) => c.id === appetizersCategoryId)
    expect(visibleCategory).toBeTruthy()
  })
})
