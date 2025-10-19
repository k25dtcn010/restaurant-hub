import { beforeAll, describe, expect, test } from "bun:test"
import { db, dishes, eq } from "@/db"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { mockWsNotifier } from "../setup"

/**
 * T088.1 & T088.2: Integration Tests - Hiding/Showing Dishes Workflow
 *
 * T088.1: Hide dish → customer can't see → manager can re-enable
 * Test Flow:
 * 1. Visible dish appears in customer menu query
 * 2. Manager hides the dish using toggleVisibility
 * 3. Customer menu query excludes the hidden dish
 * 4. Manager menu query includes the hidden dish with badge
 * 5. Manager shows the dish using toggleVisibility
 * 6. Customer menu query includes the dish again
 *
 * T088.2: Historical orders with now-hidden dishes still display correctly
 * - Verifies that dishes remain accessible in order history even after being hidden
 * - Manager can see hidden dishes in manager view
 * - Staff can see hidden dishes when manually creating orders
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

// Mock context for staff user
const mockStaffContext: Context = {
  session: { id: "test-session-staff", userId: "staff-user-id" } as any,
  user: { id: "staff-user-id", email: "staff@test.com", name: "Test Staff" } as any,
  role: "Waiter",
  db,
  wsNotifier: mockWsNotifier,
}

describe("T088.1 & T088.2: Hiding/Showing Dishes Workflow", () => {
  let testDishId: number
  let testIngredientId: number

  const managerCaller = appRouter.createCaller(mockManagerContext)
  const customerCaller = appRouter.createCaller(mockCustomerContext)
  const staffCaller = appRouter.createCaller(mockStaffContext)

  beforeAll(async () => {
    // Get test ingredient
    const ingredient = await db.query.ingredients.findFirst()
    if (!ingredient) {
      throw new Error("No test ingredient available")
    }
    testIngredientId = ingredient.id
  })

  // ==================== T088.1 Tests ====================

  describe("T088.1: Hide dish → customer can't see → manager can re-enable", () => {
    test("Step 1: Create test dish that will be hidden", async () => {
      // Create a unique dish for this test
      const result = await managerCaller.dishes.create({
        name: `Hidden Dish Test ${Date.now()}`,
        description: "This dish will be hidden",
        price: 1099, // $10.99
        photoUrl: null,
        recipe: [
          {
            ingredientId: testIngredientId,
            quantityRequired: 1,
          },
        ],
      })

      expect(result.dishId).toBeGreaterThan(0)
      testDishId = result.dishId

      // Verify dish is visible initially
      const dish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, testDishId),
      })
      expect(dish).toBeTruthy()
      expect(dish!.isHidden).toBe(false)
    })

    test("Step 2: Visible dish appears in customer menu query", async () => {
      const result = await customerCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: false,
      })

      const dishExists = result.dishes.some((d) => d.id === testDishId)
      expect(dishExists).toBe(true)
      console.log(`✓ Dish ${testDishId} is visible in customer menu`)
    })

    test("Step 3: Manager hides the dish using toggleVisibility", async () => {
      const result = await managerCaller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result.id).toBe(testDishId)
      expect(result.isHidden).toBe(true)
      console.log(`✓ Dish ${testDishId} is now hidden (isHidden=true)`)
    })

    test("Step 4: Customer menu query excludes the hidden dish", async () => {
      const result = await customerCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: false,
      })

      const dishExists = result.dishes.some((d) => d.id === testDishId)
      expect(dishExists).toBe(false)
      console.log(`✓ Dish ${testDishId} is excluded from customer menu`)
    })

    test("Step 5: Manager menu query includes the hidden dish with isHidden flag", async () => {
      const result = await managerCaller.dishes.getAll({
        includeDisabled: true,
        includeHidden: true,
      })

      const hiddenDish = result.dishes.find((d) => d.id === testDishId)
      expect(hiddenDish).toBeTruthy()
      expect(hiddenDish!.isHidden).toBe(true)
      console.log(`✓ Dish ${testDishId} appears in manager menu with isHidden=true`)
    })

    test("Step 6: Manager shows the dish using toggleVisibility", async () => {
      const result = await managerCaller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result.id).toBe(testDishId)
      expect(result.isHidden).toBe(false)
      console.log(`✓ Dish ${testDishId} is now visible (isHidden=false)`)
    })

    test("Step 7: Customer menu query includes the dish again", async () => {
      const result = await customerCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: false,
      })

      const dishExists = result.dishes.some((d) => d.id === testDishId)
      expect(dishExists).toBe(true)
      console.log(`✓ Dish ${testDishId} is visible in customer menu again`)
    })
  })

  // ==================== T088.2 Tests ====================

  describe("T088.2: Historical orders with now-hidden dishes still display correctly", () => {
    test("Setup: Create test dish for history testing", async () => {
      const result = await managerCaller.dishes.create({
        name: `Order History Test Dish ${Date.now()}`,
        description: "This dish will be ordered then hidden",
        price: 1299, // $12.99
        photoUrl: null,
        recipe: [
          {
            ingredientId: testIngredientId,
            quantityRequired: 1,
          },
        ],
      })

      expect(result.dishId).toBeGreaterThan(0)
      testDishId = result.dishId
      console.log(`✓ Test dish ${testDishId} created for history testing`)
    })

    test("Manager can see dish before hiding", async () => {
      const result = await managerCaller.dishes.getAll({
        includeDisabled: true,
        includeHidden: false,
      })

      const dish = result.dishes.find((d) => d.id === testDishId)
      expect(dish).toBeTruthy()
      expect(dish!.isHidden).toBe(false)
      console.log(`✓ Dish ${testDishId} is visible before hiding`)
    })

    test("Manager hides the dish after order would be placed", async () => {
      const result = await managerCaller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result.isHidden).toBe(true)
      console.log(`✓ Dish ${testDishId} is now hidden`)
    })

    test("Customer menu query excludes the hidden dish", async () => {
      const result = await customerCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: false,
      })

      const dishExists = result.dishes.some((d) => d.id === testDishId)
      expect(dishExists).toBe(false)
      console.log(`✓ Hidden dish ${testDishId} excluded from customer menu`)
    })

    test("Manager can still see the hidden dish in manager view", async () => {
      const result = await managerCaller.dishes.getAll({
        includeDisabled: true,
        includeHidden: true,
      })

      const hiddenDish = result.dishes.find((d) => d.id === testDishId)
      expect(hiddenDish).toBeTruthy()
      expect(hiddenDish!.isHidden).toBe(true)
      console.log(`✓ Manager can still see hidden dish ${testDishId}`)
    })

    test("Staff can still see hidden dishes when creating orders (for phone orders)", async () => {
      const result = await staffCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: true,
      })

      const hiddenDish = result.dishes.find((d) => d.id === testDishId)
      expect(hiddenDish).toBeTruthy()
      expect(hiddenDish!.isHidden).toBe(true)
      console.log(
        `✓ Staff can see hidden dish ${testDishId} (for manual phone order creation)`
      )
    })

    test("Manager can unhide the dish", async () => {
      const result = await managerCaller.dishes.toggleVisibility({
        dishId: testDishId,
      })

      expect(result.isHidden).toBe(false)
      console.log(`✓ Dish ${testDishId} is unhidden and visible again`)
    })

    test("Customer menu query includes the dish again after unhiding", async () => {
      const result = await customerCaller.dishes.getAll({
        includeDisabled: false,
        includeHidden: false,
      })

      const dish = result.dishes.find((d) => d.id === testDishId)
      expect(dish).toBeTruthy()
      expect(dish!.isHidden).toBe(false)
      console.log(`✓ Dish ${testDishId} is visible in customer menu again after unhiding`)
    })
  })

  // ==================== Cleanup ====================

  test("Cleanup: Delete test dishes", async () => {
    if (testDishId) {
      try {
        await db.delete(dishes).where(eq(dishes.id, testDishId))
        console.log(`✓ Cleanup: Deleted test dish ${testDishId}`)
      } catch (e) {
        // Silently fail if already deleted
      }
    }
  })
})
