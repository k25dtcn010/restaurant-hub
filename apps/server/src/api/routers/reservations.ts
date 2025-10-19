import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { and, eq, gte, lte, operatingHours, reservations } from "@/db"

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
 * Reservations Router
 * Contract: specs/002-advanced-ops-management/contracts/reservations-router.md
 *
 * T016: Reservations router skeleton (temporary implementations)
 * Handles table reservations and operating hours configuration
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
})
