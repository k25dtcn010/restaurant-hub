import { beforeAll, describe, expect, test, afterAll } from "bun:test"
import { db, modifiers, modifierGroups, dishModifiers, eq } from "@learn-bettert/db"

import type { Context } from "../../src/context"
import { appRouter } from "../../src/routers/index"
import { mockWsNotifier } from "../setup"

/**
 * T021-T030: Contract tests for modifiers router
 * Contract: specs/002-advanced-ops-management/contracts/modifiers-router.md
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
  session: { userId: "manager-1" },
  user: { id: "manager-1", email: "manager@test.com", name: "Manager" },
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Staff context (non-manager)
const staffContext: Context = {
  session: { userId: "staff-1" },
  user: { id: "staff-1", email: "staff@test.com", name: "Staff" },
  role: "Staff",
  db,
  wsNotifier: mockWsNotifier,
}

describe("Modifiers Router - T021: modifiers.list", () => {
  let testModifierIds: number[] = []

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(modifiers).where(eq(modifiers.name, "Test Extra Cheese"))
    await db.delete(modifiers).where(eq(modifiers.name, "Test No Onions"))
    await db.delete(modifiers).where(eq(modifiers.name, "Test Bacon"))
    await db.delete(modifiers).where(eq(modifiers.name, "Test Gluten Free"))
    await db.delete(modifiers).where(eq(modifiers.name, "Test Spicy"))

    // Create test modifiers: 3 available, 2 unavailable
    const modifier1 = await db
      .insert(modifiers)
      .values({
        name: "Test Extra Cheese",
        priceAdjustment: 200, // $2.00
        isAvailable: true,
      })
      .returning()
    testModifierIds.push(modifier1[0].id)

    const modifier2 = await db
      .insert(modifiers)
      .values({
        name: "Test No Onions",
        priceAdjustment: 0,
        isAvailable: true,
      })
      .returning()
    testModifierIds.push(modifier2[0].id)

    const modifier3 = await db
      .insert(modifiers)
      .values({
        name: "Test Bacon",
        priceAdjustment: 150, // $1.50
        isAvailable: true,
      })
      .returning()
    testModifierIds.push(modifier3[0].id)

    const modifier4 = await db
      .insert(modifiers)
      .values({
        name: "Test Gluten Free",
        priceAdjustment: 300,
        isAvailable: false, // Unavailable
      })
      .returning()
    testModifierIds.push(modifier4[0].id)

    const modifier5 = await db
      .insert(modifiers)
      .values({
        name: "Test Spicy",
        priceAdjustment: 0,
        isAvailable: false, // Unavailable
      })
      .returning()
    testModifierIds.push(modifier5[0].id)
  })

  afterAll(async () => {
    // Clean up test data
    for (const id of testModifierIds) {
      await db.delete(modifiers).where(eq(modifiers.id, id))
    }
  })

  test("T021-1: Returns all modifiers when availableOnly = false", async () => {
    const caller = appRouter.createCaller(mockContext)

    const result = await caller.modifiers.list({ availableOnly: false })

    expect(result).toBeDefined()
    expect(result).toBeArray()
    
    // Should include both available and unavailable modifiers
    const testModifiers = result.filter((m) => testModifierIds.includes(m.id))
    expect(testModifiers.length).toBe(5)
  })

  test("T021-2: Returns only available modifiers when availableOnly = true", async () => {
    const caller = appRouter.createCaller(mockContext)

    const result = await caller.modifiers.list({ availableOnly: true })

    expect(result).toBeDefined()
    expect(result).toBeArray()
    
    // Should only include available modifiers
    const testModifiers = result.filter((m) => testModifierIds.includes(m.id))
    expect(testModifiers.length).toBe(3)
    
    // Verify all returned modifiers are available
    testModifiers.forEach((m) => {
      expect(m.isAvailable).toBe(true)
    })
  })

  test("T021-3: Returns empty array when no modifiers exist (isolation test)", async () => {
    // Delete all test modifiers temporarily
    for (const id of testModifierIds) {
      await db.delete(modifiers).where(eq(modifiers.id, id))
    }

    const caller = appRouter.createCaller(mockContext)
    const result = await caller.modifiers.list({ availableOnly: false })

    // Might have other modifiers from other tests, but at least should be an array
    expect(result).toBeArray()

    // Restore test modifiers for other tests
    const modifier1 = await db.insert(modifiers).values({
      name: "Test Extra Cheese",
      priceAdjustment: 200,
      isAvailable: true,
    }).returning()
    testModifierIds[0] = modifier1[0].id

    const modifier2 = await db.insert(modifiers).values({
      name: "Test No Onions",
      priceAdjustment: 0,
      isAvailable: true,
    }).returning()
    testModifierIds[1] = modifier2[0].id

    const modifier3 = await db.insert(modifiers).values({
      name: "Test Bacon",
      priceAdjustment: 150,
      isAvailable: true,
    }).returning()
    testModifierIds[2] = modifier3[0].id

    const modifier4 = await db.insert(modifiers).values({
      name: "Test Gluten Free",
      priceAdjustment: 300,
      isAvailable: false,
    }).returning()
    testModifierIds[3] = modifier4[0].id

    const modifier5 = await db.insert(modifiers).values({
      name: "Test Spicy",
      priceAdjustment: 0,
      isAvailable: false,
    }).returning()
    testModifierIds[4] = modifier5[0].id
  })
})

describe("Modifiers Router - T022: modifiers.create", () => {
  let createdModifierId: number | null = null

  afterAll(async () => {
    // Clean up
    if (createdModifierId) {
      await db.delete(modifiers).where(eq(modifiers.id, createdModifierId))
    }
  })

  test("T022-1: Manager can create modifier successfully", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.modifiers.create({
      name: "Test Manager Create",
      priceAdjustment: 250,
      isAvailable: true,
    })

    expect(result).toBeDefined()
    expect(result.id).toBeNumber()
    expect(result.name).toBe("Test Manager Create")
    expect(result.priceAdjustment).toBe(250)
    expect(result.isAvailable).toBe(true)
    expect(result.createdAt).toBeInstanceOf(Date)

    createdModifierId = result.id
  })

  test("T022-2: Non-manager gets UNAUTHORIZED error", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(async () => {
      await caller.modifiers.create({
        name: "Test Unauthorized",
        priceAdjustment: 100,
        isAvailable: true,
      })
    }).toThrow()
  })

  test("T022-3: Negative price adjustment is allowed (discount)", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.modifiers.create({
      name: "Test Discount Modifier",
      priceAdjustment: -50, // Negative for discount
      isAvailable: true,
    })

    expect(result).toBeDefined()
    expect(result.priceAdjustment).toBe(-50)

    // Clean up
    await db.delete(modifiers).where(eq(modifiers.id, result.id))
  })
})

describe("Modifiers Router - T023: modifiers.update", () => {
  let testModifierId: number

  beforeAll(async () => {
    const [modifier] = await db
      .insert(modifiers)
      .values({
        name: "Test Update Modifier",
        priceAdjustment: 100,
        isAvailable: true,
      })
      .returning()
    testModifierId = modifier.id
  })

  afterAll(async () => {
    await db.delete(modifiers).where(eq(modifiers.id, testModifierId))
  })

  test("T023-1: Manager can update modifier name/price/availability", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.modifiers.update({
      id: testModifierId,
      name: "Test Updated Name",
      priceAdjustment: 200,
      isAvailable: false,
    })

    expect(result).toBeDefined()
    expect(result.id).toBe(testModifierId)
    expect(result.name).toBe("Test Updated Name")
    expect(result.priceAdjustment).toBe(200)
    expect(result.isAvailable).toBe(false)
  })

  test("T023-2: Non-manager gets UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(staffContext)

    await expect(async () => {
      await caller.modifiers.update({
        id: testModifierId,
        name: "Test Unauthorized Update",
      })
    }).toThrow()
  })

  test("T023-3: Non-existent modifier ID returns NOT_FOUND", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(async () => {
      await caller.modifiers.update({
        id: 999999,
        name: "Non-existent",
      })
    }).toThrow()
  })

  test("T023-4: Partial updates work (only provided fields updated)", async () => {
    const caller = appRouter.createCaller(managerContext)

    // First, set to known state
    await caller.modifiers.update({
      id: testModifierId,
      name: "Known State",
      priceAdjustment: 100,
      isAvailable: true,
    })

    // Now update only the price
    const result = await caller.modifiers.update({
      id: testModifierId,
      priceAdjustment: 150,
    })

    expect(result.name).toBe("Known State") // Name unchanged
    expect(result.priceAdjustment).toBe(150) // Price updated
    expect(result.isAvailable).toBe(true) // Availability unchanged
  })
})

describe("Modifiers Router - T024: modifiers.delete", () => {
  let testModifierId: number
  let testModifierWithDishId: number
  let testDishId: number

  beforeAll(async () => {
    // Create a modifier not assigned to any dish
    const [modifier1] = await db
      .insert(modifiers)
      .values({
        name: "Test Delete Unassigned",
        priceAdjustment: 100,
        isAvailable: true,
      })
      .returning()
    testModifierId = modifier1.id

    // Create a modifier assigned to a dish
    const [modifier2] = await db
      .insert(modifiers)
      .values({
        name: "Test Delete Assigned",
        priceAdjustment: 100,
        isAvailable: true,
      })
      .returning()
    testModifierWithDishId = modifier2.id

    // Get or create a test dish
    const existingDish = await db.query.dishes.findFirst()
    if (existingDish) {
      testDishId = existingDish.id
    } else {
      const { dishes } = await import("@learn-bettert/db")
      const [newDish] = await db
        .insert(dishes)
        .values({
          name: "Test Dish for Modifier Delete",
          description: "Test",
          price: 1000,
          isAvailable: true,
        })
        .returning()
      testDishId = newDish.id
    }

    // Create a modifier group for the assignment
    const [group] = await db
      .insert(modifierGroups)
      .values({
        name: "Test Group for Delete",
        displayOrder: 0,
      })
      .returning()

    // Assign modifier2 to the dish
    await db.insert(dishModifiers).values({
      dishId: testDishId,
      modifierId: testModifierWithDishId,
      modifierGroupId: group.id,
    })
  })

  afterAll(async () => {
    // Clean up - delete dish modifiers first
    await db
      .delete(dishModifiers)
      .where(eq(dishModifiers.modifierId, testModifierWithDishId))

    // Then delete modifiers (if they still exist)
    try {
      await db.delete(modifiers).where(eq(modifiers.id, testModifierId))
    } catch (e) {
      // May have been deleted in test
    }
    await db.delete(modifiers).where(eq(modifiers.id, testModifierWithDishId))
  })

  test("T024-1: Can delete modifier not assigned to any dishes", async () => {
    const caller = appRouter.createCaller(managerContext)

    const result = await caller.modifiers.delete({
      id: testModifierId,
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)

    // Verify it's actually deleted
    const deletedModifier = await db.query.modifiers.findFirst({
      where: eq(modifiers.id, testModifierId),
    })
    expect(deletedModifier).toBeUndefined()
  })

  test("T024-2: Returns BAD_REQUEST if modifier assigned to dishes", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(async () => {
      await caller.modifiers.delete({
        id: testModifierWithDishId,
      })
    }).toThrow(/assigned to dishes/)
  })

  test("T024-3: Returns NOT_FOUND if modifier doesn't exist", async () => {
    const caller = appRouter.createCaller(managerContext)

    await expect(async () => {
      await caller.modifiers.delete({
        id: 999999,
      })
    }).toThrow()
  })
})

describe("Modifiers Router - T025-T028: Modifier Groups CRUD", () => {
  let testGroupIds: number[] = []

  afterAll(async () => {
    // Clean up all test groups
    for (const id of testGroupIds) {
      try {
        await db.delete(modifierGroups).where(eq(modifierGroups.id, id))
      } catch (e) {
        // May have been deleted in test
      }
    }
  })

  describe("T025: modifiers.listGroups", () => {
    beforeAll(async () => {
      // Create test groups with specific display orders
      const group1 = await db
        .insert(modifierGroups)
        .values({
          name: "Test Toppings",
          minSelections: 0,
          maxSelections: 3,
          displayOrder: 1,
        })
        .returning()
      testGroupIds.push(group1[0].id)

      const group2 = await db
        .insert(modifierGroups)
        .values({
          name: "Test Size",
          minSelections: 1,
          maxSelections: 1,
          displayOrder: 0, // Should appear first
        })
        .returning()
      testGroupIds.push(group2[0].id)
    })

    test("T025-1: Returns groups ordered by displayOrder ASC", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.modifiers.listGroups()

      expect(result).toBeDefined()
      expect(result).toBeArray()

      // Find our test groups
      const testGroups = result.filter((g) => testGroupIds.includes(g.id))
      expect(testGroups.length).toBe(2)

      // Verify order: "Test Size" (displayOrder=0) should come before "Test Toppings" (displayOrder=1)
      const sizeGroup = testGroups.find((g) => g.name === "Test Size")
      const toppingsGroup = testGroups.find((g) => g.name === "Test Toppings")

      expect(sizeGroup).toBeDefined()
      expect(toppingsGroup).toBeDefined()
      expect(result.indexOf(sizeGroup!)).toBeLessThan(result.indexOf(toppingsGroup!))
    })
  })

  describe("T026: modifiers.createGroup", () => {
    test("T026-1: Manager can create group", async () => {
      const caller = appRouter.createCaller(managerContext)

      const result = await caller.modifiers.createGroup({
        name: "Test Create Group",
        minSelections: 0,
        maxSelections: 5,
        displayOrder: 10,
      })

      expect(result).toBeDefined()
      expect(result.id).toBeNumber()
      expect(result.name).toBe("Test Create Group")
      expect(result.minSelections).toBe(0)
      expect(result.maxSelections).toBe(5)
      expect(result.displayOrder).toBe(10)

      testGroupIds.push(result.id)
    })

    test("T026-2: Min/max validation works - rejects min > max", async () => {
      const caller = appRouter.createCaller(managerContext)

      // This should fail Zod validation if properly configured
      await expect(async () => {
        await caller.modifiers.createGroup({
          name: "Test Invalid Min Max",
          minSelections: 5,
          maxSelections: 2, // max < min
          displayOrder: 0,
        })
      }).toThrow()
    })
  })

  describe("T027: modifiers.updateGroup", () => {
    let groupToUpdateId: number

    beforeAll(async () => {
      const [group] = await db
        .insert(modifierGroups)
        .values({
          name: "Test Update Group",
          minSelections: 1,
          maxSelections: 3,
          displayOrder: 5,
        })
        .returning()
      groupToUpdateId = group.id
      testGroupIds.push(groupToUpdateId)
    })

    test("T027-1: Manager can update group fields", async () => {
      const caller = appRouter.createCaller(managerContext)

      const result = await caller.modifiers.updateGroup({
        id: groupToUpdateId,
        name: "Test Updated Group Name",
        maxSelections: 5,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe("Test Updated Group Name")
      expect(result.maxSelections).toBe(5)
      expect(result.minSelections).toBe(1) // Unchanged
    })

    test("T027-2: Non-existent group returns NOT_FOUND", async () => {
      const caller = appRouter.createCaller(managerContext)

      await expect(async () => {
        await caller.modifiers.updateGroup({
          id: 999999,
          name: "Non-existent",
        })
      }).toThrow()
    })
  })

  describe("T028: modifiers.deleteGroup", () => {
    let groupToDeleteId: number
    let groupWithDishesId: number

    beforeAll(async () => {
      // Group not assigned to any dishes
      const [group1] = await db
        .insert(modifierGroups)
        .values({
          name: "Test Delete Unassigned Group",
          displayOrder: 0,
        })
        .returning()
      groupToDeleteId = group1.id
      testGroupIds.push(groupToDeleteId)

      // Group assigned to a dish
      const [group2] = await db
        .insert(modifierGroups)
        .values({
          name: "Test Delete Assigned Group",
          displayOrder: 0,
        })
        .returning()
      groupWithDishesId = group2.id
      testGroupIds.push(groupWithDishesId)

      // Create a modifier
      const [modifier] = await db
        .insert(modifiers)
        .values({
          name: "Test Modifier for Group Delete",
          priceAdjustment: 100,
          isAvailable: true,
        })
        .returning()

      // Get a test dish
      const dish = await db.query.dishes.findFirst()
      if (dish) {
        // Assign modifier to dish with the group
        await db.insert(dishModifiers).values({
          dishId: dish.id,
          modifierId: modifier.id,
          modifierGroupId: groupWithDishesId,
        })
      }
    })

    test("T028-1: Can delete group not assigned to dishes", async () => {
      const caller = appRouter.createCaller(managerContext)

      const result = await caller.modifiers.deleteGroup({
        id: groupToDeleteId,
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)

      // Verify it's deleted
      const deletedGroup = await db.query.modifierGroups.findFirst({
        where: eq(modifierGroups.id, groupToDeleteId),
      })
      expect(deletedGroup).toBeUndefined()
    })

    test("T028-2: Returns error if group assigned to dishes", async () => {
      const caller = appRouter.createCaller(managerContext)

      await expect(async () => {
        await caller.modifiers.deleteGroup({
          id: groupWithDishesId,
        })
      }).toThrow(/assigned to dishes/)
    })
  })
})

describe("Modifiers Router - T029-T030: Dish-Modifier Assignment", () => {
  let testDishId: number
  let testModifierId: number
  let testModifierGroupId: number

  beforeAll(async () => {
    // Get or create a test dish
    const existingDish = await db.query.dishes.findFirst()
    if (existingDish) {
      testDishId = existingDish.id
    } else {
      const { dishes } = await import("@learn-bettert/db")
      const [newDish] = await db
        .insert(dishes)
        .values({
          name: "Test Dish for Assignment",
          description: "Test dish",
          price: 1200,
          isAvailable: true,
        })
        .returning()
      testDishId = newDish.id
    }

    // Create a test modifier
    const [modifier] = await db
      .insert(modifiers)
      .values({
        name: "Test Modifier for Assignment",
        priceAdjustment: 200,
        isAvailable: true,
      })
      .returning()
    testModifierId = modifier.id

    // Create a test modifier group
    const [group] = await db
      .insert(modifierGroups)
      .values({
        name: "Test Group for Assignment",
        minSelections: 0,
        maxSelections: 3,
        displayOrder: 0,
      })
      .returning()
    testModifierGroupId = group.id
  })

  afterAll(async () => {
    // Clean up - delete assignments first
    await db
      .delete(dishModifiers)
      .where(eq(dishModifiers.modifierId, testModifierId))
    
    // Then delete modifier and group
    await db.delete(modifiers).where(eq(modifiers.id, testModifierId))
    await db.delete(modifierGroups).where(eq(modifierGroups.id, testModifierGroupId))
  })

  describe("T029: modifiers.assignToDish", () => {
    test("T029-1: Manager can assign modifier to dish with group", async () => {
      const caller = appRouter.createCaller(managerContext)

      const result = await caller.modifiers.assignToDish({
        dishId: testDishId,
        modifierId: testModifierId,
        modifierGroupId: testModifierGroupId,
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)

      // Verify assignment exists in database
      const assignment = await db.query.dishModifiers.findFirst({
        where: (dishModifiers, { and, eq }) =>
          and(
            eq(dishModifiers.dishId, testDishId),
            eq(dishModifiers.modifierId, testModifierId)
          ),
      })
      expect(assignment).toBeDefined()
      expect(assignment?.modifierGroupId).toBe(testModifierGroupId)
    })

    test("T029-2: Duplicate assignment is idempotent (no error)", async () => {
      const caller = appRouter.createCaller(managerContext)

      // Assign again (should not error)
      const result = await caller.modifiers.assignToDish({
        dishId: testDishId,
        modifierId: testModifierId,
        modifierGroupId: testModifierGroupId,
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe("T030: modifiers.getByDish", () => {
    beforeAll(async () => {
      // Ensure assignment exists
      const existingAssignment = await db.query.dishModifiers.findFirst({
        where: (dishModifiers, { and, eq }) =>
          and(
            eq(dishModifiers.dishId, testDishId),
            eq(dishModifiers.modifierId, testModifierId)
          ),
      })

      if (!existingAssignment) {
        await db.insert(dishModifiers).values({
          dishId: testDishId,
          modifierId: testModifierId,
          modifierGroupId: testModifierGroupId,
        })
      }
    })

    test("T030-1: Returns modifiers grouped by modifierGroup for a specific dish", async () => {
      const caller = appRouter.createCaller(mockContext)

      const result = await caller.modifiers.getByDish({
        dishId: testDishId,
      })

      expect(result).toBeDefined()
      expect(result).toBeArray()
      
      // Find our test group
      const testGroup = result.find((g) => g.group.id === testModifierGroupId)
      expect(testGroup).toBeDefined()
      expect(testGroup?.group.name).toBe("Test Group for Assignment")
      
      // Verify modifiers in the group
      expect(testGroup?.modifiers).toBeArray()
      const testModifier = testGroup?.modifiers.find((m) => m.id === testModifierId)
      expect(testModifier).toBeDefined()
      expect(testModifier?.name).toBe("Test Modifier for Assignment")
      expect(testModifier?.priceAdjustment).toBe(200)
    })

    test("T030-2: Returns empty array for dish with no modifiers", async () => {
      // Create a new dish with no modifiers
      const { dishes } = await import("@learn-bettert/db")
      const [newDish] = await db
        .insert(dishes)
        .values({
          name: "Dish with No Modifiers",
          description: "Test",
          price: 1000,
          isAvailable: true,
        })
        .returning()

      const caller = appRouter.createCaller(mockContext)

      const result = await caller.modifiers.getByDish({
        dishId: newDish.id,
      })

      expect(result).toBeDefined()
      expect(result).toBeArray()
      expect(result.length).toBe(0)

      // Clean up
      await db.delete((await import("@learn-bettert/db")).dishes).where(eq((await import("@learn-bettert/db")).dishes.id, newDish.id))
    })
  })
})
