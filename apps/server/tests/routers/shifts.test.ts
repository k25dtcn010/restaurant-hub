import { afterAll, beforeAll, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { db, eq, shiftStaff, shifts, user } from "@/db"

import { mockWsNotifier } from "../setup"

/**
 * T114-T121: Contract tests for shifts router
 * Contract: specs/002-advanced-ops-management/contracts/shifts-router.md
 * TDD Red Phase: Tests should FAIL before implementation
 */

// Mock context for testing
const mockContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

// Manager context for protected procedures
const managerContext: Context = {
  session: { userId: "manager-test-1" },
  user: { id: "manager-test-1", email: "manager@test.com", name: "Test Manager" },
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Staff context (non-manager)
const staffContext: Context = {
  session: { userId: "staff-test-1" },
  user: { id: "staff-test-1", email: "staff@test.com", name: "Test Staff" },
  role: "Staff",
  db,
  wsNotifier: mockWsNotifier,
}

// Test user IDs for staff assignment
let testStaffIds: string[] = []

describe("Shifts Router - Setup", () => {
  beforeAll(async () => {
    // Create test users for staff assignment tests and manager
    // Note: These may already exist, so we'll try to insert and ignore conflicts
    try {
      await db.insert(user).values([
        {
          id: "manager-test-1",
          email: "manager@test.com",
          name: "Test Manager",
          emailVerified: false,
          role: "Manager",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "staff-test-1",
          email: "staff1@test.com",
          name: "Test Staff 1",
          emailVerified: false,
          role: "Waiter",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "staff-test-2",
          email: "staff2@test.com",
          name: "Test Staff 2",
          emailVerified: false,
          role: "KitchenStaff",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      testStaffIds = ["staff-test-1", "staff-test-2"]
    } catch (e) {
      // Users might already exist, that's okay
      testStaffIds = ["staff-test-1", "staff-test-2"]
    }
  })

  test("setup creates test users", () => {
    expect(testStaffIds).toHaveLength(2)
  })
})

describe("Shifts Router - T114: shifts.start", () => {
  let testShiftId: number

  afterAll(async () => {
    // Clean up test shifts
    if (testShiftId) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, testShiftId))
      await db.delete(shifts).where(eq(shifts.id, testShiftId))
    }
  })

  test("T114-RED-1: Manager can start a shift with standard type (Breakfast)", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.start({
      shiftType: "Breakfast",
      staffIds: [testStaffIds[0]],
    })

    testShiftId = result.id

    // Verify shift was created
    expect(result.id).toBeGreaterThan(0)
    expect(result.shiftType).toBe("Breakfast")
    expect(result.startTime).toBeInstanceOf(Date)
    expect(result.endTime).toBeNull()
    expect(result.totalOrders).toBeNull()
    expect(result.totalRevenue).toBeNull()
    expect(result.staff).toHaveLength(1)
    expect(result.staff[0].id).toBe(testStaffIds[0])
  })

  test("T114-RED-2: Manager can start a shift with Custom type and customTypeName", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.start({
      shiftType: "Custom",
      customTypeName: "Late Night",
      staffIds: [],
    })

    // Clean up
    await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, result.id))
    await db.delete(shifts).where(eq(shifts.id, result.id))

    expect(result.id).toBeGreaterThan(0)
    expect(result.shiftType).toBe("Late Night") // Custom name should be used
    expect(result.staff).toHaveLength(0) // No staff assigned
  })

  test("T114-RED-3: Custom shift type requires customTypeName", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.start({
        shiftType: "Custom",
        staffIds: [],
      })
    ).rejects.toThrow(/customTypeName/)
  })

  test("T114-RED-4: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(
      caller.shifts.start({
        shiftType: "Lunch",
        staffIds: [],
      })
    ).rejects.toThrow(/Manager access required/)
  })

  test("T114-RED-5: Can start shift with multiple staff members", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.start({
      shiftType: "Dinner",
      staffIds: testStaffIds,
    })

    // Clean up
    await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, result.id))
    await db.delete(shifts).where(eq(shifts.id, result.id))

    expect(result.staff).toHaveLength(2)
    const staffIds = result.staff.map((s) => s.id)
    expect(staffIds).toContain(testStaffIds[0])
    expect(staffIds).toContain(testStaffIds[1])
  })
})

