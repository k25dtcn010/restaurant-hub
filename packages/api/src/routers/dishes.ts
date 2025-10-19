import { z } from "zod"
import { dishes, eq, recipes } from "@learn-bettert/db"

import { managerOnlyProcedure, publicProcedure, router } from "../index"

/**
 * Dishes Router
 * Contract: specs/001-restaurant-hub-mvp/contracts/dishes-router.md
 *
 * T046-T048: Dishes router implementation
 * Handles menu display and dish management
 */

export const dishesRouter = router({
  /**
   * T046: dishes.getAll - Get all dishes with stock availability check
   * Auth: Public
   * Contract: dishes-router.md Procedure 1
   *
   * Business Logic:
   * - Join with Recipe and Ingredient to compute isAvailable flag
   * - Dish is unavailable if any required ingredient has quantity = 0
   * - Filter by isAvailable if includeDisabled = false (default)
   * 
   * T019: Extended with flag fields (isRecommended, isChefSpecial, isHidden, orderPriority)
   * and includeHidden filter
   */
  getAll: publicProcedure
    .input(
      z.object({
        includeDisabled: z.boolean().optional().default(false),
        includeHidden: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const { includeDisabled, includeHidden } = input

      // Get all dishes
      const allDishes = await db.query.dishes.findMany({
        with: {
          recipes: {
            with: {
              ingredient: true,
            },
          },
        },
      })

      // Compute isAvailable based on ingredient stock
      const dishes = allDishes.map((dish) => {
        // Check if dish is enabled and all ingredients are in stock
        let isAvailable = dish.isAvailable

        if (isAvailable && dish.recipes && dish.recipes.length > 0) {
          // Check if any required ingredient has quantity = 0
          const hasOutOfStockIngredient = dish.recipes.some(
            (recipe) => recipe.ingredient.quantity <= 0
          )
          if (hasOutOfStockIngredient) {
            isAvailable = false
          }
        }

        return {
          id: dish.id,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          photoUrl: dish.photoUrl,
          isAvailable,
          // T019: Add flag fields
          isHidden: dish.isHidden,
          isRecommended: dish.isRecommended,
          isChefSpecial: dish.isChefSpecial,
          orderPriority: dish.orderPriority,
          createdAt: dish.createdAt,
        }
      })

      // Filter out disabled dishes if requested
      let filteredDishes = includeDisabled ? dishes : dishes.filter((dish) => dish.isAvailable)
      
      // T019: Filter out hidden dishes unless includeHidden is true
      if (!includeHidden) {
        filteredDishes = filteredDishes.filter((dish) => !dish.isHidden)
      }

      return { dishes: filteredDishes }
    }),

  /**
   * T047: dishes.getById - Get dish details with recipe
   * Auth: Public
   * Contract: dishes-router.md Procedure 2
   * 
   * T019: Extended with variants array and flag fields
   */
  getById: publicProcedure
    .input(
      z.object({
        dishId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const { dishId } = input

      const dish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, dishId),
        with: {
          recipes: {
            with: {
              ingredient: true,
            },
          },
          // T019: Include variants
          dishVariants: {
            orderBy: (dishVariants, { asc }) => [asc(dishVariants.displayOrder)],
          },
        },
      })

      if (!dish) {
        throw new Error(`Dish ID ${dishId} does not exist`)
      }

      // Compute isAvailable
      let isAvailable = dish.isAvailable
      if (isAvailable && dish.recipes && dish.recipes.length > 0) {
        const hasOutOfStockIngredient = dish.recipes.some(
          (recipe) => recipe.ingredient.quantity <= 0
        )
        if (hasOutOfStockIngredient) {
          isAvailable = false
        }
      }

      // Map recipe with ingredient details
      const recipe = dish.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        ingredientName: r.ingredient.name,
        quantityRequired: r.quantityRequired,
        unit: r.ingredient.unit,
        currentStock: r.ingredient.quantity,
      }))

      // T019: Map variants
      const variants = dish.dishVariants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        displayOrder: v.displayOrder,
      }))

      return {
        id: dish.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        photoUrl: dish.photoUrl,
        isAvailable,
        // T019: Add flag fields
        isHidden: dish.isHidden,
        isRecommended: dish.isRecommended,
        isChefSpecial: dish.isChefSpecial,
        orderPriority: dish.orderPriority,
        recipe,
        // T019: Add variants array
        variants,
        createdAt: dish.createdAt,
        updatedAt: dish.updatedAt,
      }
    }),

  /**
   * dishes.create - Create new dish with recipe
   * Auth: Manager only
   * Contract: dishes-router.md Procedure 3
   */
  create: managerOnlyProcedure
    .input(
      z.object({
        name: z.string().max(100),
        description: z.string().max(500),
        price: z.number().int().min(0),
        photoUrl: z.string().url().nullable().optional(),
        recipe: z.array(
          z.object({
            ingredientId: z.number().int().positive(),
            quantityRequired: z.number().positive(),
          })
        ),
        // T052: Add flag fields to create procedure
        isRecommended: z.boolean().optional().default(false),
        isChefSpecial: z.boolean().optional().default(false),
        orderPriority: z.number().int().min(0).max(100).optional().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { name, description, price, photoUrl, recipe, isRecommended, isChefSpecial, orderPriority } = input

      // Validate all ingredient IDs exist
      for (const item of recipe) {
        const ingredient = await db.query.ingredients.findFirst({
          where: (ingredients, { eq }) => eq(ingredients.id, item.ingredientId),
        })
        if (!ingredient) {
          throw new Error(`Ingredient ID ${item.ingredientId} does not exist`)
        }
      }

      // Create dish
      const [dish] = await db
        .insert(dishes)
        .values({
          name,
          description,
          price,
          photoUrl: photoUrl ?? null,
          isAvailable: true,
          // T052: Add flag fields to insert
          isRecommended,
          isChefSpecial,
          orderPriority,
        })
        .returning()

      if (!dish) {
        throw new Error("Failed to create dish")
      }

      // Create recipe entries
      for (const item of recipe) {
        await db.insert(recipes).values({
          dishId: dish.id,
          ingredientId: item.ingredientId,
          quantityRequired: item.quantityRequired,
        })
      }

      return {
        dishId: dish.id,
        name: dish.name,
        price: dish.price,
      }
    }),

  /**
   * dishes.update - Update dish details
   * Auth: Manager only
   * Contract: dishes-router.md Procedure 4
   * 
   * T052: Extended with flag fields (isRecommended, isChefSpecial, orderPriority)
   */
  update: managerOnlyProcedure
    .input(
      z.object({
        dishId: z.number().int().positive(),
        name: z.string().max(100).optional(),
        description: z.string().max(500).optional(),
        price: z.number().int().min(0).optional(),
        photoUrl: z.string().url().nullable().optional(),
        recipe: z
          .array(
            z.object({
              ingredientId: z.number().int().positive(),
              quantityRequired: z.number().positive(),
            })
          )
          .optional(),
        // T052: Add flag fields with validation
        isRecommended: z.boolean().optional(),
        isChefSpecial: z.boolean().optional(),
        orderPriority: z.number().int().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { dishId, name, description, price, photoUrl, recipe, isRecommended, isChefSpecial, orderPriority } = input

      const dish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, dishId),
      })

      if (!dish) {
        throw new Error(`Dish ID ${dishId} does not exist`)
      }

      const updates: any = {}
      const updatedFields: string[] = []

      if (name !== undefined) {
        updates.name = name
        updatedFields.push("name")
      }
      if (description !== undefined) {
        updates.description = description
        updatedFields.push("description")
      }
      if (price !== undefined) {
        updates.price = price
        updatedFields.push("price")
      }
      if (photoUrl !== undefined) {
        updates.photoUrl = photoUrl
        updatedFields.push("photoUrl")
      }
      // T052: Add flag field updates
      if (isRecommended !== undefined) {
        updates.isRecommended = isRecommended
        updatedFields.push("isRecommended")
      }
      if (isChefSpecial !== undefined) {
        updates.isChefSpecial = isChefSpecial
        updatedFields.push("isChefSpecial")
      }
      if (orderPriority !== undefined) {
        updates.orderPriority = orderPriority
        updatedFields.push("orderPriority")
      }

      if (Object.keys(updates).length > 0) {
        await db.update(dishes).set(updates).where(eq(dishes.id, dishId))
      }

      // Update recipe if provided
      if (recipe !== undefined) {
        // Validate ingredient IDs
        for (const item of recipe) {
          const ingredient = await db.query.ingredients.findFirst({
            where: (ingredients, { eq }) => eq(ingredients.id, item.ingredientId),
          })
          if (!ingredient) {
            throw new Error(`Ingredient ID ${item.ingredientId} does not exist`)
          }
        }

        // Delete existing recipes
        await db.delete(recipes).where(eq(recipes.dishId, dishId))

        // Create new recipe entries
        for (const item of recipe) {
          await db.insert(recipes).values({
            dishId,
            ingredientId: item.ingredientId,
            quantityRequired: item.quantityRequired,
          })
        }
        updatedFields.push("recipe")
      }

      return {
        dishId,
        updatedFields,
        updatedAt: new Date(),
      }
    }),

  /**
   * dishes.toggleAvailability - Enable/disable dish
   * Auth: Manager only
   * Contract: dishes-router.md Procedure 5
   */
  toggleAvailability: managerOnlyProcedure
    .input(
      z.object({
        dishId: z.number().int().positive(),
        isAvailable: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { dishId, isAvailable } = input

      const dish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, dishId),
      })

      if (!dish) {
        throw new Error(`Dish ID ${dishId} does not exist`)
      }

      await db.update(dishes).set({ isAvailable }).where(eq(dishes.id, dishId))

      return {
        dishId,
        isAvailable,
        updatedAt: new Date(),
      }
    }),

  /**
   * dishes.delete - Soft delete dish
   * Auth: Manager only
   * Contract: dishes-router.md Procedure 6
   */
  delete: managerOnlyProcedure
    .input(
      z.object({
        dishId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { dishId } = input

      const dish = await db.query.dishes.findFirst({
        where: (dishes, { eq }) => eq(dishes.id, dishId),
      })

      if (!dish) {
        throw new Error(`Dish ID ${dishId} does not exist`)
      }

      // Check if dish exists in order items
      const orderItems = await db.query.orderItems.findMany({
        where: (orderItems, { eq }) => eq(orderItems.dishId, dishId),
        limit: 1,
      })

      if (orderItems.length > 0) {
        // Soft delete: set isAvailable = false
        await db.update(dishes).set({ isAvailable: false }).where(eq(dishes.id, dishId))
      } else {
        // Hard delete: remove from database
        await db.delete(dishes).where(eq(dishes.id, dishId))
      }

      return {
        dishId,
        deleted: true,
      }
    }),
})
