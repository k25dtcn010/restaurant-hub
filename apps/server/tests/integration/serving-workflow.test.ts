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
 * T088: Integration test for complete serving workflow
 *
 * This test validates the complete User Story 4 serving workflow:
 * 1. Orders are created and progress to ReadyToServe status
 * 2. Serving staff can view orders ready for delivery via getServingOrders
 * 3. Orders are prioritized by wait time (oldest first)
 * 4. Serving staff can mark orders as Served and Completed
 * 5. Full status history is tracked with timestamps
 *
 * Acceptance: spec.md User Story 4 - All 5 scenarios
 */

// Mock contexts for different roles
const customerContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

const kitchenContext: Context = {
  session: null,
  user: null,
  role: "KitchenStaff",
  db,
  wsNotifier: mockWsNotifier,
}

const waiterContext: Context = {
  session: null,
  user: null,
  role: "Waiter",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Integration: Complete Serving Workflow (T088)", () => {
  let testTableId1: number
  let testTableId2: number
  let testDishId: number
  let testIngredientId: number

  beforeAll(async () => {
    // Check if test data already exists
    const existingTable1 = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 500),
    })
    const existingTable2 = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 501),
    })
    const existingIngredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Serving Workflow Test Ingredient"),
    })
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Serving Workflow Test Dish"),
    })

    if (existingTable1 && existingTable2 && existingIngredient && existingDish) {
      testTableId1 = existingTable1.id
      testTableId2 = existingTable2.id
      testIngredientId = existingIngredient.id
      testDishId = existingDish.id
    } else {
      // Create test tables
      const [table1] = await db
        .insert(tables)
        .values({
          number: 500,
          qrCode: "https://app.restauranthub.com/?table=500",
          capacity: 4,
        })
        .returning()
      testTableId1 = table1.id

      const [table2] = await db
        .insert(tables)
        .values({
          number: 501,
          qrCode: "https://app.restauranthub.com/?table=501",
          capacity: 6,
        })
        .returning()
      testTableId2 = table2.id

      // Create test ingredient
      const [ingredient] = await db
        .insert(ingredients)
        .values({
          name: "Serving Workflow Test Ingredient",
          quantity: 200,
          unit: "kg",
          threshold: 20,
        })
        .returning()
      testIngredientId = ingredient.id

      // Create test dish
      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Serving Workflow Test Dish",
          description: "Test dish for serving workflow",
          price: 2500,
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id

      // Create recipe
      await db.insert(recipes).values({
        dishId: testDishId,
        ingredientId: testIngredientId,
        quantityRequired: 0.6,
      })
    }
  })

  beforeEach(async () => {
    // Clean up previous test orders for both tables
    const previousOrders = await db.query.orders.findMany({
      where: (orders, { or, eq }) =>
        or(eq(orders.tableId, testTableId1), eq(orders.tableId, testTableId2)),
    })

    for (const order of previousOrders) {
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id))
      await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
      await db.delete(orders).where(eq(orders.id, order.id))
    }

    // Reset ingredient stock
    await db.update(ingredients).set({ quantity: 200 }).where(eq(ingredients.id, testIngredientId))
  })

  test("US4 Scenario 1: Waiter sees notification when dish is marked ReadyToServe", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Customer creates and submits order
    const createResult = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 2 }],
    })

    await customerCaller.orders.submit({ orderId: createResult.orderId })

    // Kitchen processes order
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "InKitchen",
    })

    // Kitchen marks order as ReadyToServe
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "ReadyToServe",
    })

    // Waiter checks their dashboard using getServingOrders
    const servingOrders = await waiterCaller.orders.getServingOrders({})

    // Verify waiter can see the order
    expect(servingOrders.orders).toBeDefined()
    const readyOrder = servingOrders.orders.find((o) => o.id === createResult.orderId)

    expect(readyOrder).toBeDefined()
    expect(readyOrder?.tableNumber).toBe(500)
    expect(readyOrder?.status).toBe("ReadyToServe")
    expect(readyOrder?.items).toBeDefined()
    expect(readyOrder?.items[0].dishName).toBe("Serving Workflow Test Dish")
    expect(readyOrder?.items[0].quantity).toBe(2)
  })

  test("US4 Scenario 2: Waiter marks order as Served and timestamp is recorded", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Create order and move to ReadyToServe
    const createResult = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 1 }],
    })

    await customerCaller.orders.submit({ orderId: createResult.orderId })
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "InKitchen",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "ReadyToServe",
    })

    // Waiter delivers food and marks as Served
    const beforeServed = Date.now()

    const servedResult = await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Served",
    })

    const afterServed = Date.now()

    // Verify status update
    expect(servedResult.status).toBe("Served")
    expect(servedResult.orderId).toBe(createResult.orderId)
    expect(servedResult.updatedAt).toBeDefined()

    // Verify timestamp is recorded in status history
    const statusHistory = await db.query.orderStatusHistory.findFirst({
      where: (history, { and, eq }) =>
        and(eq(history.orderId, createResult.orderId), eq(history.status, "Served")),
    })

    expect(statusHistory).toBeDefined()
    const servedTimestamp = new Date(statusHistory!.changedAt).getTime()
    // Database stores timestamps with second precision, so allow 1 second tolerance
    expect(servedTimestamp).toBeGreaterThanOrEqual(beforeServed - 1000)
    expect(servedTimestamp).toBeLessThanOrEqual(afterServed + 1000)
  })

  test("US4 Scenario 3: Orders are prioritized by wait time (oldest first)", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Create first order
    const order1Result = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    await customerCaller.orders.submit({ orderId: order1Result.orderId })
    await kitchenCaller.orders.updateStatus({
      orderId: order1Result.orderId,
      newStatus: "InKitchen",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: order1Result.orderId,
      newStatus: "ReadyToServe",
    })

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Create second order
    const order2Result = await customerCaller.orders.create({
      tableId: testTableId2,
      items: [{ dishId: testDishId, quantity: 1 }],
    })
    await customerCaller.orders.submit({ orderId: order2Result.orderId })
    await kitchenCaller.orders.updateStatus({
      orderId: order2Result.orderId,
      newStatus: "InKitchen",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: order2Result.orderId,
      newStatus: "ReadyToServe",
    })

    // Waiter checks serving queue
    const servingOrders = await waiterCaller.orders.getServingOrders({})

    // Verify orders are sorted by wait time (oldest first = highest waitTime)
    expect(servingOrders.orders.length).toBeGreaterThanOrEqual(2)

    const order1InQueue = servingOrders.orders.find((o) => o.id === order1Result.orderId)
    const order2InQueue = servingOrders.orders.find((o) => o.id === order2Result.orderId)

    expect(order1InQueue).toBeDefined()
    expect(order2InQueue).toBeDefined()

    // Order 1 should have higher wait time (older)
    expect(order1InQueue!.waitTime).toBeGreaterThanOrEqual(order2InQueue!.waitTime)

    // Verify sorting: first order in array should have highest waitTime
    if (servingOrders.orders.length > 1) {
      for (let i = 0; i < servingOrders.orders.length - 1; i++) {
        expect(servingOrders.orders[i].waitTime).toBeGreaterThanOrEqual(
          servingOrders.orders[i + 1].waitTime
        )
      }
    }
  })

  test("US4 Scenario 4: Waiter marks order as Completed after serving", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Create order and move through workflow to Served
    const createResult = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 1 }],
    })

    await customerCaller.orders.submit({ orderId: createResult.orderId })
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "InKitchen",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "ReadyToServe",
    })
    await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Served",
    })

    // Customer finishes eating, waiter marks as Completed
    const completedResult = await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Completed",
    })

    expect(completedResult.status).toBe("Completed")
    expect(completedResult.orderId).toBe(createResult.orderId)

    // Verify order is in completed history but still accessible
    const order = await db.query.orders.findFirst({
      where: (orders, { eq }) => eq(orders.id, createResult.orderId),
    })

    expect(order).toBeDefined()
    expect(order?.status).toBe("Completed")

    // Order should no longer appear in serving queue (only ReadyToServe and Served)
    const servingOrders = await waiterCaller.orders.getServingOrders({})
    const completedInQueue = servingOrders.orders.find((o) => o.id === createResult.orderId)
    expect(completedInQueue).toBeUndefined()
  })

  test("US4 Scenario 5: Full status history is tracked with timestamps", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Create order
    const createResult = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 1 }],
    })

    // Submit - Pending
    await customerCaller.orders.submit({ orderId: createResult.orderId })

    // InKitchen
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "InKitchen",
    })

    // ReadyToServe
    await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "ReadyToServe",
    })

    // Served
    await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Served",
    })

    // Completed
    await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Completed",
    })

    // Get order details with full status history
    const orderDetails = await waiterCaller.orders.getById({
      orderId: createResult.orderId,
    })

    // Verify full status history
    expect(orderDetails.statusHistory).toBeDefined()
    expect(orderDetails.statusHistory.length).toBeGreaterThanOrEqual(5)

    // Expected statuses in order
    const expectedStatuses = ["Pending", "InKitchen", "ReadyToServe", "Served", "Completed"]

    // Verify each status is present in history
    for (const expectedStatus of expectedStatuses) {
      const historyEntry = orderDetails.statusHistory.find((h) => h.status === expectedStatus)
      expect(historyEntry).toBeDefined()
      expect(historyEntry?.changedAt).toBeDefined()
      expect(historyEntry?.changedAt).toBeInstanceOf(Date)
    }

    // Verify timestamps are in chronological order
    for (let i = 0; i < orderDetails.statusHistory.length - 1; i++) {
      const current = new Date(orderDetails.statusHistory[i].changedAt).getTime()
      const next = new Date(orderDetails.statusHistory[i + 1].changedAt).getTime()
      expect(current).toBeLessThanOrEqual(next)
    }
  })

  test("Complete serving workflow integration: from order creation to completion", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Step 1: Customer creates and submits order
    const createResult = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 2, specialInstructions: "No salt" }],
    })

    const submitResult = await customerCaller.orders.submit({
      orderId: createResult.orderId,
    })
    expect(submitResult.status).toBe("Pending")

    // Step 2: Kitchen starts preparing
    const inKitchenResult = await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "InKitchen",
    })
    expect(inKitchenResult.status).toBe("InKitchen")

    // Step 3: Kitchen marks as ready
    const readyResult = await kitchenCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "ReadyToServe",
    })
    expect(readyResult.status).toBe("ReadyToServe")

    // Step 4: Waiter sees order in serving queue
    const servingQueue = await waiterCaller.orders.getServingOrders({
      status: ["ReadyToServe"],
    })

    const orderInQueue = servingQueue.orders.find((o) => o.id === createResult.orderId)
    expect(orderInQueue).toBeDefined()
    expect(orderInQueue?.tableNumber).toBe(500)
    expect(orderInQueue?.readySince).toBeDefined()
    expect(orderInQueue?.waitTime).toBeGreaterThanOrEqual(0)

    // Step 5: Waiter delivers and marks as served
    const servedResult = await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Served",
    })
    expect(servedResult.status).toBe("Served")

    // Step 6: Customer finishes, waiter marks as completed
    const completedResult = await waiterCaller.orders.updateStatus({
      orderId: createResult.orderId,
      newStatus: "Completed",
    })
    expect(completedResult.status).toBe("Completed")

    // Step 7: Verify complete status history
    const finalOrder = await waiterCaller.orders.getById({
      orderId: createResult.orderId,
    })

    expect(finalOrder.status).toBe("Completed")
    expect(finalOrder.statusHistory.length).toBeGreaterThanOrEqual(5)

    // Verify all expected statuses are present
    const statuses = finalOrder.statusHistory.map((h) => h.status)
    expect(statuses).toContain("Pending")
    expect(statuses).toContain("InKitchen")
    expect(statuses).toContain("ReadyToServe")
    expect(statuses).toContain("Served")
    expect(statuses).toContain("Completed")

    // Verify order is accessible for payment processing
    expect(finalOrder.totalAmount).toBeGreaterThan(0)
    expect(finalOrder.items.length).toBe(1)
  })

  test("Multiple tables can be in serving workflow simultaneously", async () => {
    const customerCaller = appRouter.createCaller(customerContext)
    const kitchenCaller = appRouter.createCaller(kitchenContext)
    const waiterCaller = appRouter.createCaller(waiterContext)

    // Create orders for two different tables
    const table1Order = await customerCaller.orders.create({
      tableId: testTableId1,
      items: [{ dishId: testDishId, quantity: 1 }],
    })

    const table2Order = await customerCaller.orders.create({
      tableId: testTableId2,
      items: [{ dishId: testDishId, quantity: 2 }],
    })

    // Submit both orders
    await customerCaller.orders.submit({ orderId: table1Order.orderId })
    await customerCaller.orders.submit({ orderId: table2Order.orderId })

    // Kitchen processes both
    await kitchenCaller.orders.updateStatus({
      orderId: table1Order.orderId,
      newStatus: "InKitchen",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: table2Order.orderId,
      newStatus: "InKitchen",
    })

    // Both become ready
    await kitchenCaller.orders.updateStatus({
      orderId: table1Order.orderId,
      newStatus: "ReadyToServe",
    })
    await kitchenCaller.orders.updateStatus({
      orderId: table2Order.orderId,
      newStatus: "ReadyToServe",
    })

    // Waiter sees both in serving queue
    const servingQueue = await waiterCaller.orders.getServingOrders({})

    const table1InQueue = servingQueue.orders.find((o) => o.tableNumber === 500)
    const table2InQueue = servingQueue.orders.find((o) => o.tableNumber === 501)

    expect(table1InQueue).toBeDefined()
    expect(table2InQueue).toBeDefined()

    // Waiter serves table 1 first
    await waiterCaller.orders.updateStatus({
      orderId: table1Order.orderId,
      newStatus: "Served",
    })

    // Table 2 should still be in ReadyToServe
    const updatedQueue = await waiterCaller.orders.getServingOrders({
      status: ["ReadyToServe"],
    })

    const table2StillReady = updatedQueue.orders.find((o) => o.tableNumber === 501)
    expect(table2StillReady).toBeDefined()
    expect(table2StillReady?.status).toBe("ReadyToServe")
  })
})
