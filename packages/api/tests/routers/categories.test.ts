import { beforeAll, describe, expect, test } from "bun:test"
import { categories, db, dishes, dishCategories, eq } from "@learn-bettert/db"

import type { Context } from "../../src/context"
import { appRouter } from "../../src/routers/index"
import { mockWsNotifier } from "../setup"

/**
 * T015: Contract test for categories router
 * Contract: contracts/categories-router.md
 * TDD Red Phase: These tests should FAIL before implementation
 * Following TDD approach per Constitution § I
 */

// Mock context for testing (public user - no auth)
const mockPublicContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

// Mock context for manager user
const mockManagerContext: Context = {
  session: { id: "test-session", userId: "manager-user-id" } as any,
  user: { id: "manager-user-id", email: "manager@test.com", name: "Test Manager" } as any,
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Categories Router - categories.list", () => {
  let testCategoryId: number
  let hiddenCategoryId: number
  let testDishId: number

  beforeAll(async () => {
    // Clean up any existing test data
    const existingCategory = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.name, "Test Appetizers"),
    })

    if (existingCategory) {
      testCategoryId = existingCategory.id
    } else {
      // Create test category (visible)
      const [category] = await db
        .insert(categories)
        .values({
          name: "Test Appetizers",
          displayOrder: 1,
          iconUrl: "https://example.com/icon.png",
          isHidden: false,
        })
        .returning()
      testCategoryId = category.id
    }

    // Create hidden category
    const existingHidden = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.name, "Test Hidden Category"),
    })

    if (existingHidden) {
      hiddenCategoryId = existingHidden.id
    } else {
      const [hidden] = await db
        .insert(categories)
        .values({
          name: "Test Hidden Category",
          displayOrder: 2,
          isHidden: true,
        })
        .returning()
      hiddenCategoryId = hidden.id
    }

    // Create a test dish and assign it to the test category
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Test Category Dish"),
    })

    if (existingDish) {
      testDishId = existingDish.id
    } else {
      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Test Category Dish",
          description: "A dish for category testing",
          price: 1000,
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id
    }

    // Assign dish to category
    const existingAssignment = await db.query.dishCategories.findFirst({
      where: (dishCategories, { and, eq }) =>
        and(eq(dishCategories.dishId, testDishId), eq(dishCategories.categoryId, testCategoryId)),
    })

    if (!existingAssignment) {
      await db.insert(dishCategories).values({
        dishId: testDishId,
        categoryId: testCategoryId,
      })
    }
  })

  test("should return all categories when visibleOnly is false", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    const result = await caller.categories.list({ visibleOnly: false })

    expect(result).toBeDefined()
    expect(result).toBeArray()
    expect(result.length).toBeGreaterThanOrEqual(2) // At least our 2 test categories

    const visibleCategory = result.find((c) => c.id === testCategoryId)
    expect(visibleCategory).toBeDefined()
    expect(visibleCategory?.name).toBe("Test Appetizers")
    expect(visibleCategory?.isHidden).toBe(false)

    const hiddenCategory = result.find((c) => c.id === hiddenCategoryId)
    expect(hiddenCategory).toBeDefined()
    expect(hiddenCategory?.isHidden).toBe(true)
  })

  test("should return only visible categories when visibleOnly is true", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    const result = await caller.categories.list({ visibleOnly: true })

    expect(result).toBeDefined()
    expect(result).toBeArray()

    const visibleCategory = result.find((c) => c.id === testCategoryId)
    expect(visibleCategory).toBeDefined()

    const hiddenCategory = result.find((c) => c.id === hiddenCategoryId)
    expect(hiddenCategory).toBeUndefined()
  })

  test("should return categories ordered by displayOrder", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    const result = await caller.categories.list({ visibleOnly: false })

    // Check that categories are ordered by displayOrder
    for (let i = 1; i < result.length; i++) {
      expect(result[i].displayOrder).toBeGreaterThanOrEqual(result[i - 1].displayOrder)
    }
  })

  test("should include dishCount for each category", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    const result = await caller.categories.list({ visibleOnly: false })

    const testCategory = result.find((c) => c.id === testCategoryId)
    expect(testCategory).toBeDefined()
    expect(testCategory?.dishCount).toBeDefined()
    expect(testCategory?.dishCount).toBeGreaterThanOrEqual(1) // At least our test dish
  })
})

describe("Categories Router - categories.create", () => {
  test("should allow manager to create a category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.create({
      name: "Test Desserts",
      displayOrder: 10,
      iconUrl: "https://example.com/desserts.png",
    })

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.name).toBe("Test Desserts")
    expect(result.displayOrder).toBe(10)
    expect(result.iconUrl).toBe("https://example.com/desserts.png")
    expect(result.isHidden).toBe(false)
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.create({
        name: "Unauthorized Category",
        displayOrder: 5,
      })
    ).rejects.toThrow()
  })

  test("should use default displayOrder of 0 if not provided", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.create({
      name: "Test Default Order",
    })

    expect(result.displayOrder).toBe(0)
  })
})

