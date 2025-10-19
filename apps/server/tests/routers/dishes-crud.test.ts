import { beforeAll, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { db, dishes, eq, ingredients, recipes } from "@/db"

import { mockWsNotifier } from "../setup"

/**
 * T126-T128: Contract tests for dishes CRUD operations
 * Contract: dishes-router.md Procedures 3-5
 * TDD Red Phase: These tests should validate menu management features
 */

// Mock context for Manager role
const managerContext: Context = {
  session: { userId: "manager-001" },
  user: {
    id: "manager-001",
    name: "Admin Manager",
    email: "admin@restauranthub.com",
    role: "Manager",
  },
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Mock context for non-Manager role (should fail)
const waiterContext: Context = {
  session: { userId: "waiter-001" },
  user: {
    id: "waiter-001",
    name: "Friendly Waiter",
    email: "waiter@restauranthub.com",
    role: "Waiter",
  },
  role: "Waiter",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Dishes Router - dishes.create (T126)", () => {
  let testIngredientId: number

  beforeAll(async () => {
    // Get existing ingredient for testing
    const ingredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Flour"),
    })
    if (ingredient) {
      testIngredientId = ingredient.id
    } else {
      const [newIngredient] = await db
        .insert(ingredients)
        .values({
          name: "Flour",
          quantity: 100,
          unit: "kg",
          threshold: 10,
        })
        .returning()
      testIngredientId = newIngredient.id
    }
  })

  test("should create new dish with recipe as Manager", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.dishes.create({
      name: "Test Margherita Pizza",
      description: "Classic pizza with tomato and mozzarella",
      price: 1500, // $15.00
      photoUrl: "https://example.com/pizza.jpg",
      recipe: [
        {
          ingredientId: testIngredientId,
          quantityRequired: 0.3,
        },
      ],
    })

    expect(result).toBeDefined()
    expect(result.dishId).toBeNumber()
    expect(result.name).toBe("Test Margherita Pizza")
    expect(result.price).toBe(1500)

    // Verify dish was created in database
    const dish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, result.dishId),
      with: {
        recipes: true,
      },
    })
    expect(dish).toBeDefined()
    expect(dish?.isAvailable).toBe(true)
    expect(dish?.recipes).toHaveLength(1)
  })

  test("should reject dish creation with invalid ingredient ID", async () => {
    const caller = appRouter.createCaller(managerContext)

    expect(async () => {
      await caller.dishes.create({
        name: "Invalid Dish",
        description: "Should fail",
        price: 1000,
        recipe: [
          {
            ingredientId: 999999, // Non-existent
            quantityRequired: 1,
          },
        ],
      })
    }).toThrow()
  })

  test("should reject dish creation for non-Manager users", async () => {
    const caller = appRouter.createCaller(waiterContext)

    expect(async () => {
      await caller.dishes.create({
        name: "Unauthorized Dish",
        description: "Should fail",
        price: 1000,
        recipe: [
          {
            ingredientId: testIngredientId,
            quantityRequired: 1,
          },
        ],
      })
    }).toThrow()
  })
})

describe("Dishes Router - dishes.update (T127)", () => {
  let testDishId: number
  let testIngredientId: number

  beforeAll(async () => {
    // Get test ingredient
    const ingredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Flour"),
    })
    testIngredientId = ingredient!.id

    // Create test dish
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Original Dish Name",
        description: "Original description",
        price: 1000,
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
  })

  test("should update dish details as Manager", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      name: "Updated Dish Name",
      price: 1200,
    })

    expect(result).toBeDefined()
    expect(result.dishId).toBe(testDishId)
    expect(result.updatedFields).toContain("name")
    expect(result.updatedFields).toContain("price")

    // Verify update in database
    const dish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(dish?.name).toBe("Updated Dish Name")
    expect(dish?.price).toBe(1200)
  })

  test("should update recipe when provided", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.dishes.update({
      dishId: testDishId,
      recipe: [
        {
          ingredientId: testIngredientId,
          quantityRequired: 0.8, // Changed quantity
        },
      ],
    })

    expect(result.updatedFields).toContain("recipe")

    // Verify recipe update
    const dish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
      with: {
        recipes: true,
      },
    })
    expect(dish?.recipes[0]?.quantityRequired).toBe(0.8)
  })

  test("should reject update for non-existent dish", async () => {
    const caller = appRouter.createCaller(managerContext)

    expect(async () => {
      await caller.dishes.update({
        dishId: 999999,
        name: "Should fail",
      })
    }).toThrow()
  })
})

describe("Dishes Router - dishes.toggleAvailability (T128)", () => {
  let testDishId: number

  beforeAll(async () => {
    const [dish] = await db
      .insert(dishes)
      .values({
        name: "Toggle Test Dish",
        description: "For availability testing",
        price: 1000,
        isAvailable: true,
      })
      .returning()
    testDishId = dish.id
  })

  test("should toggle dish availability as Manager", async () => {
    const caller = appRouter.createCaller(managerContext)

    // Disable dish
    const result1 = await caller.dishes.toggleAvailability({
      dishId: testDishId,
      isAvailable: false,
    })
    expect(result1.isAvailable).toBe(false)

    // Verify in database
    const dish1 = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(dish1?.isAvailable).toBe(false)

    // Enable dish
    const result2 = await caller.dishes.toggleAvailability({
      dishId: testDishId,
      isAvailable: true,
    })
    expect(result2.isAvailable).toBe(true)

    // Verify in database
    const dish2 = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, testDishId),
    })
    expect(dish2?.isAvailable).toBe(true)
  })

  test("should reject toggle for non-existent dish", async () => {
    const caller = appRouter.createCaller(managerContext)

    expect(async () => {
      await caller.dishes.toggleAvailability({
        dishId: 999999,
        isAvailable: false,
      })
    }).toThrow()
  })
})
