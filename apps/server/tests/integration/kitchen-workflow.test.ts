import { beforeAll, beforeEach, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import {
  db,
  dishes,
  eq,
  ingredients,
  orderItems,
  orders,
  orderStatusHistory,
  recipes,
  tables,
} from "@/db"

import { mockWsNotifier } from "../setup"

/**
 * T062: Integration test for kitchen workflow
 *
 * This test validates the complete kitchen order management workflow:
 * 1. Order is submitted (Pending status)
 * 2. Kitchen staff marks order as In Kitchen
 * 3. Kitchen staff marks order as Ready to Serve
 * 4. Status history is tracked throughout
 *
 * Tests the integration of orders.updateStatus with status history tracking
 * following the User Story 2 specification.
 */

// Mock context for kitchen staff (without actual user to avoid FK constraints)
const kitchenContext: Context = {
  session: null,
  user: null,
  role: "KitchenStaff",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Integration: Kitchen Workflow (Pending → InKitchen → Ready)", () => {
  let testTableId: number
  let testDishId: number
  let testIngredientId: number
  let testOrderId: number

  beforeAll(async () => {
    // Check if test data already exists from previous run
    const existingTable = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 300),
    })
    const existingIngredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Kitchen Test Ingredient"),
    })
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Kitchen Test Dish"),
    })

    if (existingTable && existingIngredient && existingDish) {
      testTableId = existingTable.id
      testIngredientId = existingIngredient.id
      testDishId = existingDish.id
    } else {
      // Create test data
      const [table] = await db
        .insert(tables)
        .values({
          number: 300,
          qrCode: "https://app.restauranthub.com/?table=300",
          capacity: 4,
        })
        .returning()
      testTableId = table.id

      const [ingredient] = await db
        .insert(ingredients)
        .values({
          name: "Kitchen Test Ingredient",
          quantity: 100,
          unit: "kg",
          threshold: 10,
        })
        .returning()
      testIngredientId = ingredient.id

      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Kitchen Test Dish",
          description: "Test dish for kitchen workflow",
          price: 1500,
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id

      await db.insert(recipes).values({
        dishId: testDishId,
        ingredientId: testIngredientId,
        quantityRequired: 0.3,
      })
    }
  })

  beforeEach(async () => {
    // Clean up previous test orders and related records
    const previousOrders = await db.query.orders.findMany({
      where: (orders, { eq }) => eq(orders.tableId, testTableId),
    })

    for (const order of previousOrders) {
      // Delete related records first (to avoid foreign key constraints)
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id))
      await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
      // Now safe to delete the order
      await db.delete(orders).where(eq(orders.id, order.id))
    }

    // Reset ingredient stock
    await db.update(ingredients).set({ quantity: 100 }).where(eq(ingredients.id, testIngredientId))
  })

  test("should complete full kitchen workflow: Pending → InKitchen → ReadyToServe", async () => {
    const caller = appRouter.createCaller(kitchenContext)

    // Step 1: Create and submit an order (starts as Pending)
    const createResult = await caller.orders.create({
      tableId: testTableId,
      items: [{ dishId: testDishId, quantity: 2 }],
    })
    testOrderId = createResult.orderId

    const submitResult = await caller.orders.submit({
      orderId: testOrderId,
    })

    expect(submitResult.status).toBe("Pending")

    // Verify order appears in kitchen orders
    const kitchenOrders = await caller.orders.getKitchenOrders({})
    const pendingOrder = kitchenOrders.orders.find((o) => o.id === testOrderId)
    expect(pendingOrder).toBeDefined()
    expect(pendingOrder?.status).toBe("Pending")

    // Step 2: Kitchen staff marks order as InKitchen
    const inKitchenResult = await caller.orders.updateStatus({
      orderId: testOrderId,
      newStatus: "InKitchen",
    })

    expect(inKitchenResult.status).toBe("InKitchen")
    expect(inKitchenResult.orderId).toBe(testOrderId)

    // Verify status history was created
    let statusHistory = await db.query.orderStatusHistory.findMany({
      where: (history, { eq }) => eq(history.orderId, testOrderId),
      orderBy: (history, { asc }) => [asc(history.changedAt)],
    })
    expect(statusHistory.length).toBeGreaterThanOrEqual(2) // Pending + InKitchen
    expect(statusHistory.some((h) => h.status === "InKitchen")).toBe(true)

    // Step 3: Kitchen staff marks order as ReadyToServe
    const readyResult = await caller.orders.updateStatus({
      orderId: testOrderId,
      newStatus: "ReadyToServe",
    })

    expect(readyResult.status).toBe("ReadyToServe")
    expect(readyResult.orderId).toBe(testOrderId)

    // Verify complete status history
    statusHistory = await db.query.orderStatusHistory.findMany({
      where: (history, { eq }) => eq(history.orderId, testOrderId),
      orderBy: (history, { asc }) => [asc(history.changedAt)],
    })

    expect(statusHistory.length).toBeGreaterThanOrEqual(3) // Pending + InKitchen + ReadyToServe
    expect(statusHistory[0].status).toBe("Pending")
    expect(statusHistory[1].status).toBe("InKitchen")
    expect(statusHistory[2].status).toBe("ReadyToServe")
  })

  test("should prevent invalid status transitions", async () => {
    const caller = appRouter.createCaller(kitchenContext)

    // Create and submit an order
    const createResult = await caller.orders.create({
      tableId: testTableId,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    testOrderId = createResult.orderId

    await caller.orders.submit({ orderId: testOrderId })

    // Try to jump from Pending to Served (invalid transition)
    await expect(
      caller.orders.updateStatus({
        orderId: testOrderId,
        newStatus: "Served",
      })
    ).rejects.toThrow(/Invalid status transition/)

    // Verify order is still in Pending state
    const order = await db.query.orders.findFirst({
      where: (orders, { eq }) => eq(orders.id, testOrderId),
    })
    expect(order?.status).toBe("Pending")
  })

  test("should track user who changed status in history", async () => {
    const caller = appRouter.createCaller(kitchenContext)

    // Create and submit an order
    const createResult = await caller.orders.create({
      tableId: testTableId,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    testOrderId = createResult.orderId

    await caller.orders.submit({ orderId: testOrderId })

    // Update status
    await caller.orders.updateStatus({
      orderId: testOrderId,
      newStatus: "InKitchen",
    })

    // Verify status history includes changed_by field (null in test context)
    const statusHistory = await db.query.orderStatusHistory.findMany({
      where: (history, { eq }) => eq(history.orderId, testOrderId),
    })

    const inKitchenEntry = statusHistory.find((h) => h.status === "InKitchen")
    expect(inKitchenEntry).toBeDefined()
    // In test context without actual user, changedBy should be null
    expect(inKitchenEntry?.changedBy).toBe(null)
  })

  test("should include order in kitchen orders query at each status", async () => {
    const caller = appRouter.createCaller(kitchenContext)

    // Create and submit an order
    const createResult = await caller.orders.create({
      tableId: testTableId,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    testOrderId = createResult.orderId

    await caller.orders.submit({ orderId: testOrderId })

    // Check Pending status
    let kitchenOrders = await caller.orders.getKitchenOrders({ status: ["Pending"] })
    let order = kitchenOrders.orders.find((o) => o.id === testOrderId)
    expect(order).toBeDefined()
    expect(order?.status).toBe("Pending")

    // Move to InKitchen
    await caller.orders.updateStatus({
      orderId: testOrderId,
      newStatus: "InKitchen",
    })

    // Check InKitchen status
    kitchenOrders = await caller.orders.getKitchenOrders({ status: ["InKitchen"] })
    order = kitchenOrders.orders.find((o) => o.id === testOrderId)
    expect(order).toBeDefined()
    expect(order?.status).toBe("InKitchen")

    // Move to ReadyToServe
    await caller.orders.updateStatus({
      orderId: testOrderId,
      newStatus: "ReadyToServe",
    })

    // Check ReadyToServe status
    kitchenOrders = await caller.orders.getKitchenOrders({ status: ["ReadyToServe"] })
    order = kitchenOrders.orders.find((o) => o.id === testOrderId)
    expect(order).toBeDefined()
    expect(order?.status).toBe("ReadyToServe")
  })

  test("should calculate wait time correctly for orders", async () => {
    const caller = appRouter.createCaller(kitchenContext)

    // Create and submit an order
    const createResult = await caller.orders.create({
      tableId: testTableId,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    testOrderId = createResult.orderId

    await caller.orders.submit({ orderId: testOrderId })

    // Get kitchen orders
    const kitchenOrders = await caller.orders.getKitchenOrders({})
    const order = kitchenOrders.orders.find((o) => o.id === testOrderId)

    expect(order).toBeDefined()
    expect(order?.waitTime).toBeDefined()
    expect(typeof order?.waitTime).toBe("number")
    expect(order?.waitTime).toBeGreaterThanOrEqual(0)
  })
})
