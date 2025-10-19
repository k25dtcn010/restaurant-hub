import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import {
  db,
  dishes,
  dishModifiers,
  eq,
  modifierGroups,
  modifiers,
  orderItemModifiers,
  orderItems,
  orders,
  tables,
} from "@/db"

import { mockWsNotifier } from "../setup"

/**
 * T031-T034: Tests for order modifiers integration
 * Following TDD: RED-GREEN-REFACTOR cycle
 */

const mockContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

describe("Orders Router - T031-T034: Order Modifiers Integration", () => {
  let testTableId: number
  let testDishId: number
  let testModifier1Id: number
  let testModifier2Id: number
  let testModifierGroupId: number

  beforeAll(async () => {
    // Create test table
    const existingTable = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 101),
    })

    if (existingTable) {
      testTableId = existingTable.id
    } else {
      const [table] = await db
        .insert(tables)
        .values({
          number: 101,
          qrCode: "https://app.restauranthub.com/?table=101",
          capacity: 4,
        })
        .returning()
      testTableId = table.id
    }

    // Create test dish
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Test Burger for Modifiers"),
    })

    if (existingDish) {
      testDishId = existingDish.id
    } else {
      const [dish] = await db
        .insert(dishes)
        .values({
          name: "Test Burger for Modifiers",
          description: "Test burger",
          price: 1200, // $12.00
          isAvailable: true,
        })
        .returning()
      testDishId = dish.id
    }

    // Create test modifiers
    const existingModifier1 = await db.query.modifiers.findFirst({
      where: (modifiers, { eq }) => eq(modifiers.name, "Test Extra Cheese for Orders"),
    })

    if (existingModifier1) {
      testModifier1Id = existingModifier1.id
    } else {
      const [modifier1] = await db
        .insert(modifiers)
        .values({
          name: "Test Extra Cheese for Orders",
          priceAdjustment: 200, // $2.00
          isAvailable: true,
        })
        .returning()
      testModifier1Id = modifier1.id
    }

    const existingModifier2 = await db.query.modifiers.findFirst({
      where: (modifiers, { eq }) => eq(modifiers.name, "Test Bacon for Orders"),
    })

    if (existingModifier2) {
      testModifier2Id = existingModifier2.id
    } else {
      const [modifier2] = await db
        .insert(modifiers)
        .values({
          name: "Test Bacon for Orders",
          priceAdjustment: 150, // $1.50
          isAvailable: true,
        })
        .returning()
      testModifier2Id = modifier2.id
    }

    // Create test modifier group
    const existingGroup = await db.query.modifierGroups.findFirst({
      where: (modifierGroups, { eq }) => eq(modifierGroups.name, "Test Toppings for Orders"),
    })

    if (existingGroup) {
      testModifierGroupId = existingGroup.id
    } else {
      const [group] = await db
        .insert(modifierGroups)
        .values({
          name: "Test Toppings for Orders",
          minSelections: 0,
          maxSelections: 3,
          displayOrder: 0,
        })
        .returning()
      testModifierGroupId = group.id
    }

    // Assign modifiers to dish
    const existingAssignment1 = await db.query.dishModifiers.findFirst({
      where: (dishModifiers, { and, eq }) =>
        and(eq(dishModifiers.dishId, testDishId), eq(dishModifiers.modifierId, testModifier1Id)),
    })

    if (!existingAssignment1) {
      await db.insert(dishModifiers).values({
        dishId: testDishId,
        modifierId: testModifier1Id,
        modifierGroupId: testModifierGroupId,
      })
    }

    const existingAssignment2 = await db.query.dishModifiers.findFirst({
      where: (dishModifiers, { and, eq }) =>
        and(eq(dishModifiers.dishId, testDishId), eq(dishModifiers.modifierId, testModifier2Id)),
    })

    if (!existingAssignment2) {
      await db.insert(dishModifiers).values({
        dishId: testDishId,
        modifierId: testModifier2Id,
        modifierGroupId: testModifierGroupId,
      })
    }
  })

  afterAll(async () => {
    // Clean up test orders and order items
    const testOrders = await db.query.orders.findMany({
      where: (orders, { eq }) => eq(orders.tableId, testTableId),
    })

    for (const order of testOrders) {
      // Delete order item modifiers first
      const items = await db.query.orderItems.findMany({
        where: (orderItems, { eq }) => eq(orderItems.orderId, order.id),
      })

      for (const item of items) {
        await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
      }

      // Delete order items
      await db.delete(orderItems).where(eq(orderItems.orderId, order.id))

      // Delete orders
      await db.delete(orders).where(eq(orders.id, order.id))
    }
  })

  describe("T031: Accept modifiers in orders.create", () => {
    afterAll(async () => {
      // Clean up pending orders after this test group
      const pendingOrders = await db.query.orders.findMany({
        where: (orders, { and, eq }) =>
          and(eq(orders.tableId, testTableId), eq(orders.status, "Pending")),
      })

      for (const order of pendingOrders) {
        const items = await db.query.orderItems.findMany({
          where: (orderItems, { eq }) => eq(orderItems.orderId, order.id),
        })

        for (const item of items) {
          await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
        await db.delete(orders).where(eq(orders.id, order.id))
      }
    })

    test("T031-1: Should accept order with modifiers in input", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      expect(result).toBeDefined()
      expect(result.orderId).toBeNumber()
      expect(result.isNew).toBe(true)
    })

    test("T031-2: Should validate modifiers belong to dish", async () => {
      const caller = appRouter.createCaller(mockContext)

      // Create a modifier not assigned to the dish
      const [unassignedModifier] = await db
        .insert(modifiers)
        .values({
          name: "Test Unassigned Modifier",
          priceAdjustment: 100,
          isAvailable: true,
        })
        .returning()

      await expect(async () => {
        await caller.orders.create({
          tableId: testTableId,
          items: [
            {
              dishId: testDishId,
              quantity: 1,
              modifiers: [
                {
                  modifierId: unassignedModifier.id,
                  modifierGroupId: testModifierGroupId,
                },
              ],
            },
          ],
        })
      }).toThrow(/not available for this dish/)

      // Clean up
      await db.delete(modifiers).where(eq(modifiers.id, unassignedModifier.id))
    })
  })

  describe("T032: Calculate modifier prices in order total", () => {
    let createdOrderIds: number[] = []

    afterEach(async () => {
      // Clean up orders created in this test
      for (const orderId of createdOrderIds) {
        const items = await db.query.orderItems.findMany({
          where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
        })

        for (const item of items) {
          await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, orderId))
        await db.delete(orders).where(eq(orders.id, orderId))
      }

      createdOrderIds = []
    })

    test("T032-1: Should include modifier prices in total amount", async () => {
      const caller = appRouter.createCaller(mockContext)

      // Dish: $12.00, Extra Cheese: $2.00, Bacon: $1.50
      // Total: $15.50
      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier1Id, // +$2.00
                modifierGroupId: testModifierGroupId,
              },
              {
                modifierId: testModifier2Id, // +$1.50
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      createdOrderIds.push(result.orderId)
      expect(result.totalAmount).toBe(1550) // $15.50 in cents
    })

    test("T032-2: Should calculate correct total with multiple items and modifiers", async () => {
      const caller = appRouter.createCaller(mockContext)

      // Item 1: Burger ($12.00) + Extra Cheese ($2.00) = $14.00
      // Item 2: Burger ($12.00) + Bacon ($1.50) = $13.50
      // Total: $27.50
      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier2Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      createdOrderIds.push(result.orderId)
      expect(result.totalAmount).toBe(2750) // $27.50 in cents
    })

    test("T032-3: Should handle quantity multiplier with modifiers", async () => {
      const caller = appRouter.createCaller(mockContext)

      // 2x Burger ($12.00 + $2.00) = 2x $14.00 = $28.00
      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 2,
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      createdOrderIds.push(result.orderId)
      expect(result.totalAmount).toBe(2800) // $28.00 in cents
    })
  })

  describe("T033: Store modifiers in orderItemModifiers table", () => {
    let createdOrderIds: number[] = []

    afterEach(async () => {
      // Clean up orders created in this test
      for (const orderId of createdOrderIds) {
        const items = await db.query.orderItems.findMany({
          where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
        })

        for (const item of items) {
          await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, orderId))
        await db.delete(orders).where(eq(orders.id, orderId))
      }

      createdOrderIds = []
    })

    test("T033-1: Should insert modifiers with historical snapshot", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      createdOrderIds.push(result.orderId)

      // Get the created order item
      const orderItem = await db.query.orderItems.findFirst({
        where: (orderItems, { eq }) => eq(orderItems.orderId, result.orderId),
      })

      expect(orderItem).toBeDefined()

      // Check orderItemModifiers table
      const savedModifiers = await db.query.orderItemModifiers.findMany({
        where: (orderItemModifiers, { eq }) => eq(orderItemModifiers.orderItemId, orderItem!.id),
      })

      expect(savedModifiers.length).toBe(1)
      expect(savedModifiers[0].modifierId).toBe(testModifier1Id)
      expect(savedModifiers[0].name).toBe("Test Extra Cheese for Orders")
      expect(savedModifiers[0].priceAtOrder).toBe(200) // Historical price snapshot
    })

    test("T033-2: Should store all selected modifiers", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
              {
                modifierId: testModifier2Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      createdOrderIds.push(result.orderId)

      const orderItem = await db.query.orderItems.findFirst({
        where: (orderItems, { eq }) => eq(orderItems.orderId, result.orderId),
      })

      const savedModifiers = await db.query.orderItemModifiers.findMany({
        where: (orderItemModifiers, { eq }) => eq(orderItemModifiers.orderItemId, orderItem!.id),
      })

      expect(savedModifiers.length).toBe(2)
      expect(savedModifiers.map((m) => m.modifierId).sort()).toEqual(
        [testModifier1Id, testModifier2Id].sort()
      )
    })
  })

  describe("T034: Include modifiers in orders.getById response", () => {
    let testOrderId: number

    beforeAll(async () => {
      // Clean up any pending orders first to ensure a fresh order
      const pendingOrders = await db.query.orders.findMany({
        where: (orders, { and, eq }) =>
          and(eq(orders.tableId, testTableId), eq(orders.status, "Pending")),
      })

      for (const order of pendingOrders) {
        const items = await db.query.orderItems.findMany({
          where: (orderItems, { eq }) => eq(orderItems.orderId, order.id),
        })

        for (const item of items) {
          await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
        await db.delete(orders).where(eq(orders.id, order.id))
      }

      // Create an order with modifiers for testing
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
            specialRequest: "No pickles please",
            modifiers: [
              {
                modifierId: testModifier1Id,
                modifierGroupId: testModifierGroupId,
              },
              {
                modifierId: testModifier2Id,
                modifierGroupId: testModifierGroupId,
              },
            ],
          },
        ],
      })

      testOrderId = result.orderId
    })

    test("T034-1: Should include modifiers array in order item response", async () => {
      const caller = appRouter.createCaller(mockContext)

      const order = await caller.orders.getById({
        orderId: testOrderId,
      })

      expect(order).toBeDefined()
      expect(order.items).toBeArray()
      expect(order.items.length).toBeGreaterThan(0)

      const item = order.items[0]
      expect(item.modifiers).toBeDefined()
      expect(item.modifiers).toBeArray()
      expect(item.modifiers!.length).toBe(2)

      // Check modifier details
      const modifierNames = item.modifiers!.map((m) => m.name).sort()
      expect(modifierNames).toEqual(["Test Bacon for Orders", "Test Extra Cheese for Orders"])

      const modifierPrices = item.modifiers!.map((m) => m.priceAtOrder).sort()
      expect(modifierPrices).toEqual([150, 200])
    })

    test("T034-2: Should include specialRequest field in response", async () => {
      const caller = appRouter.createCaller(mockContext)

      const order = await caller.orders.getById({
        orderId: testOrderId,
      })

      const item = order.items[0]
      expect(item.specialRequest).toBe("No pickles please")
    })

    test("T034-3: Should return empty modifiers array for items without modifiers", async () => {
      const caller = appRouter.createCaller(mockContext)

      // Clean up pending orders first
      const pendingOrders = await db.query.orders.findMany({
        where: (orders, { and, eq }) =>
          and(eq(orders.tableId, testTableId), eq(orders.status, "Pending")),
      })

      for (const order of pendingOrders) {
        const items = await db.query.orderItems.findMany({
          where: (orderItems, { eq }) => eq(orderItems.orderId, order.id),
        })

        for (const item of items) {
          await db.delete(orderItemModifiers).where(eq(orderItemModifiers.orderItemId, item.id))
        }

        await db.delete(orderItems).where(eq(orderItems.orderId, order.id))
        await db.delete(orders).where(eq(orders.id, order.id))
      }

      // Create an order without modifiers
      const result = await caller.orders.create({
        tableId: testTableId,
        items: [
          {
            dishId: testDishId,
            quantity: 1,
          },
        ],
      })

      const order = await caller.orders.getById({
        orderId: result.orderId,
      })

      const item = order.items[0]
      expect(item.modifiers).toBeDefined()
      expect(item.modifiers).toBeArray()
      expect(item.modifiers!.length).toBe(0)
    })
  })
})