describe("Shifts Router - T115: shifts.end", () => {
  let activeShiftId: number

  beforeAll(async () => {
    // Create an active shift for testing
    const caller = appRouter.createCaller(managerContext)
    const result = await caller.shifts.start({
      shiftType: "Custom",
      customTypeName: "Test Shift",
      staffIds: [],
    })
    activeShiftId = result.id
  })

  afterAll(async () => {
    // Clean up
    if (activeShiftId) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, activeShiftId))
      await db.delete(shifts).where(eq(shifts.id, activeShiftId))
    }
  })

  test("T115-RED-1: Manager can end an active shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.end({
      id: activeShiftId,
    })

    expect(result.id).toBe(activeShiftId)
    expect(result.endTime).toBeInstanceOf(Date)
    expect(result.totalOrders).toBeGreaterThanOrEqual(0)
    expect(result.totalRevenue).toBeGreaterThanOrEqual(0)
  })

  test("T115-RED-2: Cannot end already ended shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.end({
        id: activeShiftId,
      })
    ).rejects.toThrow(/already ended/)
  })

  test("T115-RED-3: Returns NOT_FOUND for non-existent shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.end({
        id: 999999,
      })
    ).rejects.toThrow(/Shift not found/)
  })

  test("T115-RED-4: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(
      caller.shifts.end({
        id: activeShiftId,
      })
    ).rejects.toThrow(/Manager access required/)
  })
})

describe("Shifts Router - T116: shifts.listActive", () => {
  let activeShiftIds: number[] = []

  beforeAll(async () => {
    // Create 2 active shifts
    const caller = appRouter.createCaller(managerContext)
    const shift1 = await caller.shifts.start({
      shiftType: "Breakfast",
      staffIds: [],
    })
    const shift2 = await caller.shifts.start({
      shiftType: "Lunch",
      staffIds: [],
    })
    activeShiftIds = [shift1.id, shift2.id]
  })

  afterAll(async () => {
    // Clean up
    for (const id of activeShiftIds) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, id))
      await db.delete(shifts).where(eq(shifts.id, id))
    }
  })

  test("T116-RED-1: Returns all active shifts", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.listActive()

    expect(result.length).toBeGreaterThanOrEqual(2)
    const resultIds = result.map((s) => s.id)
    expect(resultIds).toContain(activeShiftIds[0])
    expect(resultIds).toContain(activeShiftIds[1])
  })

  test("T116-RED-2: Each active shift has required fields", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.listActive()
    const testShift = result.find((s) => s.id === activeShiftIds[0])

    expect(testShift).toBeDefined()
    expect(testShift!.shiftType).toBeDefined()
    expect(testShift!.startTime).toBeInstanceOf(Date)
    expect(testShift!.duration).toBeGreaterThanOrEqual(0)
    expect(testShift!.currentOrderCount).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(testShift!.staff)).toBe(true)
  })

  test("T116-RED-3: Staff can access listActive", async () => {
    const caller = appRouter.createCaller(staffContext)

    const result = await caller.shifts.listActive()

    expect(Array.isArray(result)).toBe(true)
  })
})

