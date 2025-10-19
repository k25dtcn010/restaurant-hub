import { TRPCError } from "@trpc/server"
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"
import { z } from "zod"

import { managerOnlyProcedure, protectedProcedure, router } from "../index"
import { shiftStaff, shifts, user } from "@/db"

/**
 * Shifts Router
 * Contract: specs/002-advanced-ops-management/contracts/shifts-router.md
 *
 * T017: Shifts router skeleton (temporary implementations)
 * Handles operational shift and session management
 */

export const shiftsRouter = router({
  /**
   * shifts.start - Start a new operational shift
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.start
   */
  start: managerOnlyProcedure
    .input(
      z
        .object({
          shiftType: z.enum(["Breakfast", "Lunch", "Dinner", "Custom"]),
          customTypeName: z.string().min(1).max(50).optional(),
          staffIds: z.array(z.string()).optional(), // User IDs are strings in auth schema
          notes: z.string().max(500).optional(),
        })
        .refine(
          (data) => {
            if (data.shiftType === "Custom") {
              return data.customTypeName != null && data.customTypeName.length > 0
            }
            return true
          },
          { message: "customTypeName is required when shiftType is Custom" }
        )
    )
    .mutation(async ({ input, ctx }) => {
      // T114-GREEN: Implement shifts.start
      const { shiftType, customTypeName, staffIds = [], notes } = input

      // Determine the shift type name
      const shiftTypeName = shiftType === "Custom" ? customTypeName! : shiftType

      // Create the shift
      const result = await ctx.db
        .insert(shifts)
        .values({
          shiftType: shiftTypeName,
          startTime: new Date(),
          endTime: null,
          totalOrders: null,
          totalRevenue: null,
          notes: notes || null,
          createdById: ctx.user!.id,
        })
        .returning()

      const newShift = result[0]
      if (!newShift) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create shift",
        })
      }

      // Assign staff members if provided
      if (staffIds.length > 0) {
        await ctx.db.insert(shiftStaff).values(
          staffIds.map((userId) => ({
            shiftId: newShift.id,
            userId,
            role: "Staff", // Default role, could be customized later
          }))
        )
      }

      // Fetch assigned staff details
      const staffDetails = staffIds.length > 0
        ? await ctx.db.query.user.findMany({
            where: inArray(user.id, staffIds),
            columns: {
              id: true,
              name: true,
              email: true,
            },
          })
        : []

      return {
        id: newShift.id,
        shiftType: newShift.shiftType,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        totalOrders: newShift.totalOrders,
        totalRevenue: newShift.totalRevenue,
        staff: staffDetails,
      }
    }),

  /**
   * shifts.end - End an active shift and generate summary
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.end
   */
  end: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // T115-GREEN: Implement shifts.end with summary calculation
      const { id, notes } = input

      // Find the shift
      const existingShift = await ctx.db.query.shifts.findFirst({
        where: eq(shifts.id, id),
      })

      if (!existingShift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shift not found",
        })
      }

      if (existingShift.endTime !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Shift has already ended",
        })
      }

      // Calculate totalOrders and totalRevenue from orders linked to this shift
      const { orders } = await import("@/db")
      
      // Count orders in this shift
      const orderCountResult = await ctx.db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.shiftId, id))
      
      const totalOrders = orderCountResult[0]?.count || 0

      // Sum total revenue from paid orders
      const revenueResult = await ctx.db
        .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(and(
          eq(orders.shiftId, id),
          eq(orders.status, "Paid")
        ))
      
      const totalRevenue = revenueResult[0]?.total || 0

      // Update shift with end time and summary
      const result = await ctx.db
        .update(shifts)
        .set({
          endTime: new Date(),
          totalOrders,
          totalRevenue,
          notes: notes || existingShift.notes,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, id))
        .returning()

      const updatedShift = result[0]
      if (!updatedShift) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update shift",
        })
      }

      // Get staff details
      const staffMembers = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
        })
        .from(shiftStaff)
        .innerJoin(user, eq(shiftStaff.userId, user.id))
        .where(eq(shiftStaff.shiftId, id))

      return {
        id: updatedShift.id,
        shiftType: updatedShift.shiftType,
        startTime: updatedShift.startTime,
        endTime: updatedShift.endTime!,
        totalOrders: updatedShift.totalOrders!,
        totalRevenue: updatedShift.totalRevenue!,
        staff: staffMembers,
      }
    }),

  /**
   * shifts.listActive - List all currently active shifts
   * Auth: Manager/Staff
   * Contract: shifts-router.md § shifts.listActive
   */
  listActive: protectedProcedure.query(async ({ ctx }) => {
    // T116-GREEN: List all active shifts
    const { orders } = await import("@/db")
    
    // Get active shifts (where endTime IS NULL)
    const activeShifts = await ctx.db.query.shifts.findMany({
      where: isNull(shifts.endTime),
      orderBy: [asc(shifts.startTime)],
    })

    // For each shift, get staff and order count
    const shiftsWithDetails = await Promise.all(
      activeShifts.map(async (shift) => {
        // Get staff
        const staffMembers = await ctx.db
          .select({
            id: user.id,
            name: user.name,
          })
          .from(shiftStaff)
          .innerJoin(user, eq(shiftStaff.userId, user.id))
          .where(eq(shiftStaff.shiftId, shift.id))

        // Count orders
        const orderCountResult = await ctx.db
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.shiftId, shift.id))

        const currentOrderCount = orderCountResult[0]?.count || 0

        // Calculate duration in minutes
        const duration = Math.floor(
          (Date.now() - shift.startTime.getTime()) / 60000
        )

        return {
          id: shift.id,
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          duration,
          currentOrderCount,
          staff: staffMembers,
        }
      })
    )

    return shiftsWithDetails
  }),

  /**
   * shifts.listHistory - List shift history with filters
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.listHistory
   */
  listHistory: managerOnlyProcedure
    .input(
      z.object({
        startDate: z.string().optional(), // ISO date (contract uses startDate, not dateFrom)
        endDate: z.string().optional(), // ISO date
        shiftType: z.enum(["Breakfast", "Lunch", "Dinner", "Custom"]).optional(),
        staffId: z.string().optional(), // User IDs are strings
      })
    )
    .query(async ({ input, ctx }) => {
      // T117-GREEN: List historical shifts with filters
      const { startDate, endDate, shiftType: filterShiftType, staffId } = input

      // Build where conditions
      const conditions: any[] = []

      // Only ended shifts (endTime IS NOT NULL)
      conditions.push(sql`${shifts.endTime} IS NOT NULL`)

      // Date range filter
      if (startDate) {
        const startDateTime = new Date(startDate)
        conditions.push(gte(shifts.startTime, startDateTime))
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999) // End of day
        conditions.push(lte(shifts.startTime, endDateTime))
      }

      // Shift type filter
      if (filterShiftType) {
        conditions.push(eq(shifts.shiftType, filterShiftType))
      }

      let endedShifts

      // Staff ID filter requires a join
      if (staffId) {
        endedShifts = await ctx.db
          .selectDistinct({
            id: shifts.id,
            shiftType: shifts.shiftType,
            startTime: shifts.startTime,
            endTime: shifts.endTime,
            totalOrders: shifts.totalOrders,
            totalRevenue: shifts.totalRevenue,
          })
          .from(shifts)
          .innerJoin(shiftStaff, eq(shiftStaff.shiftId, shifts.id))
          .where(and(...conditions, eq(shiftStaff.userId, staffId)))
          .orderBy(desc(shifts.startTime))
      } else {
        endedShifts = await ctx.db.query.shifts.findMany({
          where: and(...conditions),
          orderBy: [desc(shifts.startTime)],
        })
      }

      // Get staff for each shift
      const shiftsWithStaff = await Promise.all(
        endedShifts.map(async (shift) => {
          const staffMembers = await ctx.db
            .select({
              id: user.id,
              name: user.name,
            })
            .from(shiftStaff)
            .innerJoin(user, eq(shiftStaff.userId, user.id))
            .where(eq(shiftStaff.shiftId, shift.id))

          return {
            id: shift.id,
            shiftType: shift.shiftType,
            startTime: shift.startTime,
            endTime: shift.endTime!,
            totalOrders: shift.totalOrders || 0,
            totalRevenue: shift.totalRevenue || 0,
            staff: staffMembers,
          }
        })
      )

      return shiftsWithStaff
    }),

  /**
   * shifts.addStaff - Add staff member to an active shift
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.addStaff
   */
  addStaff: managerOnlyProcedure
    .input(
      z.object({
        shiftId: z.number(),
        staffIds: z.array(z.string()).min(1), // Changed to match contract and user ID type
      })
    )
    .mutation(async ({ input, ctx }) => {
      // T118-GREEN: Add staff to active shift
      const { shiftId, staffIds } = input

      // Verify shift exists
      const existingShift = await ctx.db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
      })

      if (!existingShift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shift not found",
        })
      }

      // Check if shift is active
      if (existingShift.endTime !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add staff to ended shift",
        })
      }

      // Add staff members using onConflictDoNothing for idempotent behavior
      // Insert all at once with conflict resolution
      if (staffIds.length > 0) {
        await ctx.db
          .insert(shiftStaff)
          .values(
            staffIds.map((userId) => ({
              shiftId,
              userId,
              role: "Staff",
            }))
          )
          .onConflictDoNothing()
      }

      // Count how many staff are now assigned to get accurate count
      const staffCount = await ctx.db
        .select({ count: count() })
        .from(shiftStaff)
        .where(
          and(
            eq(shiftStaff.shiftId, shiftId),
            inArray(shiftStaff.userId, staffIds)
          )
        )

      return {
        success: true,
        addedCount: staffCount[0]?.count || 0, // Return current count (might include pre-existing)
      }
    }),

  /**
   * shifts.removeStaff - Remove staff member from a shift
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.removeStaff
   */
  removeStaff: managerOnlyProcedure
    .input(
      z.object({
        shiftId: z.number(),
        staffIds: z.array(z.string()).min(1), // Changed to match contract and user ID type
      })
    )
    .mutation(async ({ input, ctx }) => {
      // T119-GREEN: Remove staff from shift
      const { shiftId, staffIds } = input

      // Verify shift exists
      const existingShift = await ctx.db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
      })

      if (!existingShift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shift not found",
        })
      }

      // Remove staff members
      await ctx.db
        .delete(shiftStaff)
        .where(
          and(
            eq(shiftStaff.shiftId, shiftId),
            inArray(shiftStaff.userId, staffIds)
          )
        )

      // Return count of staff IDs requested for removal (optimistic count)
      return {
        success: true,
        removedCount: staffIds.length,
      }
    }),
})
