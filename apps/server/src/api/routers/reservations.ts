import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { and, eq, gte, lte, operatingHours, reservations, tables } from "@/db"

import { managerOnlyProcedure, publicProcedure, router, staffOrManagerProcedure } from "../index"

/**
 * T091: Validation helper - Check if a date/time is within operating hours
 */
async function isWithinOperatingHours(
  db: any,
  dateStr: string,
  timeStr: string
): Promise<{ isValid: boolean; reason?: string }> {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Query operating hours for this day
  const hours = await db.query.operatingHours.findFirst({
    where: (operatingHours: any, { eq }: any) => eq(operatingHours.dayOfWeek, dayOfWeek),
  })

  // If no operating hours configured for this day, reject
  if (!hours) {
    return { isValid: false, reason: "No operating hours configured for this day" }
  }

  // Check if day is closed
  if (hours.isClosed) {
    return { isValid: false, reason: "Restaurant is closed on this day" }
  }

  // Check if time is within operating hours
  if (timeStr < hours.openTime || timeStr > hours.closeTime) {
    return {
      isValid: false,
      reason: `Time must be between ${hours.openTime} and ${hours.closeTime}`,
    }
  }

  return { isValid: true }
}

/**
 * T102: Helper - Calculate reservation duration (default 90 minutes)
 */
