import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { eq, asc } from "@learn-bettert/db"

import { managerOnlyProcedure, publicProcedure, router } from "../index"
import { modifiers, dishModifiers } from "@learn-bettert/db"

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
   * T021-GREEN: Implementation
   */
  list: publicProcedure
    .input(
      z.object({
        availableOnly: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx

      return await db.query.modifiers.findMany({
        where: input.availableOnly ? eq(modifiers.isAvailable, true) : undefined,
        orderBy: [asc(modifiers.id)],
      })
    }),

  /**
   * modifiers.create - Create a new modifier
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.create
   * T022-GREEN: Implementation
   */
  create: managerOnlyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        priceAdjustment: z.number().int(),
        isAvailable: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      try {
        const [newModifier] = await db
          .insert(modifiers)
          .values({
            name: input.name,
            priceAdjustment: input.priceAdjustment,
            isAvailable: input.isAvailable,
          })
          .returning()

        return newModifier
      } catch (error: any) {
        // Check for unique constraint violation (duplicate name)
        if (error?.message?.includes("UNIQUE constraint failed")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Modifier with this name already exists",
          })
        }
        throw error
      }
    }),

  /**
   * modifiers.update - Update an existing modifier
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.update
   * T023-GREEN: Implementation
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
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      // First, check if modifier exists
      const existingModifier = await db.query.modifiers.findFirst({
        where: eq(modifiers.id, input.id),
      })

      if (!existingModifier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Modifier not found",
        })
      }

      // Build update object with only provided fields
      const updateData: any = {}
      if (input.name !== undefined) updateData.name = input.name
      if (input.priceAdjustment !== undefined)
        updateData.priceAdjustment = input.priceAdjustment
      if (input.isAvailable !== undefined) updateData.isAvailable = input.isAvailable

      const [updatedModifier] = await db
        .update(modifiers)
        .set(updateData)
        .where(eq(modifiers.id, input.id))
        .returning()

      return updatedModifier
    }),

  /**
   * modifiers.delete - Delete a modifier (only if not assigned to any dishes)
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.delete
   * T024-GREEN: Implementation
   */
  delete: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      // First, check if modifier exists
      const existingModifier = await db.query.modifiers.findFirst({
        where: eq(modifiers.id, input.id),
      })

      if (!existingModifier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Modifier not found",
        })
      }

      // Check if modifier is assigned to any dishes
      const assignments = await db.query.dishModifiers.findMany({
        where: eq(dishModifiers.modifierId, input.id),
      })

      if (assignments.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete modifier assigned to dishes",
        })
      }

      // Delete the modifier
      await db.delete(modifiers).where(eq(modifiers.id, input.id))

      return { success: true }
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