describe("Shifts Router - T117: shifts.listHistory", () => {
  let endedShiftId: number

  beforeAll(async () => {
    // Create and end a shift for history
    const caller = appRouter.createCaller(managerContext)
    const shift = await caller.shifts.start({
      shiftType: "Dinner",
      staffIds: [],
    })
    await caller.shifts.end({ id: shift.id })
    endedShiftId = shift.id
  })

  afterAll(async () => {
    // Clean up
    if (endedShiftId) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, endedShiftId))
      await db.delete(shifts).where(eq(shifts.id, endedShiftId))
    }
  })

  test("T117-RED-1: Returns historical shifts", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.listHistory({})

    expect(Array.isArray(result)).toBe(true)
    const found = result.find((s) => s.id === endedShiftId)
    expect(found).toBeDefined()
    expect(found!.endTime).toBeInstanceOf(Date)
  })

  test("T117-RED-2: Can filter by shift type", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.listHistory({
      shiftType: "Dinner",
    })

    expect(Array.isArray(result)).toBe(true)
    // All results should be Dinner shifts
    result.forEach((shift) => {
      expect(shift.shiftType).toBe("Dinner")
    })
  })

  test("T117-RED-3: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(caller.shifts.listHistory({})).rejects.toThrow(/Manager access required/)
  })
})

describe("Shifts Router - T118: shifts.addStaff", () => {
  let testShiftId: number

  beforeAll(async () => {
    // Create a shift to add staff to
    const caller = appRouter.createCaller(managerContext)
    const shift = await caller.shifts.start({
      shiftType: "Custom",
      customTypeName: "Test Shift",
      staffIds: [],
    })
    testShiftId = shift.id
  })

  afterAll(async () => {
    // Clean up
    if (testShiftId) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, testShiftId))
      await db.delete(shifts).where(eq(shifts.id, testShiftId))
    }
  })

  test("T118-RED-1: Manager can add staff to active shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.addStaff({
      shiftId: testShiftId,
      staffIds: [testStaffIds[0]],
    })

    expect(result.success).toBe(true)
    expect(result.addedCount).toBe(1)
  })

  test("T118-RED-2: Adding duplicate staff is idempotent", async () => {
    const caller = appRouter.createCaller(managerContext)

    // Add same staff again - with onConflictDoNothing, should succeed
    const result = await caller.shifts.addStaff({
      shiftId: testShiftId,
      staffIds: [testStaffIds[0]],
    })

    expect(result.success).toBe(true)
    // Returns total count of matching staff (includes pre-existing), so should be 1
    expect(result.addedCount).toBe(1)
  })

  test("T118-RED-3: Returns NOT_FOUND for non-existent shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.addStaff({
        shiftId: 999999,
        staffIds: [testStaffIds[0]],
      })
    ).rejects.toThrow(/Shift not found/)
  })

  test("T118-RED-4: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(
      caller.shifts.addStaff({
        shiftId: testShiftId,
        staffIds: [testStaffIds[0]],
      })
    ).rejects.toThrow(/Manager access required/)
  })
})

describe("Shifts Router - T119: shifts.removeStaff", () => {
  let testShiftId: number

  beforeAll(async () => {
    // Create a shift with staff
    const caller = appRouter.createCaller(managerContext)
    const shift = await caller.shifts.start({
      shiftType: "Custom",
      customTypeName: "Test Shift",
      staffIds: testStaffIds,
    })
    testShiftId = shift.id
  })

  afterAll(async () => {
    // Clean up
    if (testShiftId) {
      await db.delete(shiftStaff).where(eq(shiftStaff.shiftId, testShiftId))
      await db.delete(shifts).where(eq(shifts.id, testShiftId))
    }
  })

  test("T119-RED-1: Manager can remove staff from shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.shifts.removeStaff({
      shiftId: testShiftId,
      staffIds: [testStaffIds[0]],
    })

    expect(result.success).toBe(true)
    expect(result.removedCount).toBe(1)
  })

  test("T119-RED-2: Returns NOT_FOUND for non-existent shift", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(
      caller.shifts.removeStaff({
        shiftId: 999999,
        staffIds: [testStaffIds[0]],
      })
    ).rejects.toThrow(/Shift not found/)
  })

  test("T119-RED-3: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(
      caller.shifts.removeStaff({
        shiftId: testShiftId,
        staffIds: [testStaffIds[0]],
      })
    ).rejects.toThrow(/Manager access required/)
  })
})