function getReservationEndTime(timeStr: string, durationMinutes: number = 90): string {
  const [hours, minutes] = timeStr.split(":").map(Number)
  if (hours === undefined || minutes === undefined) return timeStr

  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60

  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`
}

/**
 * T102: Helper - Check if time ranges overlap (includes buffer)
 */
function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number)
    return h! * 60 + m!
  }

  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)

  return s1 < e2 && s2 < e1
}

/**
 * Reservations Router
 * Contract: specs/002-advanced-ops-management/contracts/reservations-router.md
 * Addendum: specs/002-advanced-ops-management/addendum/table-and-reservation-crud.md
 *
 * T016: Reservations router with complete CRUD operations
 * Handles table reservations, operating hours, and table availability
 */

export const reservationsRouter = router({
  /**
   * reservations.getOperatingHours - Get operating hours for all days
   * Auth: Public
   * Contract: reservations-router.md § reservations.getOperatingHours
   */
  getOperatingHours: publicProcedure.query(async ({ ctx }) => {
    const hours = await ctx.db.query.operatingHours.findMany({
      orderBy: (operatingHours, { asc }) => [asc(operatingHours.dayOfWeek)],
    })
    return hours
  }),

  /**
   * reservations.updateOperatingHours - Update operating hours for a day
   * Auth: Manager only
   * Contract: reservations-router.md § reservations.updateOperatingHours
   */
  updateOperatingHours: managerOnlyProcedure
    .input(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          isClosed: z.boolean().optional().default(false),
        })
        .refine(
          (data) => {
            if (data.isClosed) return true
            return data.openTime < data.closeTime
          },
          { message: "openTime must be before closeTime" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { dayOfWeek, openTime, closeTime, isClosed } = input

      // Check if operating hours already exist for this day
      const existing = await db.query.operatingHours.findFirst({
        where: (operatingHours, { eq }) => eq(operatingHours.dayOfWeek, dayOfWeek),
      })

      if (existing) {
        // Update existing record
        const [updated] = await db
          .update(operatingHours)
          .set({
            openTime,
            closeTime,
            isClosed,
          })
          .where(eq(operatingHours.dayOfWeek, dayOfWeek))
          .returning()

        return updated
      } else {
        // Insert new record
        const [created] = await db
          .insert(operatingHours)
          .values({
            dayOfWeek,
            openTime,
            closeTime,
            isClosed,
          })
          .returning()

        return created
      }
    }),

  /**
   * T092: reservations.create - Create a new reservation (public form, rate-limited)
   * Auth: Public (with rate limiting)
   * Contract: reservations-router.md § reservations.create
   */
  create: publicProcedure
    .input(
      z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
          time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
          partySize: z.number().int().min(1).max(20),
          customerName: z.string().min(1).max(100),
          customerPhone: z.string().min(10).max(20),
          notes: z.string().max(500).optional(),
        })
        .refine(
          (data) => {
            const reservationDate = new Date(data.date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            return reservationDate >= today
          },
          { message: "Reservation date cannot be in the past" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { date, time, partySize, customerName, customerPhone, notes } = input

      // T091: Validate time is within operating hours
      const validation = await isWithinOperatingHours(db, date, time)
      if (!validation.isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Reservation time is outside operating hours: ${validation.reason}`,
        })
      }

      // Create reservation with Pending status
      const [reservation] = await db
        .insert(reservations)
        .values({
          date,
          time,
          partySize,
          customerName,
          customerPhone,
          notes: notes || null,
          status: "Pending",
        })
        .returning()

      // TODO: T100 - Trigger WebSocket notification to staff

      return reservation
    }),

  /**
   * T093: reservations.list - List reservations with filters
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.list
   */
  list: staffOrManagerProcedure
    .input(
      z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(), // exact date filter
        status: z
          .enum(["Pending", "Confirmed", "Seated", "Declined", "No-Show", "Cancelled"])
          .optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(), // date range start
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(), // date range end
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx
      const { date, status, startDate, endDate } = input

      // Build where conditions
      const conditions = []

      // Exact date filter
      if (date) {
        conditions.push(eq(reservations.date, date))
      }

      // Date range filter
      if (startDate) {
        conditions.push(gte(reservations.date, startDate))
      }
      if (endDate) {
        conditions.push(lte(reservations.date, endDate))
      }

      // Status filter
      if (status) {
        conditions.push(eq(reservations.status, status))
      }

      // Query reservations
      const results = await db.query.reservations.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (reservations, { asc }) => [asc(reservations.date), asc(reservations.time)],
      })

      // Parse assignedTableIds from JSON string to array
      return results.map((r) => ({
        ...r,
        assignedTableIds: r.assignedTableIds ? JSON.parse(r.assignedTableIds) : null,
      }))
    }),

  /**
   * T094: reservations.confirm - Confirm a reservation and assign tables
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.confirm
   */
  confirm: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number(),
        assignedTableIds: z.array(z.number()).min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id, assignedTableIds } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending reservations can be confirmed",
        })
      }

      // Update reservation status to Confirmed
      const [updated] = await db
        .update(reservations)
        .set({
          status: "Confirmed",
          assignedTableIds: assignedTableIds ? JSON.stringify(assignedTableIds) : null,
          confirmedAt: new Date(),
        })
        .where(eq(reservations.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update reservation",
        })
      }

      // TODO: T101 - Trigger WebSocket notification

      return {
        ...updated,
        assignedTableIds: updated.assignedTableIds ? JSON.parse(updated.assignedTableIds) : null,
      }
    }),

  /**
   * T095: reservations.decline - Decline a reservation with reason
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.decline
   */
  decline: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number(),
        declineReason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id, declineReason } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending reservations can be declined",
        })
      }

      // Update reservation status to Declined
      const [updated] = await db
        .update(reservations)
        .set({
          status: "Declined",
          declineReason,
        })
        .where(eq(reservations.id, id))
        .returning()

      return updated
    }),

  /**
   * T096: reservations.markSeated - Mark a confirmed reservation as seated
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.markSeated
   */
  markSeated: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Confirmed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only confirmed reservations can be marked as seated",
        })
      }

      // Update reservation status to Seated
      const [updated] = await db
        .update(reservations)
        .set({
          status: "Seated",
          seatedAt: new Date(),
        })
        .where(eq(reservations.id, id))
        .returning()

      // TODO: Auto-create order session for assigned tables (future enhancement)

      return {
        ...updated,
        orderSessionId: null, // Future enhancement
      }
    }),

  /**
   * T097: reservations.markNoShow - Mark a reservation as no-show
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.markNoShow
   */
  markNoShow: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Confirmed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only confirmed reservations can be marked as no-show",
        })
      }

      // Update reservation status to No-Show
      const [updated] = await db
        .update(reservations)
        .set({
          status: "No-Show",
        })
        .where(eq(reservations.id, id))
        .returning()

      return updated
    }),

  /**
   * T098: reservations.cancel - Cancel a reservation (public or staff)
   * Auth: Public
   * Contract: reservations-router.md § reservations.cancel
   */
  cancel: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      // Update reservation status to Cancelled
      const [updated] = await db
        .update(reservations)
        .set({
          status: "Cancelled",
        })
        .where(eq(reservations.id, id))
        .returning()

      return updated
    }),

  /**
   * T099: reservations.suggestAlternativeTimes - Suggest alternative times if requested time unavailable
   * Auth: Public
   * Contract: reservations-router.md § reservations.suggestAlternativeTimes
   */
  suggestAlternativeTimes: publicProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
        time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
        partySize: z.number().int().min(1).max(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx
      const { date, time } = input

      // Get operating hours for the requested date
      const dateObj = new Date(date)
      const dayOfWeek = dateObj.getDay()

      const hours = await db.query.operatingHours.findFirst({
        where: (operatingHours: any, { eq }: any) => eq(operatingHours.dayOfWeek, dayOfWeek),
      })

      if (!hours || hours.isClosed) {
        return []
      }

      // Generate time slots (30 min intervals) within operating hours
      const suggestions: string[] = []
      const timeParts = time.split(":").map(Number)
      const requestedHour = timeParts[0]
      const requestedMin = timeParts[1]

      if (requestedHour === undefined || requestedMin === undefined) {
        return []
      }

      const requestedTotalMin = requestedHour * 60 + requestedMin

      // Suggest times ±30 minutes around requested time
      const offsets = [-60, -30, 30, 60]

      for (const offset of offsets) {
        const totalMin = requestedTotalMin + offset
        const hour = Math.floor(totalMin / 60)
        const min = totalMin % 60
        const suggestedTime = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`

        // Check if within operating hours
        if (suggestedTime >= hours.openTime && suggestedTime <= hours.closeTime) {
          suggestions.push(suggestedTime)
        }
      }

      return suggestions
    }),

  /**
   * T103: reservations.getById - Get a single reservation by ID
   * Auth: Public
   * Addendum: table-and-reservation-crud.md § reservations.getById
   */
  getById: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx
      const { id } = input

      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      // Parse assigned table IDs from JSON string
      return {
        ...reservation,
        assignedTableIds: reservation.assignedTableIds
          ? JSON.parse(reservation.assignedTableIds)
          : null,
      }
    }),

  /**
   * T104: reservations.checkAvailability - Check table availability and get suggestions
   * Auth: Public
   * Addendum: table-and-reservation-crud.md § reservations.checkAvailability
   */
  checkAvailability: publicProcedure
    .input(
      z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/),
          partySize: z.number().int().min(1).max(20),
          excludeReservationId: z.number().optional(),
        })
        .refine(
          (data) => {
            const reservationDate = new Date(data.date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            return reservationDate >= today
          },
          { message: "Reservation date cannot be in the past" }
        )
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx
      const { date, time, partySize, excludeReservationId } = input

      // Check if time is within operating hours
      const validation = await isWithinOperatingHours(db, date, time)
      if (!validation.isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason,
        })
      }

      // Get reservation duration end time
      const reservationEndTime = getReservationEndTime(time)

      // Query confirmed/seated reservations for this date
      const existingReservations = await db.query.reservations.findMany({
        where: (reservations, { eq, and, or, ne }) =>
          and(
            eq(reservations.date, date),
            or(eq(reservations.status, "Confirmed"), eq(reservations.status, "Seated")),
            excludeReservationId ? ne(reservations.id, excludeReservationId) : undefined
          ),
      })

      // Get all tables
      const allTables = await db.query.tables.findMany()

      // Calculate reserved table IDs for this time slot
      const reservedTableIds = new Set<number>()
      for (const reservation of existingReservations) {
        if (
          reservation.assignedTableIds &&
          timeRangesOverlap(
            time,
            reservationEndTime,
            reservation.time,
            getReservationEndTime(reservation.time)
          )
        ) {
          const tableIds = JSON.parse(reservation.assignedTableIds)
          tableIds.forEach((id: number) => reservedTableIds.add(id))
        }
      }

      // Filter available tables by capacity and reservation status
      const availableTables = allTables.filter(
        (table) => !reservedTableIds.has(table.id) && table.capacity >= partySize
      )

      if (availableTables.length > 0) {
        // Available! Return single tables that fit
        return {
          available: true,
          availableTables: availableTables.map((t) => ({
            id: t.id,
            tableNumber: t.number,
            capacity: t.capacity,
            isAvailable: true,
          })),
        }
      }

      // Not available at this time - suggest alternatives
      const suggestedTables: Array<Array<{ id: number; tableNumber: number; capacity: number }>> =
        []
      const suggestedTimes: string[] = []

      // Suggest table combinations if no single table fits
      if (allTables.length > 1) {
        // Simple combination: try 2-table combos that fit party size
        for (let i = 0; i < allTables.length; i++) {
          for (let j = i + 1; j < allTables.length; j++) {
            const table1 = allTables[i]!
            const table2 = allTables[j]!

            if (
              !reservedTableIds.has(table1.id) &&
              !reservedTableIds.has(table2.id) &&
              table1.capacity + table2.capacity >= partySize
            ) {
              suggestedTables.push([
                { id: table1.id, tableNumber: table1.number, capacity: table1.capacity },
                { id: table2.id, tableNumber: table2.number, capacity: table2.capacity },
              ])
            }
          }
        }
      }

      // Suggest alternative times (±30 min, ±60 min)
      const dateObj = new Date(date)
      const dayOfWeek = dateObj.getDay()
      const hours = await db.query.operatingHours.findFirst({
        where: (operatingHours: any, { eq }: any) => eq(operatingHours.dayOfWeek, dayOfWeek),
      })

      if (hours && !hours.isClosed) {
        const timeParts = time.split(":").map(Number)
        const requestedTotalMin = timeParts[0]! * 60 + timeParts[1]!

        const offsets = [-60, -30, 30, 60]
        for (const offset of offsets) {
          const totalMin = requestedTotalMin + offset
          const hour = Math.floor(totalMin / 60)
          const min = totalMin % 60
          const suggestedTime = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`

          // Check if within operating hours
          if (suggestedTime >= hours.openTime && suggestedTime <= hours.closeTime) {
            suggestedTimes.push(suggestedTime)
          }
        }
      }

      return {
        available: false,
        availableTables: [],
        suggestedTableCombinations: suggestedTables.length > 0 ? suggestedTables : undefined,
        suggestedTimes: suggestedTimes.length > 0 ? suggestedTimes : undefined,
        reason: "No single table available at this time. Suggested alternatives listed above.",
      }
    }),

  /**
   * T105: reservations.update - Update pending reservation details
   * Auth: Staff/Manager only
   * Addendum: table-and-reservation-crud.md § reservations.update
   */
  update: staffOrManagerProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          time: z
            .string()
            .regex(/^([01]\d|2[0-3]):(00|30)$/)
            .optional(),
          partySize: z.number().int().min(1).max(20).optional(),
          customerName: z.string().min(1).max(100).optional(),
          customerPhone: z.string().min(10).max(20).optional(),
          notes: z.string().max(500).optional(),
        })
        .refine(
          (data) => {
            if (!data.date) return true
            const reservationDate = new Date(data.date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            return reservationDate >= today
          },
          { message: "Reservation date cannot be in the past" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id, date, time, partySize, customerName, customerPhone, notes } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only update pending reservations",
        })
      }

      // Validate new date/time if provided
      if (date && time) {
        const validation = await isWithinOperatingHours(db, date, time)
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.reason,
          })
        }
      }

      // Build update object with only provided fields
      const updates: any = {}
      if (date !== undefined) updates.date = date
      if (time !== undefined) updates.time = time
      if (partySize !== undefined) updates.partySize = partySize
      if (customerName !== undefined) updates.customerName = customerName
      if (customerPhone !== undefined) updates.customerPhone = customerPhone
      if (notes !== undefined) updates.notes = notes || null
      updates.updatedAt = new Date()

      const [updated] = await db
        .update(reservations)
        .set(updates)
        .where(eq(reservations.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update reservation",
        })
      }

      return updated
    }),

  /**
   * T106: reservations.delete - Delete a pending reservation
   * Auth: Staff/Manager only
   * Addendum: table-and-reservation-crud.md § reservations.delete
   */
  delete: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only delete pending reservations",
        })
      }

      // Hard delete the reservation
      await db.delete(reservations).where(eq(reservations.id, id))

      return {
        id,
        deleted: true,
        deletedAt: new Date(),
      }
    }),

  /**
   * T107: reservations.reassignTables - Reassign tables for a confirmed reservation
   * Auth: Staff/Manager only
   * Addendum: table-and-reservation-crud.md § reservations.reassignTables
   */
  reassignTables: staffOrManagerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        assignedTableIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { id, assignedTableIds } = input

      // Find reservation
      const reservation = await db.query.reservations.findFirst({
        where: (reservations, { eq }) => eq(reservations.id, id),
      })

      if (!reservation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reservation not found",
        })
      }

      if (reservation.status !== "Confirmed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only reassign tables for confirmed reservations",
        })
      }

      // Check if new tables are available (not booked by other reservations at same time)
      const reservationEndTime = getReservationEndTime(reservation.time)

      const conflictingReservations = await db.query.reservations.findMany({
        where: (reservations, { eq, and, or, ne }) =>
          and(
            eq(reservations.date, reservation.date),
            or(eq(reservations.status, "Confirmed"), eq(reservations.status, "Seated")),
            ne(reservations.id, id)
          ),
      })

      // Check if any requested tables conflict with existing reservations
      for (const otherRes of conflictingReservations) {
        if (
          otherRes.assignedTableIds &&
          timeRangesOverlap(
            reservation.time,
            reservationEndTime,
            otherRes.time,
            getReservationEndTime(otherRes.time)
          )
        ) {
          const otherTableIds = JSON.parse(otherRes.assignedTableIds)
          const conflict = assignedTableIds.some((id) => otherTableIds.includes(id))
          if (conflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Tables are already booked by another reservation (ID: ${otherRes.id})`,
            })
          }
        }
      }

      // Update reservation with new table IDs
      const [updated] = await db
        .update(reservations)
        .set({
          assignedTableIds: JSON.stringify(assignedTableIds),
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reassign tables",
        })
      }

      return {
        id: updated.id,
        assignedTableIds: JSON.parse(updated.assignedTableIds || "[]"),
        updatedAt: updated.updatedAt,
      }
    }),
})
