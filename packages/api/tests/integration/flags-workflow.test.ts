import { beforeAll, describe, expect, test } from "bun:test"
import { db, dishes, eq } from "@learn-bettert/db"

import type { Context } from "../../src/context"
import { appRouter } from "../../src/routers/index"
import { mockWsNotifier } from "../setup"

/**
 * T065.2: Integration Test - Flags Workflow End-to-End
 * 
 * Test Flow:
 * 1. Manager creates "Chef's Burger" dish with Chef's Special flag and priority 90
 * 2. Customer views menu and sees ⭐ badge on "Chef's Burger"
 * 3. Customer creates order with "Chef's Burger"
 * 4. Kitchen receives order and it appears with high priority (priority 90)
 * 5. Verify kitchen queue sorts high-priority dishes first
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

describe("T065.2: Flags Workflow Integration Test", () => {
  let chefsBurgerId: number
  let normalDishId: number
  let testTableId: number
  let highPriorityOrderId: number
  let normalOrderId: number

  const managerCaller = appRouter.createCaller(mockManagerContext)
  const customerCaller = appRouter.createCaller(mockCustomerContext)

  test("Setup: Get a test table", async () => {
    const table = await db.query.tables.findFirst()
    if (!table) {
      throw new Error("No test table available")
    }
    testTableId = table.id
  })

  test("Step 1: Manager creates 'Chef's Burger' with Chef's Special flag and priority 90", async () => {
    // Clean up first
    const existing = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Integration Test Chef's Burger"),
    })

    if (existing) {
      await db.delete(dishes).where(eq(dishes.id, existing.id))
    }

    // Get test ingredient
    const ingredient = await db.query.ingredients.findFirst()
    if (!ingredient) {
      throw new Error("No test ingredient available")
    }

    // Create dish with flags
    const result = await managerCaller.dishes.create({
      name: "Integration Test Chef's Burger",
      description: "Our signature burger",
      price: 1595, // $15.95
      photoUrl: null,
      recipe: [
        {
          ingredientId: ingredient.id,
          quantityRequired: 1,
        },
      ],
      isRecommended: true,
      isChefSpecial: true,
      orderPriority: 90,
    })

    expect(result.dishId).toBeGreaterThan(0)
    chefsBurgerId = result.dishId

    // Verify flags are set
    const dish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, chefsBurgerId),
    })

    expect(dish).toBeTruthy()
    expect(dish!.isRecommended).toBe(true)
    expect(dish!.isChefSpecial).toBe(true)
    expect(dish!.orderPriority).toBe(90)
  })

  test("Step 1b: Create a normal dish with no flags for comparison", async () => {
    // Clean up first
    const existing = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Integration Test Normal Salad"),
    })

    if (existing) {
      await db.delete(dishes).where(eq(dishes.id, existing.id))
    }

    // Get test ingredient
    const ingredient = await db.query.ingredients.findFirst()
    if (!ingredient) {
      throw new Error("No test ingredient available")
    }

    const result = await managerCaller.dishes.create({
      name: "Integration Test Normal Salad",
      description: "Simple garden salad",
      price: 795, // $7.95
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

    normalDishId = result.dishId
  })

  test("Step 2: Customer views menu and sees flags on 'Chef's Burger'", async () => {
    const result = await customerCaller.dishes.getAll({
      includeDisabled: false,
    })

    // Find Chef's Burger
    const chefsBurger = result.dishes.find((d: any) => d.id === chefsBurgerId)

    expect(chefsBurger).toBeTruthy()
    expect(chefsBurger.name).toBe("Integration Test Chef's Burger")
    expect(chefsBurger.isRecommended).toBe(true)
    expect(chefsBurger.isChefSpecial).toBe(true)
    expect(chefsBurger.orderPriority).toBe(90)

    // Normal dish should have no flags
    const normalDish = result.dishes.find((d: any) => d.id === normalDishId)
    expect(normalDish).toBeTruthy()
    expect(normalDish.isRecommended).toBe(false)
    expect(normalDish.isChefSpecial).toBe(false)
    expect(normalDish.orderPriority).toBe(0)
  })

  test("Step 3: Customer creates order with 'Chef's Burger'", async () => {
    // Create order with high-priority dish
    const orderResult = await customerCaller.orders.create({
      tableId: testTableId,
      items: [
        {
          dishId: chefsBurgerId,
          quantity: 1,
        },
      ],
    })

    expect(orderResult.orderId).toBeGreaterThan(0)
    highPriorityOrderId = orderResult.orderId

    // Submit the order
    await customerCaller.orders.submit({
      orderId: highPriorityOrderId,
    })
  })

  test("Step 3b: Create another order with normal dish", async () => {
    // Create order with normal dish
    const orderResult = await customerCaller.orders.create({
      tableId: testTableId,
      items: [
        {
          dishId: normalDishId,
          quantity: 1,
        },
      ],
    })

    normalOrderId = orderResult.orderId

    // Submit the order
    await customerCaller.orders.submit({
      orderId: normalOrderId,
    })

    // Add a small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10))
  })

  test("Step 4: Kitchen receives orders and high-priority order appears first", async () => {
    const kitchenOrders = await customerCaller.orders.getKitchenOrders({
      status: ["Pending", "InKitchen", "ReadyToServe"],
    })

    expect(kitchenOrders.orders).toBeTruthy()
    expect(kitchenOrders.orders.length).toBeGreaterThan(0)

    // Find our test orders
    const highPriorityOrder = kitchenOrders.orders.find((o: any) => o.id === highPriorityOrderId)
    const normalOrder = kitchenOrders.orders.find((o: any) => o.id === normalOrderId)

    // Both orders should be in the queue
    expect(highPriorityOrder).toBeTruthy()
    expect(normalOrder).toBeTruthy()

    // Get the indices
    const highPriorityIndex = kitchenOrders.orders.findIndex((o: any) => o.id === highPriorityOrderId)
    const normalOrderIndex = kitchenOrders.orders.findIndex((o: any) => o.id === normalOrderId)

    // High-priority order should appear before normal order
    // (lower index = appears first in the queue)
    expect(highPriorityIndex).toBeLessThan(normalOrderIndex)
  })

  test("Step 5: Verify priority sorting logic works correctly", async () => {
    const kitchenOrders = await customerCaller.orders.getKitchenOrders({
      status: ["Pending"],
    })

    // For each order, we should be able to see the priority
    // Orders should be sorted by highest priority first
    let previousPriority = 100 // Start with max
    let previousTime = 0

    for (const order of kitchenOrders.orders) {
      // Calculate max priority for this order
      let maxPriority = 0
      for (const item of order.items) {
        const dish = await db.query.dishes.findFirst({
          where: (dishes, { eq }) => eq(dishes.name, item.dishName),
        })
        if (dish && dish.orderPriority > maxPriority) {
          maxPriority = dish.orderPriority
        }
      }

      // If priority is same as previous, check time ordering
      if (maxPriority === previousPriority) {
        // Within same priority, should be ordered by creation time (oldest first)
        const currentTime = new Date(order.createdAt).getTime()
        expect(currentTime).toBeGreaterThanOrEqual(previousTime)
        previousTime = currentTime
      } else {
        // Priority should be descending (high to low)
        expect(maxPriority).toBeLessThanOrEqual(previousPriority)
        previousPriority = maxPriority
        previousTime = 0 // Reset time tracking for new priority level
      }
    }
  })

  test("Step 6: Manager can update dish priority and it affects new orders", async () => {
    // Update normal dish to have high priority
    await managerCaller.dishes.update({
      dishId: normalDishId,
      orderPriority: 95,
    })

    // Verify update
    const updatedDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, normalDishId),
    })

    expect(updatedDish!.orderPriority).toBe(95)

    // Create new order with this dish
    const newOrderResult = await customerCaller.orders.create({
      tableId: testTableId,
      items: [
        {
          dishId: normalDishId,
          quantity: 1,
        },
      ],
    })

    await customerCaller.orders.submit({
      orderId: newOrderResult.orderId,
    })

    // This new order should now have priority 95
    const dish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.id, normalDishId),
    })

    expect(dish!.orderPriority).toBe(95)
  })
})