describe("Categories Router - categories.update", () => {
  let updateTestCategoryId: number

  beforeAll(async () => {
    // Create a category for update tests
    const [category] = await db
      .insert(categories)
      .values({
        name: "Update Test Category",
        displayOrder: 5,
        isHidden: false,
      })
      .returning()
    updateTestCategoryId = category.id
  })

  test("should allow manager to update category fields", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.update({
      id: updateTestCategoryId,
      name: "Updated Category Name",
      displayOrder: 15,
    })

    expect(result).toBeDefined()
    expect(result.name).toBe("Updated Category Name")
    expect(result.displayOrder).toBe(15)
    expect(result.updatedAt).toBeDefined()
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.update({
        id: updateTestCategoryId,
        name: "Unauthorized Update",
      })
    ).rejects.toThrow()
  })

  test("should return NOT_FOUND for non-existent category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    await expect(
      caller.categories.update({
        id: 999999,
        name: "Non-existent",
      })
    ).rejects.toThrow()
  })

  test("should allow partial updates", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    // Get current state
    const before = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.id, updateTestCategoryId),
    })

    // Update only iconUrl
    const result = await caller.categories.update({
      id: updateTestCategoryId,
      iconUrl: "https://example.com/new-icon.png",
    })

    expect(result.name).toBe(before?.name) // Name should not change
    expect(result.iconUrl).toBe("https://example.com/new-icon.png")
  })
})

describe("Categories Router - categories.toggleVisibility", () => {
  let toggleTestCategoryId: number

  beforeAll(async () => {
    const [category] = await db
      .insert(categories)
      .values({
        name: "Toggle Test Category",
        displayOrder: 7,
        isHidden: false,
      })
      .returning()
    toggleTestCategoryId = category.id
  })

  test("should allow manager to hide a category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.toggleVisibility({
      id: toggleTestCategoryId,
      isHidden: true,
    })

    expect(result).toBeDefined()
    expect(result.isHidden).toBe(true)
  })

  test("should allow manager to show a hidden category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    // First hide it
    await caller.categories.toggleVisibility({
      id: toggleTestCategoryId,
      isHidden: true,
    })

    // Then show it
    const result = await caller.categories.toggleVisibility({
      id: toggleTestCategoryId,
      isHidden: false,
    })

    expect(result.isHidden).toBe(false)
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.toggleVisibility({
        id: toggleTestCategoryId,
        isHidden: true,
      })
    ).rejects.toThrow()
  })
})

describe("Categories Router - categories.listDishes", () => {
  let listDishesCategory: number
  let assignedDishId: number

  beforeAll(async () => {
    // Create category and dish for this test
    const [category] = await db
      .insert(categories)
      .values({
        name: "List Dishes Test Category",
        displayOrder: 8,
      })
      .returning()
    listDishesCategory = category.id

    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Assigned Test Dish",
        description: "For listDishes test",
        price: 1500,
        isAvailable: true,
        isHidden: false,
      })
      .returning()
    assignedDishId = dish.id

    // Assign dish to category
    await db.insert(dishCategories).values({
      dishId: assignedDishId,
      categoryId: listDishesCategory,
    })
  })

  test("should return dishes in a category", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    const result = await caller.categories.listDishes({
      categoryId: listDishesCategory,
    })

    expect(result).toBeDefined()
    expect(result).toBeArray()
    expect(result.length).toBeGreaterThanOrEqual(1)

    const dish = result.find((d) => d.id === assignedDishId)
    expect(dish).toBeDefined()
    expect(dish?.name).toBe("Assigned Test Dish")
  })

  test("should exclude hidden dishes by default", async () => {
    // Create a hidden dish and assign it
    const [hiddenDish] = await db
      .insert(dishes)
      .values({
        name: "Hidden Test Dish",
        description: "Should not appear",
        price: 1000,
        isAvailable: true,
        isHidden: true,
      })
      .returning()

    await db.insert(dishCategories).values({
      dishId: hiddenDish.id,
      categoryId: listDishesCategory,
    })

    const caller = appRouter.createCaller(mockPublicContext)
    const result = await caller.categories.listDishes({
      categoryId: listDishesCategory,
      includeHidden: false,
    })

    const foundHidden = result.find((d) => d.id === hiddenDish.id)
    expect(foundHidden).toBeUndefined()
  })

  test("should include hidden dishes when includeHidden is true", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.listDishes({
      categoryId: listDishesCategory,
      includeHidden: true,
    })

    // Should have both visible and hidden dishes
    const hiddenDish = result.find((d) => d.name === "Hidden Test Dish")
    expect(hiddenDish).toBeDefined()
  })
})

