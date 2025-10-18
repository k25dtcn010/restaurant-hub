import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { and, asc, categories, count, dishCategories, dishes, eq, inArray } from "@learn-bettert/db"

import { managerOnlyProcedure, publicProcedure, router } from "../index"

/**
 * Categories Router
 * Contract: specs/002-advanced-ops-management/contracts/categories-router.md
 *
 * T015: Categories router skeleton with implementations
 * Handles category management and dish organization
 */

export const categoriesRouter = router({
  /**
   * categories.list - List all categories with optional visibility filtering
   * Auth: Public (customers see only visible categories)
   * Contract: categories-router.md § categories.list
   *
   * Business Logic:
   * - Filter by isHidden if visibleOnly = true
   * - Join with dish_categories to count dishes per category
   * - Order by displayOrder ASC
   */
  list: publicProcedure
    .input(
      z.object({
        visibleOnly: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const { visibleOnly } = input

      // Build the base query
      let query = db
        .select({
          id: categories.id,
          name: categories.name,
          displayOrder: categories.displayOrder,
          iconUrl: categories.iconUrl,
          isHidden: categories.isHidden,
          dishCount: count(dishCategories.dishId),
        })
        .from(categories)
        .leftJoin(dishCategories, eq(categories.id, dishCategories.categoryId))
        .groupBy(categories.id)
        .orderBy(asc(categories.displayOrder))

      // Apply visibility filter if requested
      if (visibleOnly) {
        query = query.where(eq(categories.isHidden, false)) as any
      }

      const result = await query

      return result
    }),

  /**
   * categories.create - Create a new category
   * Auth: Manager only
   * Contract: categories-router.md § categories.create
   */
  create: managerOnlyProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        displayOrder: z.number().int().default(0),
        iconUrl: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx

      try {
        const [category] = await db
          .insert(categories)
          .values({
            name: input.name,
            displayOrder: input.displayOrder,
            iconUrl: input.iconUrl ?? null,
          })
          .returning()

        return category
      } catch (error: any) {
        // Handle duplicate name error
        if (error.message?.includes("UNIQUE constraint")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A category with this name already exists",
          })
        }
        throw error
      }
    }),

  /**
   * categories.update - Update an existing category
   * Auth: Manager only
   * Contract: categories-router.md § categories.update
   */
  update: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        displayOrder: z.number().int().optional(),
        iconUrl: z.string().url().nullable().optional(),
        isHidden: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { id, ...updateData } = input

      // Check if category exists
      const existing = await db.query.categories.findFirst({
        where: (categories, { eq }) => eq(categories.id, id),
      })

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        })
      }

      // Build update object with only provided fields
      const updates: any = {}
      if (updateData.name !== undefined) updates.name = updateData.name
      if (updateData.displayOrder !== undefined) updates.displayOrder = updateData.displayOrder
      if (updateData.iconUrl !== undefined) updates.iconUrl = updateData.iconUrl
      if (updateData.isHidden !== undefined) updates.isHidden = updateData.isHidden

      // Always update the updatedAt timestamp
      updates.updatedAt = new Date()

      const [updated] = await db
        .update(categories)
        .set(updates)
        .where(eq(categories.id, id))
        .returning()

      return updated
    }),

  /**
   * categories.toggleVisibility - Hide or show a category (soft delete pattern)
   * Auth: Manager only
   * Contract: categories-router.md § categories.toggleVisibility
   */
  toggleVisibility: managerOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        isHidden: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx

      const [updated] = await db
        .update(categories)
        .set({ 
          isHidden: input.isHidden,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        })
      }

      return {
        id: updated.id,
        isHidden: updated.isHidden,
      }
    }),

  /**
   * categories.listDishes - List all dishes in a specific category
   * Auth: Public
   * Contract: categories-router.md § categories.listDishes
   */
  listDishes: publicProcedure
    .input(
      z.object({
        categoryId: z.number(),
        includeHidden: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx

      // Build the where condition
      const whereCondition = !input.includeHidden
        ? and(
            eq(dishCategories.categoryId, input.categoryId),
            eq(dishes.isHidden, false)
          )
        : eq(dishCategories.categoryId, input.categoryId)

      // Build query with join
      const result = await db
        .select({
          id: dishes.id,
          name: dishes.name,
          description: dishes.description,
          price: dishes.price,
          photoUrl: dishes.photoUrl,
          isAvailable: dishes.isAvailable,
          isHidden: dishes.isHidden,
          isRecommended: dishes.isRecommended,
          isChefSpecial: dishes.isChefSpecial,
        })
        .from(dishCategories)
        .innerJoin(dishes, eq(dishCategories.dishId, dishes.id))
        .where(whereCondition)
        .orderBy(asc(dishes.name))

      return result
    }),

  /**
   * categories.assignDishes - Assign multiple dishes to a category
   * Auth: Manager only
   * Contract: categories-router.md § categories.assignDishes
   */
  assignDishes: managerOnlyProcedure
    .input(
      z.object({
        categoryId: z.number(),
        dishIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx

      // Check if category exists
      const category = await db.query.categories.findFirst({
        where: (categories, { eq }) => eq(categories.id, input.categoryId),
      })

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        })
      }

      // Check if all dishes exist
      const existingDishes = await db
        .select({ id: dishes.id })
        .from(dishes)
        .where(inArray(dishes.id, input.dishIds))

      if (existingDishes.length !== input.dishIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more dish IDs are invalid",
        })
      }

      // Get existing assignments to avoid duplicates
      const existingAssignments = await db
        .select({ dishId: dishCategories.dishId })
        .from(dishCategories)
        .where(
          and(
            eq(dishCategories.categoryId, input.categoryId),
            inArray(dishCategories.dishId, input.dishIds)
          )
        )

      const existingDishIds = new Set(existingAssignments.map((a) => a.dishId))

      // Insert only new assignments (idempotent behavior)
      let assignedCount = 0
      for (const dishId of input.dishIds) {
        if (!existingDishIds.has(dishId)) {
          await db.insert(dishCategories).values({
            categoryId: input.categoryId,
            dishId,
          })
          assignedCount++
        }
      }

      return {
        success: true,
        assignedCount,
      }
    }),

  /**
   * categories.removeDishes - Remove dishes from a category
   * Auth: Manager only
   * Contract: categories-router.md § categories.removeDishes
   */
  removeDishes: managerOnlyProcedure
    .input(
      z.object({
        categoryId: z.number(),
        dishIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx

      // Count before deletion
      const beforeCount = await db
        .select({ count: count() })
        .from(dishCategories)
        .where(
          and(
            eq(dishCategories.categoryId, input.categoryId),
            inArray(dishCategories.dishId, input.dishIds)
          )
        )

      await db
        .delete(dishCategories)
        .where(
          and(
            eq(dishCategories.categoryId, input.categoryId),
            inArray(dishCategories.dishId, input.dishIds)
          )
        )

      return {
        success: true,
        removedCount: beforeCount[0]?.count ?? 0,
      }
    }),

  /**
   * categories.reorder - Batch update display order for categories (drag-and-drop support)
   * Auth: Manager only
   * Contract: categories-router.md § categories.reorder
   */
  reorder: managerOnlyProcedure
    .input(
      z.object({
        categoryOrders: z
          .array(
            z.object({
              id: z.number(),
              displayOrder: z.number().int(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx

      // Update each category's displayOrder in a transaction-like manner
      let updatedCount = 0
      for (const { id, displayOrder } of input.categoryOrders) {
        await db
          .update(categories)
          .set({ displayOrder, updatedAt: new Date() })
          .where(eq(categories.id, id))
        updatedCount++
      }

      return {
        success: true,
        updatedCount,
      }
    }),
})
