import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { managerOnlyProcedure, publicProcedure, router } from "../index"

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
  getOperatingHours: publicProcedure.query(async () => {
    // Return empty array for now - will implement in Phase 5
    return []
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
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.updateOperatingHours in Phase 5",
      })
    }),

  /**
   * reservations.create - Create a new reservation (public form, rate-limited)
   * Auth: Public (with rate limiting)
   * Contract: reservations-router.md § reservations.create
   */
  create: publicProcedure
    .input(
      z.object({
        customerName: z.string().min(1).max(100),
        customerPhone: z.string().min(10).max(20),
        customerEmail: z.string().email().optional(),
        partySize: z.number().int().min(1).max(20),
        reservationDate: z.string(), // ISO date
        reservationTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.create in Phase 5",
      })
    }),

  /**
   * reservations.list - List reservations with filters
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.list
   */
  list: managerOnlyProcedure
    .input(
      z.object({
        status: z.enum(["Pending", "Confirmed", "Seated", "Declined", "NoShow", "Cancelled"]).optional(),
        dateFrom: z.string().optional(), // ISO date
        dateTo: z.string().optional(), // ISO date
      })
    )
    .query(async () => {
      // Return empty array for now
      return []
    }),

  /**
   * reservations.confirm - Confirm a reservation and assign tables
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.confirm
   */
  confirm: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        tableIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.confirm in Phase 5",
      })
    }),

  /**
   * reservations.decline - Decline a reservation with reason
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.decline
   */
  decline: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        reason: z.string().min(1).max(200),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.decline in Phase 5",
      })
    }),

  /**
   * reservations.markSeated - Mark a confirmed reservation as seated
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.markSeated
   */
  markSeated: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.markSeated in Phase 5",
      })
    }),

  /**
   * reservations.markNoShow - Mark a reservation as no-show
   * Auth: Staff/Manager only
   * Contract: reservations-router.md § reservations.markNoShow
   */
  markNoShow: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.markNoShow in Phase 5",
      })
    }),

  /**
   * reservations.cancel - Cancel a reservation (public or staff)
   * Auth: Public
   * Contract: reservations-router.md § reservations.cancel
   */
  cancel: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement reservations.cancel in Phase 5",
      })
    }),

  /**
   * reservations.suggestAlternativeTimes - Suggest alternative times if requested time unavailable
   * Auth: Public
   * Contract: reservations-router.md § reservations.suggestAlternativeTimes
   */
  suggestAlternativeTimes: publicProcedure
    .input(
      z.object({
        reservationDate: z.string(), // ISO date
        reservationTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        partySize: z.number().int().min(1).max(20),
      })
    )
    .query(async () => {
      // Return empty array for now
      return []
    }),
})