describe("Categories Router - categories.assignDishes", () => {
  let assignCategory: number
  let dish1Id: number
  let dish2Id: number

  beforeAll(async () => {
    // Create category and dishes for assignment tests
    const [category] = await db
      .insert(categories)
      .values({
        name: "Assign Test Category",
        displayOrder: 9,
      })
      .returning()
    assignCategory = category.id

    const [d1] = await db
      .insert(dishes)
      .values({
        name: "Assign Test Dish 1",
        description: "First dish",
        price: 1000,
        isAvailable: true,
      })
      .returning()
    dish1Id = d1.id

    const [d2] = await db
      .insert(dishes)
      .values({
        name: "Assign Test Dish 2",
        description: "Second dish",
        price: 1200,
        isAvailable: true,
      })
      .returning()
    dish2Id = d2.id
  })

  test("should allow manager to assign dishes to category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.assignDishes({
      categoryId: assignCategory,
      dishIds: [dish1Id, dish2Id],
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.assignedCount).toBe(2)

    // Verify assignment in database
    const assignments = await db.query.dishCategories.findMany({
      where: (dishCategories, { eq }) => eq(dishCategories.categoryId, assignCategory),
    })
    expect(assignments.length).toBeGreaterThanOrEqual(2)
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.assignDishes({
        categoryId: assignCategory,
        dishIds: [dish1Id],
      })
    ).rejects.toThrow()
  })

  test("should handle duplicate assignments gracefully (idempotent)", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    // First assignment
    await caller.categories.assignDishes({
      categoryId: assignCategory,
      dishIds: [dish1Id],
    })

    // Second assignment of same dish - should not error
    const result = await caller.categories.assignDishes({
      categoryId: assignCategory,
      dishIds: [dish1Id],
    })

    expect(result.success).toBe(true)
  })

  test("should return NOT_FOUND for non-existent category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    await expect(
      caller.categories.assignDishes({
        categoryId: 999999,
        dishIds: [dish1Id],
      })
    ).rejects.toThrow()
  })
})

describe("Categories Router - categories.removeDishes", () => {
  let removeCategory: number
  let removeDish1Id: number
  let removeDish2Id: number

  beforeAll(async () => {
    // Create category and dishes, then assign them
    const [category] = await db
      .insert(categories)
      .values({
        name: "Remove Test Category",
        displayOrder: 10,
      })
      .returning()
    removeCategory = category.id

    const [d1] = await db
      .insert(dishes)
      .values({
        name: "Remove Test Dish 1",
        description: "First dish to remove",
        price: 1000,
        isAvailable: true,
      })
      .returning()
    removeDish1Id = d1.id

    const [d2] = await db
      .insert(dishes)
      .values({
        name: "Remove Test Dish 2",
        description: "Second dish to remove",
        price: 1200,
        isAvailable: true,
      })
      .returning()
    removeDish2Id = d2.id

    // Assign dishes
    await db.insert(dishCategories).values([
      { dishId: removeDish1Id, categoryId: removeCategory },
      { dishId: removeDish2Id, categoryId: removeCategory },
    ])
  })

  test("should allow manager to remove dishes from category", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    // First, ensure the dish is assigned (in case a previous test removed it)
    try {
      await db.insert(dishCategories).values({
        dishId: removeDish1Id,
        categoryId: removeCategory,
      })
    } catch (error) {
      // Ignore if already exists
    }

    const result = await caller.categories.removeDishes({
      categoryId: removeCategory,
      dishIds: [removeDish1Id],
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.removedCount).toBeGreaterThan(0)

    // Verify removal in database
    const assignment = await db.query.dishCategories.findFirst({
      where: (dishCategories, { and, eq }) =>
        and(
          eq(dishCategories.dishId, removeDish1Id),
          eq(dishCategories.categoryId, removeCategory)
        ),
    })
    expect(assignment).toBeUndefined()
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.removeDishes({
        categoryId: removeCategory,
        dishIds: [removeDish2Id],
      })
    ).rejects.toThrow()
  })
})

describe("Categories Router - categories.reorder", () => {
  let reorderCategory1: number
  let reorderCategory2: number
  let reorderCategory3: number

  beforeAll(async () => {
    // Create 3 categories for reordering tests
    const [c1] = await db
      .insert(categories)
      .values({
        name: "Reorder Test Category 1",
        displayOrder: 100,
      })
      .returning()
    reorderCategory1 = c1.id

    const [c2] = await db
      .insert(categories)
      .values({
        name: "Reorder Test Category 2",
        displayOrder: 101,
      })
      .returning()
    reorderCategory2 = c2.id

    const [c3] = await db
      .insert(categories)
      .values({
        name: "Reorder Test Category 3",
        displayOrder: 102,
      })
      .returning()
    reorderCategory3 = c3.id
  })

  test("should allow manager to batch update display order", async () => {
    const caller = appRouter.createCaller(mockManagerContext)

    const result = await caller.categories.reorder({
      categoryOrders: [
        { id: reorderCategory1, displayOrder: 3 },
        { id: reorderCategory2, displayOrder: 1 },
        { id: reorderCategory3, displayOrder: 2 },
      ],
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.updatedCount).toBe(3)

    // Verify order in database
    const cat2 = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.id, reorderCategory2),
    })
    expect(cat2?.displayOrder).toBe(1)
  })

  test("should reject non-manager user", async () => {
    const caller = appRouter.createCaller(mockPublicContext)

    await expect(
      caller.categories.reorder({
        categoryOrders: [{ id: reorderCategory1, displayOrder: 5 }],
      })
    ).rejects.toThrow()
  })
})
