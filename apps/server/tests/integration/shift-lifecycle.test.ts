import { beforeAll, describe, expect, test } from "bun:test"
import { db, dishes, eq, ingredients, orderItems, orders, payments, recipes, shiftStaff, shifts, tables, user } from "@/db"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { mockWsNotifier } from "../setup"

/**
 * T132.1: Integration test - Shift lifecycle end-to-end
 * 
 * This test validates the complete shift management workflow:
 * 1. Manager starts a shift with staff assignments
 * 2. Orders are created during the shift (auto-tagged with shift ID)
 * 3. Manager ends the shift
 * 4. Summary is calculated correctly (order count, revenue)
 * 
 * Tests the integration between shifts and orders routers following
 * User Story 6 specification.
 */

// Manager context for shift management
const managerContext: Context = {
  session: { userId: "shift-manager-1" },
  user: { id: "shift-manager-1", email: "shift-manager@test.com", name: "Shift Manager" },
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Staff context for order creation
const staffContext: Context = {
  session: { userId: "shift-staff-1" },
  user: { id: "shift-staff-1", email: "shift-staff@test.com", name: "Shift Staff" },
  role: "Waiter",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Integration: Shift Lifecycle End-to-End (T132.1)", () => {
  let testTableId: number
  let testTable2Id: number
  let testDishId: number
  let testIngredientId: number
  let testShiftId: number
  let testOrderIds: number[] = []

  beforeAll(async () => {
    // Create test users if they don't exist
    try {
      await db.insert(user).values([
        {
          id: "shift-manager-1",
          email: "shift-manager@test.com",
          name: "Shift Manager",
          emailVerified: false,
          role: "Manager",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "shift-staff-1",
          email: "shift-staff@test.com",
          name: "Shift Staff",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "shift-staff-2",
          email: "shift-staff2@test.com",
          name: "Shift Staff 2",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    } catch (e) {
      // Users might already exist
    }

    // Check if test data exists
    const existingTable = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 500),
    })
    const existingTable2 = await db.query.tables.findFirst({
      where: (tables, { eq }) => eq(tables.number, 501),
    })
    const existingIngredient = await db.query.ingredients.findFirst({
      where: (ingredients, { eq }) => eq(ingredients.name, "Shift Test Ingredient"),
    })
    const existingDish = await db.query.dishes.findFirst({
      where: (dishes, { eq }) => eq(dishes.name, "Shift Test Dish"),
    })

    if (existingTable && existingTable2 && existingIngredient && existingDish) {
      testTableId = existingTable.id
      testTable2Id = existingTable2.id
      testIngredientId = existingIngredient.id
      testDishId = existingDish.id
    } else {
      // Create test data - use onConflictDoNothing or try-catch for tables
      if (!existingTable) {
        try {
          const [table] = await db
            .insert(tables)
            .values({
              number: 500,
              qrCode: "https://app.restauranthub.com/?table=500",
              capacity: 4,
            })
            .returning()
          testTableId = table.id
        } catch (e) {
          // Table might exist, query it
          const table = await db.query.tables.findFirst({
            where: (tables, { eq }) => eq(tables.number, 500),
          })
          testTableId = table!.id
        }
      } else {
        testTableId = existingTable.id
      }

      if (!existingTable2) {
        try {
          const [table2] = await db
            .insert(tables)
            .values({
              number: 501,
              qrCode: "https://app.restauranthub.com/?table=501",
              capacity: 4,
            })
            .returning()
          testTable2Id = table2.id
        } catch (e) {
          // Table might exist, query it
          const table2 = await db.query.tables.findFirst({
            where: (tables, { eq }) => eq(tables.number, 501),
          })
          testTable2Id = table2!.id
        }
      } else {
        testTable2Id = existingTable2.id
      }

      if (!existingIngredient) {
        const [ingredient] = await db
          .insert(ingredients)
          .values({
            name: "Shift Test Ingredient",
            quantity: 100,
            unit: "kg",
            threshold: 10,
          })
          .onConflictDoNothing()
          .returning()
        testIngredientId = ingredient?.id || (await db.query.ingredients.findFirst({
          where: (ingredients, { eq }) => eq(ingredients.name, "Shift Test Ingredient"),
        }))!.id
      } else {
        testIngredientId = existingIngredient.id
      }

      if (!existingDish) {
        const [dish] = await db
          .insert(dishes)
          .values({
            name: "Shift Test Dish",
            description: "Test dish for shift integration",
            price: 1500, // $15.00
            photoUrl: null,
            isAvailable: true,
          })
          .onConflictDoNothing()
          .returning()
        testDishId = dish?.id || (await db.query.dishes.findFirst({
          where: (dishes, { eq }) => eq(dishes.name, "Shift Test Dish"),
        }))!.id

        // Create recipe if dish was just created
        if (dish) {
          await db.insert(recipes).values({
            dishId: testDishId,
            ingredientId: testIngredientId,
            quantityRequired: 0.5,
          }).onConflictDoNothing()
        }
      } else {
        testDishId = existingDish.id
      }
    }
  })

  test("Step 1: Manager starts a shift with staff assignments", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.start({
      shiftType: "Lunch",
      staffIds: ["shift-staff-1", "shift-staff-2"],
      notes: "Test shift for integration testing",
    })

    testShiftId = result.id

    // Verify shift was created correctly
    expect(result.id).toBeGreaterThan(0)
    expect(result.shiftType).toBe("Lunch")
    expect(result.startTime).toBeInstanceOf(Date)
    expect(result.endTime).toBeNull()
    expect(result.totalOrders).toBeNull()
    expect(result.totalRevenue).toBeNull()
    expect(result.staff).toHaveLength(2)
    expect(result.staff.map(s => s.id)).toContain("shift-staff-1")
    expect(result.staff.map(s => s.id)).toContain("shift-staff-2")
  })

  test("Step 2: Orders created during shift are auto-tagged with shift ID", async () => {
    const caller = appRouter.createCaller(staffContext)

    // Create first order on table 1
    const order1Result = await caller.orders.create({
      tableId: testTableId,
      items: [
        {
          dishId: testDishId,
          quantity: 2,
          specialRequest: "Extra sauce",
        },
      ],
    })

    testOrderIds.push(order1Result.orderId)

    // Submit first order
    await caller.orders.submit({ orderId: order1Result.orderId })

    // Verify first order was tagged with shift ID
    const order1Data = await db.query.orders.findFirst({
      where: eq(orders.id, order1Result.orderId),
    })

    expect(order1Data).toBeDefined()
    expect(order1Data!.shiftId).toBe(testShiftId)

    // Create second order on table 2 (different table = separate order)
    const order2Result = await caller.orders.create({
      tableId: testTable2Id,
      items: [
        {
          dishId: testDishId,
          quantity: 1,
        },
      ],
    })

    testOrderIds.push(order2Result.orderId)

    // Submit second order
    await caller.orders.submit({ orderId: order2Result.orderId })

    // Verify second order was also tagged
    const order2Data = await db.query.orders.findFirst({
      where: eq(orders.id, order2Result.orderId),
    })

    expect(order2Data).toBeDefined()
    expect(order2Data!.shiftId).toBe(testShiftId)

    // Verify we have 2 distinct orders
    expect(testOrderIds[0]).not.toBe(testOrderIds[1])
  })

  test("Step 3: Active shift shows correct order count", async () => {
    const caller = appRouter.createCaller(managerContext)

    const activeShifts = await caller.shifts.listActive()
    const currentShift = activeShifts.find(s => s.id === testShiftId)

    expect(currentShift).toBeDefined()
    expect(currentShift!.currentOrderCount).toBe(2)
    expect(currentShift!.duration).toBeGreaterThanOrEqual(0)
  })

  test("Step 4: Submit orders and complete the workflow (for revenue calculation)", async () => {
    const managerCaller = appRouter.createCaller(managerContext)

    // Complete orders through the full workflow so they can be paid
    for (const orderId of testOrderIds) {
      // Go through status workflow: Pending → InKitchen → ReadyToServe → Served → Completed → Paid
      await managerCaller.orders.updateStatus({ orderId, newStatus: "InKitchen" })
      await managerCaller.orders.updateStatus({ orderId, newStatus: "ReadyToServe" })
      await managerCaller.orders.updateStatus({ orderId, newStatus: "Served" })
      await managerCaller.orders.updateStatus({ orderId, newStatus: "Completed" })
      
      // Get order total amount for payment
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      })
      
      // Process payment
      await managerCaller.payments.create({
        orderId,
        amount: order!.totalAmount,
        method: "Cash",
      })
    }

    // Verify orders are paid
    for (const orderId of testOrderIds) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      })
      expect(order!.status).toBe("Paid")
    }
  })

  test("Step 5: Manager ends shift and summary is calculated correctly", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.end({
      id: testShiftId,
      notes: "Shift ended - integration test complete",
    })

    // Verify shift was ended
    expect(result.id).toBe(testShiftId)
    expect(result.shiftType).toBe("Lunch")
    expect(result.endTime).toBeInstanceOf(Date)
    expect(result.startTime).toBeInstanceOf(Date)

    // Verify summary is correct
    expect(result.totalOrders).toBe(2) // We created 2 orders
    
    // Calculate expected revenue: 2 orders of (2 items * $15) + 1 order of (1 item * $15) = $60 + $15 = $75 = 7500 cents
    const expectedRevenue = (2 * 1500) + (1 * 1500) // 3000 + 1500 = 4500 cents = $45
    expect(result.totalRevenue).toBe(expectedRevenue)

    // Verify staff is included
    expect(result.staff).toHaveLength(2)
    expect(result.staff.map(s => s.id)).toContain("shift-staff-1")
    expect(result.staff.map(s => s.id)).toContain("shift-staff-2")
  })

  test("Step 6: Ended shift appears in history", async () => {
    const caller = appRouter.createCaller(managerContext)

    const history = await caller.shifts.listHistory({})
    const endedShift = history.find(s => s.id === testShiftId)

    expect(endedShift).toBeDefined()
    expect(endedShift!.shiftType).toBe("Lunch")
    expect(endedShift!.totalOrders).toBe(2)
    expect(endedShift!.totalRevenue).toBe(4500)
    expect(endedShift!.staff).toHaveLength(2)
  })

  test("Step 7: Cannot end already ended shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.end({
        id: testShiftId,
      })
    ).rejects.toThrow(/already ended/)
  })

  test("Cleanup: Remove test shift and orders", async () => {
    // Clean up payments
    for (const orderId of testOrderIds) {
      await db.delete(payments).where(eq(payments.orderId, orderId))
    }
    
    // Clean up orders
    for (const orderId of testOrderIds) {
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId))
      await db.delete(orders).where(eq(orders.id, orderId))
    }

    // Clean up shift
    await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, testShiftId))
    await db.delete(shifts).where(eq(shifts.id, testShiftId))

    // Verify cleanup
    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, testShiftId),
    })
    expect(shift).toBeUndefined()
  })
})

