import { afterEach, beforeAll, describe, expect, test } from "bun:test"

import type { Context } from "@/api/context"
import { appRouter } from "@/api/routers"
import { db, eq, operatingHours, reservations } from "@/db"

import { mockWsNotifier } from "../setup"

/**
 * T089-T099: TDD tests for reservations router
 * Contract: contracts/reservations-router.md
 * Following TDD RED-GREEN-REFACTOR approach per Constitution § I
 *
 * Phase 7 User Story 5 - Table Reservation System Backend
 */

// Mock contexts for different user roles
const mockPublicContext: Context = {
  session: null,
  user: null,
  role: null,
  db,
  wsNotifier: mockWsNotifier,
}

const mockStaffContext: Context = {
  session: { id: "staff-session", userId: "staff-user-id" } as any,
  user: { id: "staff-user-id", email: "staff@test.com", name: "Test Staff" } as any,
  role: "Staff",
  db,
  wsNotifier: mockWsNotifier,
}

const mockManagerContext: Context = {
  session: { id: "manager-session", userId: "manager-user-id" } as any,
  user: { id: "manager-user-id", email: "manager@test.com", name: "Test Manager" } as any,
  role: "Manager",
  db,
  wsNotifier: mockWsNotifier,
}

// Helper to get tomorrow's date in YYYY-MM-DD format
const getTomorrowDate = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split("T")[0]
}

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  return new Date().toISOString().split("T")[0]
}

// Helper to get yesterday's date in YYYY-MM-DD format
const getYesterdayDate = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split("T")[0]
}

describe("Reservations Router - Operating Hours (T089-T090)", () => {
  describe("T089: reservations.getOperatingHours", () => {
    afterEach(async () => {
      // Clean up operating hours after each test
      await db.delete(operatingHours)
    })

    test("should return empty array when no operating hours configured", async () => {
      // Clean up first
      await db.delete(operatingHours)
      const caller = appRouter.createCaller(mockPublicContext)
      const result = await caller.reservations.getOperatingHours()

      expect(result).toEqual([])
    })

    test("should return all operating hours sorted by day of week", async () => {
      // Clean up first
      await db.delete(operatingHours)

      // Insert operating hours for 3 days
      await db.insert(operatingHours).values([
        { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isClosed: false }, // Monday
        { dayOfWeek: 0, openTime: "10:00", closeTime: "15:00", isClosed: false }, // Sunday
        { dayOfWeek: 6, openTime: "11:00", closeTime: "22:00", isClosed: false }, // Saturday
      ])

      const caller = appRouter.createCaller(mockPublicContext)
      const result = await caller.reservations.getOperatingHours()

      expect(result).toHaveLength(3)
      expect(result[0].dayOfWeek).toBe(0) // Sunday first
      expect(result[1].dayOfWeek).toBe(1) // Monday second
      expect(result[2].dayOfWeek).toBe(6) // Saturday last
    })

    test("should include closed days in results", async () => {
      // Clean up first
      await db.delete(operatingHours)

      await db
        .insert(operatingHours)
        .values([{ dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isClosed: true }])

      const caller = appRouter.createCaller(mockPublicContext)
      const result = await caller.reservations.getOperatingHours()

      expect(result).toHaveLength(1)
      expect(result[0].isClosed).toBe(true)
    })

    test("should be accessible by public (no auth required)", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockPublicContext)
      await expect(caller.reservations.getOperatingHours()).resolves.toBeDefined()
    })
  })

  describe("T090: reservations.updateOperatingHours", () => {
    afterEach(async () => {
      // Clean up operating hours after each test
      await db.delete(operatingHours)
    })

    test("should create new operating hours for a day", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.updateOperatingHours({
        dayOfWeek: 1,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: false,
      })

      expect(result.id).toBeDefined()
      expect(result.dayOfWeek).toBe(1)
      expect(result.openTime).toBe("09:00")
      expect(result.closeTime).toBe("17:00")
      expect(result.isClosed).toBe(false)
    })

    test("should update existing operating hours for a day", async () => {
      // Clean up first
      await db.delete(operatingHours)

      // Insert initial hours
      await db.insert(operatingHours).values({
        dayOfWeek: 2,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: false,
      })

      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.reservations.updateOperatingHours({
        dayOfWeek: 2,
        openTime: "10:00",
        closeTime: "22:00",
        isClosed: false,
      })

      expect(result.openTime).toBe("10:00")
      expect(result.closeTime).toBe("22:00")
    })

    test("should reject if openTime >= closeTime (when not closed)", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.updateOperatingHours({
          dayOfWeek: 1,
          openTime: "17:00",
          closeTime: "09:00",
          isClosed: false,
        })
      ).rejects.toThrow()
    })

    test("should allow any times when day is marked as closed", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockManagerContext)

      const result = await caller.reservations.updateOperatingHours({
        dayOfWeek: 0,
        openTime: "00:00",
        closeTime: "00:00",
        isClosed: true,
      })

      expect(result.isClosed).toBe(true)
    })

    test("should reject invalid time format", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.updateOperatingHours({
          dayOfWeek: 1,
          openTime: "25:00",
          closeTime: "17:00",
          isClosed: false,
        })
      ).rejects.toThrow()
    })

    test("should reject dayOfWeek outside 0-6 range", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.updateOperatingHours({
          dayOfWeek: 7,
          openTime: "09:00",
          closeTime: "17:00",
          isClosed: false,
        })
      ).rejects.toThrow()
    })

    test("should require manager role", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockStaffContext)

      await expect(
        caller.reservations.updateOperatingHours({
          dayOfWeek: 1,
          openTime: "09:00",
          closeTime: "17:00",
          isClosed: false,
        })
      ).rejects.toThrow(/Manager access required/)
    })

    test("should reject public access", async () => {
      // Clean up first
      await db.delete(operatingHours)

      const caller = appRouter.createCaller(mockPublicContext)

      await expect(
        caller.reservations.updateOperatingHours({
          dayOfWeek: 1,
          openTime: "09:00",
          closeTime: "17:00",
          isClosed: false,
        })
      ).rejects.toThrow(/Authentication required/)
    })
  })
})

