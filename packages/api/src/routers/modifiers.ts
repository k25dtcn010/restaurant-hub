import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { managerOnlyProcedure, publicProcedure, router } from "../index"

/**
 * Modifiers Router
 * Contract: specs/002-advanced-ops-management/contracts/modifiers-router.md
 *
 * T014: Modifiers router skeleton (temporary implementations)
 * Handles menu modifier and modifier group management
 */

export const modifiersRouter = router({
  /**
   * modifiers.list - List all modifiers with optional availability filtering
   * Auth: Public
   * Contract: modifiers-router.md § modifiers.list
   */
  list: publicProcedure
    .input(
      z.object({
        availableOnly: z.boolean().optional().default(false),
      })
    )
    .query(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.list in Phase 3",
      })
    }),

  /**
   * modifiers.create - Create a new modifier
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.create
   */
  create: managerOnlyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        priceAdjustment: z.number().int(),
        isAvailable: z.boolean().default(true),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.create in Phase 3",
      })
    }),

  /**
   * modifiers.update - Update an existing modifier
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.update
   */
  update: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        priceAdjustment: z.number().int().optional(),
        isAvailable: z.boolean().optional(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.update in Phase 3",
      })
    }),

  /**
   * modifiers.delete - Delete a modifier (only if not assigned to any dishes)
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.delete
   */
  delete: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.delete in Phase 3",
      })
    }),

  /**
   * modifiers.listGroups - List all modifier groups
   * Auth: Public
   * Contract: modifiers-router.md § modifiers.listGroups
   */
  listGroups: publicProcedure.query(async () => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "TODO: Implement modifiers.listGroups in Phase 3",
    })
  }),

  /**
   * modifiers.createGroup - Create a new modifier group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.createGroup
   */
  createGroup: managerOnlyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        minSelections: z.number().int().min(0).optional(),
        maxSelections: z.number().int().min(1).optional(),
        displayOrder: z.number().int().default(0),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.createGroup in Phase 3",
      })
    }),

  /**
   * modifiers.updateGroup - Update a modifier group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.updateGroup
   */
  updateGroup: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        minSelections: z.number().int().min(0).optional(),
        maxSelections: z.number().int().min(1).optional(),
        displayOrder: z.number().int().optional(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.updateGroup in Phase 3",
      })
    }),

  /**
   * modifiers.deleteGroup - Delete a modifier group (only if not used)
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.deleteGroup
   */
  deleteGroup: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.deleteGroup in Phase 3",
      })
    }),

  /**
   * modifiers.assignToDish - Assign a modifier to a dish with a group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.assignToDish
   */
  assignToDish: managerOnlyProcedure
    .input(
      z.object({
        dishId: z.number(),
        modifierId: z.number(),
        modifierGroupId: z.number(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.assignToDish in Phase 3",
      })
    }),

  /**
   * modifiers.getByDish - Get all modifiers for a specific dish, grouped by modifier group
   * Auth: Public
   * Contract: modifiers-router.md § modifiers.getByDish
   */
  getByDish: publicProcedure
    .input(
      z.object({
        dishId: z.number(),
      })
    )
    .query(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: Implement modifiers.getByDish in Phase 3",
      })
    }),
})
