import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { managerOnlyProcedure, router } from "../index"

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
          staffIds: z.array(z.number()).optional(),
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
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement shifts.start in Phase 8",
      })
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
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement shifts.end in Phase 8",
      })
    }),

  /**
   * shifts.listActive - List all currently active shifts
   * Auth: Manager/Staff
   * Contract: shifts-router.md § shifts.listActive
   */
  listActive: managerOnlyProcedure.query(async () => {
    // Return empty array for now
    return []
  }),

  /**
   * shifts.listHistory - List shift history with filters
   * Auth: Manager only
   * Contract: shifts-router.md § shifts.listHistory
   */
  listHistory: managerOnlyProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(), // ISO date
        dateTo: z.string().optional(), // ISO date
        shiftType: z.enum(["Breakfast", "Lunch", "Dinner", "Custom"]).optional(),
        staffId: z.number().optional(),
      })
    )
    .query(async () => {
      // Return empty array for now
      return []
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
        userId: z.number(),
        role: z.string(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement shifts.addStaff in Phase 8",
      })
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
        userId: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement shifts.removeStaff in Phase 8",
      })
    }),
})