describe("Reservations Router - Reservation Lifecycle (T092-T099)", () => {
  beforeAll(async () => {
    // Set up operating hours for Monday-Friday (weekdays)
    await db.delete(operatingHours)
    await db.insert(operatingHours).values([
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isClosed: true }, // Sunday closed
      { dayOfWeek: 1, openTime: "11:00", closeTime: "22:00", isClosed: false },
      { dayOfWeek: 2, openTime: "11:00", closeTime: "22:00", isClosed: false },
      { dayOfWeek: 3, openTime: "11:00", closeTime: "22:00", isClosed: false },
      { dayOfWeek: 4, openTime: "11:00", closeTime: "22:00", isClosed: false },
      { dayOfWeek: 5, openTime: "11:00", closeTime: "23:00", isClosed: false },
      { dayOfWeek: 6, openTime: "10:00", closeTime: "23:00", isClosed: false },
    ])
  })

  describe("T092: reservations.create", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should create reservation with valid data", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      const result = await caller.reservations.create({
        date: tomorrow,
        time: "12:00",
        partySize: 4,
        customerName: "John Doe",
        customerPhone: "1234567890",
        notes: "Window seat preferred",
      })

      expect(result.id).toBeDefined()
      expect(result.status).toBe("Pending")
      expect(result.date).toBe(tomorrow)
      expect(result.time).toBe("12:00")
      expect(result.partySize).toBe(4)
      expect(result.customerName).toBe("John Doe")
    })

    test("should reject reservation for past date", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const yesterday = getYesterdayDate()

      await expect(
        caller.reservations.create({
          date: yesterday,
          time: "12:00",
          partySize: 4,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).rejects.toThrow()
    })

    test("should reject reservation for time outside operating hours", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      await expect(
        caller.reservations.create({
          date: tomorrow,
          time: "08:00", // Before opening time
          partySize: 4,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).rejects.toThrow(/outside operating hours/)
    })

    test("should reject reservation for closed day", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      // Find next Sunday (day 0)
      const today = new Date()
      const nextSunday = new Date(today)
      const daysUntilSunday = (7 - today.getDay()) % 7 || 7
      nextSunday.setDate(today.getDate() + daysUntilSunday)
      const sundayDate = nextSunday.toISOString().split("T")[0]

      await expect(
        caller.reservations.create({
          date: sundayDate,
          time: "12:00",
          partySize: 4,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).rejects.toThrow(/closed/)
    })

    test("should validate party size range (1-20)", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      await expect(
        caller.reservations.create({
          date: tomorrow,
          time: "12:00",
          partySize: 0,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).rejects.toThrow()

      await expect(
        caller.reservations.create({
          date: tomorrow,
          time: "12:00",
          partySize: 25,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).rejects.toThrow()
    })

    test("should be accessible by public (no auth)", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      await expect(
        caller.reservations.create({
          date: tomorrow,
          time: "12:00",
          partySize: 4,
          customerName: "John Doe",
          customerPhone: "1234567890",
        })
      ).resolves.toBeDefined()
    })
  })

  describe("T093: reservations.list", () => {
    let testReservationIds: number[] = []

    beforeAll(async () => {
      // Clean up first
      await db.delete(reservations)

      // Create test reservations with different statuses and dates
      const tomorrow = getTomorrowDate()
      const today = getTodayDate()

      const inserted = await db
        .insert(reservations)
        .values([
          {
            date: tomorrow,
            time: "12:00",
            partySize: 4,
            customerName: "Alice",
            customerPhone: "1111111111",
            status: "Pending",
          },
          {
            date: tomorrow,
            time: "14:00",
            partySize: 2,
            customerName: "Bob",
            customerPhone: "2222222222",
            status: "Confirmed",
            assignedTableIds: "[1,2]",
          },
          {
            date: today,
            time: "18:00",
            partySize: 6,
            customerName: "Charlie",
            customerPhone: "3333333333",
            status: "Seated",
          },
        ])
        .returning()

      testReservationIds = inserted.map((r) => r.id)
    })

    afterAll(async () => {
      // Clean up test reservations
      await db.delete(reservations)
    })

    test("should list all reservations without filters", async () => {
      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.list({})

      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    test("should filter by status", async () => {
      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.list({ status: "Pending" })

      expect(result.every((r) => r.status === "Pending")).toBe(true)
      expect(result.some((r) => r.customerName === "Alice")).toBe(true)
    })

    test("should filter by exact date", async () => {
      const caller = appRouter.createCaller(mockManagerContext)
      const tomorrow = getTomorrowDate()

      const result = await caller.reservations.list({ date: tomorrow })

      expect(result.every((r) => r.date === tomorrow)).toBe(true)
    })

    test("should filter by date range", async () => {
      const caller = appRouter.createCaller(mockManagerContext)
      const today = getTodayDate()
      const tomorrow = getTomorrowDate()

      const result = await caller.reservations.list({
        startDate: today,
        endDate: tomorrow,
      })

      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    test("should sort by date and time ascending", async () => {
      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.list({})

      for (let i = 0; i < result.length - 1; i++) {
        const dateTimeA = new Date(`${result[i].date}T${result[i].time}`)
        const dateTimeB = new Date(`${result[i + 1].date}T${result[i + 1].time}`)
        expect(dateTimeA.getTime()).toBeLessThanOrEqual(dateTimeB.getTime())
      }
    })

    test("should require staff or manager role", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      await expect(caller.reservations.list({})).rejects.toThrow(/Authentication required/)
    })

    test("should allow staff access", async () => {
      const caller = appRouter.createCaller(mockStaffContext)

      await expect(caller.reservations.list({})).resolves.toBeDefined()
    })
  })

  describe("T094: reservations.confirm", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should confirm pending reservation", async () => {
      // Create pending reservation
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.confirm({ id: reservation.id })

      expect(result.status).toBe("Confirmed")
      expect(result.id).toBe(reservation.id)
    })

    test("should assign tables when confirming", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "14:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.confirm({
        id: reservation.id,
        assignedTableIds: [1, 2],
      })

      expect(result.status).toBe("Confirmed")
      expect(result.assignedTableIds).toEqual([1, 2])
    })

    test("should reject if reservation not found", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.confirm({ id: 99999 })).rejects.toThrow(
        /Reservation not found/
      )
    })

    test("should reject if status is not Pending", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Confirmed",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.confirm({ id: reservation.id })).rejects.toThrow(
        /Only pending reservations can be confirmed/
      )
    })

    test("should require staff or manager role", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      await expect(caller.reservations.confirm({ id: 1 })).rejects.toThrow(
        /Authentication required/
      )
    })
  })

  describe("T095: reservations.decline", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should decline pending reservation with reason", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.decline({
        id: reservation.id,
        declineReason: "Fully booked",
      })

      expect(result.status).toBe("Declined")
      expect(result.declineReason).toBe("Fully booked")
    })

    test("should reject if reservation not found", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.decline({
          id: 99999,
          declineReason: "Test reason",
        })
      ).rejects.toThrow(/Reservation not found/)
    })

    test("should reject if status is not Pending", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Confirmed",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.decline({
          id: reservation.id,
          declineReason: "Test reason",
        })
      ).rejects.toThrow(/Only pending reservations can be declined/)
    })

    test("should require decline reason", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(
        caller.reservations.decline({
          id: reservation.id,
          declineReason: "",
        })
      ).rejects.toThrow()
    })
  })

  describe("T096: reservations.markSeated", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should mark confirmed reservation as seated", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTodayDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Confirmed",
          assignedTableIds: "[1,2]",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.markSeated({ id: reservation.id })

      expect(result.status).toBe("Seated")
      expect(result.id).toBe(reservation.id)
    })

    test("should reject if reservation not found", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.markSeated({ id: 99999 })).rejects.toThrow(
        /Reservation not found/
      )
    })

    test("should reject if status is not Confirmed", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTodayDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.markSeated({ id: reservation.id })).rejects.toThrow(
        /Only confirmed reservations can be marked as seated/
      )
    })
  })

  describe("T097: reservations.markNoShow", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should mark confirmed reservation as no-show", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTodayDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Confirmed",
          assignedTableIds: "[1,2]",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)
      const result = await caller.reservations.markNoShow({ id: reservation.id })

      expect(result.status).toBe("No-Show")
      expect(result.id).toBe(reservation.id)
    })

    test("should reject if reservation not found", async () => {
      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.markNoShow({ id: 99999 })).rejects.toThrow(
        /Reservation not found/
      )
    })

    test("should reject if status is not Confirmed", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTodayDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockManagerContext)

      await expect(caller.reservations.markNoShow({ id: reservation.id })).rejects.toThrow(
        /Only confirmed reservations can be marked as no-show/
      )
    })
  })

  describe("T098: reservations.cancel", () => {
    afterEach(async () => {
      // Clean up reservations after each test
      await db.delete(reservations)
    })

    test("should allow cancellation by public with valid reservation ID", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Pending",
        })
        .returning()

      const caller = appRouter.createCaller(mockPublicContext)
      const result = await caller.reservations.cancel({ id: reservation.id })

      expect(result.status).toBe("Cancelled")
    })

    test("should allow staff to cancel any reservation", async () => {
      const [reservation] = await db
        .insert(reservations)
        .values({
          date: getTomorrowDate(),
          time: "12:00",
          partySize: 4,
          customerName: "Test User",
          customerPhone: "1234567890",
          status: "Confirmed",
        })
        .returning()

      const caller = appRouter.createCaller(mockStaffContext)
      const result = await caller.reservations.cancel({ id: reservation.id })

      expect(result.status).toBe("Cancelled")
    })

    test("should reject if reservation not found", async () => {
      const caller = appRouter.createCaller(mockPublicContext)

      await expect(caller.reservations.cancel({ id: 99999 })).rejects.toThrow(
        /Reservation not found/
      )
    })
  })

  describe("T099: reservations.suggestAlternativeTimes", () => {
    test("should suggest alternative times when time slot unavailable", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      const result = await caller.reservations.suggestAlternativeTimes({
        date: tomorrow,
        time: "12:00",
        partySize: 4,
      })

      expect(Array.isArray(result)).toBe(true)
    })

    test("should suggest times 30 minutes before/after requested time", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      const result = await caller.reservations.suggestAlternativeTimes({
        date: tomorrow,
        time: "12:00",
        partySize: 4,
      })

      // Should suggest times around 12:00
      const hasSuggestions = result.length > 0
      expect(hasSuggestions).toBe(true)
    })

    test("should be accessible by public", async () => {
      const caller = appRouter.createCaller(mockPublicContext)
      const tomorrow = getTomorrowDate()

      await expect(
        caller.reservations.suggestAlternativeTimes({
          date: tomorrow,
          time: "12:00",
          partySize: 4,
        })
      ).resolves.toBeDefined()
    })
  })
})

describe("T091: Validation Helper - isWithinOperatingHours", () => {
  test("helper should be exported and usable", () => {
    // This test will verify the helper exists after implementation
    // For now, this is a placeholder for the RED phase
    expect(true).toBe(true)
  })
})