describe("Integration: Staff Management Mid-Shift (T132.2)", () => {
  let testShiftId: number

  beforeAll(async () => {
    // Ensure test users exist
    try {
      await db.insert(user).values([
        {
          id: "staff-mgmt-manager-1",
          email: "staff-mgmt-manager@test.com",
          name: "Staff Mgmt Manager",
          emailVerified: false,
          role: "Manager",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "staff-mgmt-staff-1",
          email: "staff-mgmt-staff1@test.com",
          name: "Staff Mgmt Staff 1",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "staff-mgmt-staff-2",
          email: "staff-mgmt-staff2@test.com",
          name: "Staff Mgmt Staff 2",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "staff-mgmt-staff-3",
          email: "staff-mgmt-staff3@test.com",
          name: "Staff Mgmt Staff 3",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    } catch (e) {
      // Users might already exist
    }
  })

  const staffMgmtManagerContext: Context = {
    session: { userId: "staff-mgmt-manager-1" },
    user: { id: "staff-mgmt-manager-1", email: "staff-mgmt-manager@test.com", name: "Staff Mgmt Manager" },
    role: "Manager",
    db,
    wsNotifier: mockWsNotifier,
  }

  test("Step 1: Start shift with initial staff", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const result = await caller.shifts.start({
      shiftType: "Dinner",
      staffIds: ["staff-mgmt-staff-1"],
      notes: "Testing staff management",
    })

    testShiftId = result.id

    expect(result.staff).toHaveLength(1)
    expect(result.staff[0].id).toBe("staff-mgmt-staff-1")
  })

  test("Step 2: Add additional staff to active shift", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const result = await caller.shifts.addStaff({
      shiftId: testShiftId,
      staffIds: ["staff-mgmt-staff-2", "staff-mgmt-staff-3"],
    })

    expect(result.success).toBe(true)
    expect(result.addedCount).toBeGreaterThanOrEqual(2)
  })

  test("Step 3: Verify staff were added correctly", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const activeShifts = await caller.shifts.listActive()
    const currentShift = activeShifts.find(s => s.id === testShiftId)

    expect(currentShift).toBeDefined()
    expect(currentShift!.staff).toHaveLength(3)
    
    const staffIds = currentShift!.staff.map(s => s.id)
    expect(staffIds).toContain("staff-mgmt-staff-1")
    expect(staffIds).toContain("staff-mgmt-staff-2")
    expect(staffIds).toContain("staff-mgmt-staff-3")
  })

  test("Step 4: Remove staff from active shift", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const result = await caller.shifts.removeStaff({
      shiftId: testShiftId,
      staffIds: ["staff-mgmt-staff-2"],
    })

    expect(result.success).toBe(true)
    expect(result.removedCount).toBe(1)
  })

  test("Step 5: Verify staff was removed correctly", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const activeShifts = await caller.shifts.listActive()
    const currentShift = activeShifts.find(s => s.id === testShiftId)

    expect(currentShift).toBeDefined()
    expect(currentShift!.staff).toHaveLength(2)
    
    const staffIds = currentShift!.staff.map(s => s.id)
    expect(staffIds).toContain("staff-mgmt-staff-1")
    expect(staffIds).toContain("staff-mgmt-staff-3")
    expect(staffIds).not.toContain("staff-mgmt-staff-2") // This one was removed
  })

  test("Step 6: Adding duplicate staff is idempotent", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    // Try to add staff-1 again (already exists)
    const result = await caller.shifts.addStaff({
      shiftId: testShiftId,
      staffIds: ["staff-mgmt-staff-1"],
    })

    expect(result.success).toBe(true)
    // Should not increase count since already exists
    
    const activeShifts = await caller.shifts.listActive()
    const currentShift = activeShifts.find(s => s.id === testShiftId)
    expect(currentShift!.staff).toHaveLength(2) // Still 2, not 3
  })

  test("Step 7: End shift with final staff list", async () => {
    const caller = appRouter.createCaller(staffMgmtManagerContext)

    const result = await caller.shifts.end({
      id: testShiftId,
    })

    expect(result.staff).toHaveLength(2)
    const finalStaffIds = result.staff.map(s => s.id)
    expect(finalStaffIds).toContain("staff-mgmt-staff-1")
    expect(finalStaffIds).toContain("staff-mgmt-staff-3")
    expect(finalStaffIds).not.toContain("staff-mgmt-staff-2")
  })

  test("Cleanup: Remove test shift", async () => {
    await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, testShiftId))
    await db.delete(shifts).where(eq(shifts.id, testShiftId))

    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, testShiftId),
    })
    expect(shift).toBeUndefined()
  })
})
