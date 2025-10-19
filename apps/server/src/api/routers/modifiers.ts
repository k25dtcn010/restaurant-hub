import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { eq, asc } from "@/db"

import { managerOnlyProcedure, publicProcedure, router } from "../index"
import { modifiers, modifierGroups, dishModifiers } from "@/db"

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
   * T025-GREEN: Implementation
   */
  listGroups: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx

    return await db.query.modifierGroups.findMany({
      orderBy: [asc(modifierGroups.displayOrder)],
    })
  }),

  /**
   * modifiers.createGroup - Create a new modifier group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.createGroup
   * T026-GREEN: Implementation
   */
  createGroup: managerOnlyProcedure
    .input(
      z
        .object({
          name: z.string().min(1).max(100),
          minSelections: z.number().int().min(0).optional(),
          maxSelections: z.number().int().min(1).optional(),
          displayOrder: z.number().int().default(0),
        })
        .refine(
          (data) => {
            if (data.minSelections != null && data.maxSelections != null) {
              return data.minSelections <= data.maxSelections
            }
            return true
          },
          { message: "minSelections must be <= maxSelections" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      const [newGroup] = await db
        .insert(modifierGroups)
        .values({
          name: input.name,
          minSelections: input.minSelections ?? null,
          maxSelections: input.maxSelections ?? null,
          displayOrder: input.displayOrder,
        })
        .returning()

      return newGroup
    }),

  /**
   * modifiers.updateGroup - Update a modifier group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.updateGroup
   * T027-GREEN: Implementation
   */
  updateGroup: managerOnlyProcedure
    .input(
      z
        .object({
          id: z.number(),
          name: z.string().min(1).max(100).optional(),
          minSelections: z.number().int().min(0).optional(),
          maxSelections: z.number().int().min(1).optional(),
          displayOrder: z.number().int().optional(),
        })
        .refine(
          (data) => {
            if (data.minSelections != null && data.maxSelections != null) {
              return data.minSelections <= data.maxSelections
            }
            return true
          },
          { message: "minSelections must be <= maxSelections" }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      // Check if group exists
      const existingGroup = await db.query.modifierGroups.findFirst({
        where: eq(modifierGroups.id, input.id),
      })

      if (!existingGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Modifier group not found",
        })
      }

      // Build update object with only provided fields
      const updateData: any = {}
      if (input.name !== undefined) updateData.name = input.name
      if (input.minSelections !== undefined) updateData.minSelections = input.minSelections
      if (input.maxSelections !== undefined) updateData.maxSelections = input.maxSelections
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder

      const [updatedGroup] = await db
        .update(modifierGroups)
        .set(updateData)
        .where(eq(modifierGroups.id, input.id))
        .returning()

      return updatedGroup
    }),

  /**
   * modifiers.deleteGroup - Delete a modifier group (only if not used)
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.deleteGroup
   * T028-GREEN: Implementation
   */
  deleteGroup: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      // Check if group exists
      const existingGroup = await db.query.modifierGroups.findFirst({
        where: eq(modifierGroups.id, input.id),
      })

      if (!existingGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Modifier group not found",
        })
      }

      // Check if group is assigned to any dishes
      const assignments = await db.query.dishModifiers.findMany({
        where: eq(dishModifiers.modifierGroupId, input.id),
      })

      if (assignments.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete modifier group assigned to dishes",
        })
      }

      // Delete the group
      await db.delete(modifierGroups).where(eq(modifierGroups.id, input.id))

      return { success: true }
    }),

  /**
   * modifiers.assignToDish - Assign a modifier to a dish with a group
   * Auth: Manager only
   * Contract: modifiers-router.md § modifiers.assignToDish
   * T029-GREEN: Implementation
   */
  assignToDish: managerOnlyProcedure
    .input(
      z.object({
        dishId: z.number(),
        modifierId: z.number(),
        modifierGroupId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      // Check if assignment already exists
      const existing = await db.query.dishModifiers.findFirst({
        where: (dishModifiers, { and, eq }) =>
          and(
            eq(dishModifiers.dishId, input.dishId),
            eq(dishModifiers.modifierId, input.modifierId)
          ),
      })

      // If already exists, it's idempotent - just return success
      if (existing) {
        return { success: true }
      }

      // Insert new assignment
      await db.insert(dishModifiers).values({
        dishId: input.dishId,
        modifierId: input.modifierId,
        modifierGroupId: input.modifierGroupId,
      })

      return { success: true }
    }),

  /**
   * modifiers.getByDish - Get all modifiers for a specific dish, grouped by modifier group
   * Auth: Public
   * Contract: modifiers-router.md § modifiers.getByDish
   * T030-GREEN: Implementation
   */
  getByDish: publicProcedure
    .input(
      z.object({
        dishId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx

      // Get all dish modifiers for this dish with full details
      const assignments = await db.query.dishModifiers.findMany({
        where: eq(dishModifiers.dishId, input.dishId),
        with: {
          modifier: true,
          modifierGroup: true,
        },
      })

      // Group by modifier group
      const groupedMap = new Map<
        number,
        {
          group: {
            id: number
            name: string
            minSelections: number | null
            maxSelections: number | null
            displayOrder: number
          }
          modifiers: Array<{
            id: number
            name: string
            priceAdjustment: number
            isAvailable: boolean
          }>
        }
      >()

      for (const assignment of assignments) {
        const groupId = assignment.modifierGroup.id

        if (!groupedMap.has(groupId)) {
          groupedMap.set(groupId, {
            group: {
              id: assignment.modifierGroup.id,
              name: assignment.modifierGroup.name,
              minSelections: assignment.modifierGroup.minSelections,
              maxSelections: assignment.modifierGroup.maxSelections,
              displayOrder: assignment.modifierGroup.displayOrder,
            },
            modifiers: [],
          })
        }

        const group = groupedMap.get(groupId)!
        group.modifiers.push({
          id: assignment.modifier.id,
          name: assignment.modifier.name,
          priceAdjustment: assignment.modifier.priceAdjustment,
          isAvailable: assignment.modifier.isAvailable,
        })
      }

      // Convert map to array and sort by displayOrder
      const result = Array.from(groupedMap.values()).sort(
        (a, b) => a.group.displayOrder - b.group.displayOrder
      )

      return result
    }),
})
