import { z } from "zod";
import { router, managerOnlyProcedure } from "../index";
import { eq } from "@learn-bettert/db";
import { ingredients } from "@learn-bettert/db";
import { TRPCError } from "@trpc/server";

/**
 * Inventory Router
 * Contract: specs/001-restaurant-hub-mvp/contracts/inventory-router.md
 * 
 * T099-T103: Inventory router implementation
 * Handles ingredient inventory tracking, stock adjustments, and low-stock alerts
 * 
 * Phase 7 - User Story 5: Inventory Management
 * All procedures require Manager role
 */

export const inventoryRouter = router({
	/**
	 * T099: inventory.getAll - Get all ingredients with low-stock calculation
	 * Auth: Manager only
	 * Contract: inventory-router.md Procedure 1
	 * 
	 * Business Logic:
	 * - Calculate isLowStock flag for each ingredient (quantity < threshold)
	 * - Sort by isLowStock DESC, name ASC (low-stock items first)
	 * - Optionally include which dishes use each ingredient
	 */
	getAll: managerOnlyProcedure
		.input(
			z.object({
				includeRecipes: z.boolean().optional().default(false),
			}),
		)
		.query(async ({ input, ctx }) => {
			const { db } = ctx;
			const { includeRecipes } = input;

			// Get all ingredients with optional recipes relation
			const allIngredients = await db.query.ingredients.findMany({
				...(includeRecipes && {
					with: {
						recipes: {
							with: {
								dish: true,
							},
						},
					},
				}),
			});

			// Map ingredients and calculate isLowStock
			const ingredientsWithStatus = allIngredients.map((ingredient) => {
				const isLowStock = ingredient.quantity < ingredient.threshold;

				const baseIngredient = {
					id: ingredient.id,
					name: ingredient.name,
					quantity: ingredient.quantity,
					unit: ingredient.unit,
					threshold: ingredient.threshold,
					isLowStock,
					updatedAt: ingredient.updatedAt,
				};

				if (includeRecipes && 'recipes' in ingredient && ingredient.recipes && Array.isArray(ingredient.recipes)) {
					return {
						...baseIngredient,
						usedInDishes: ingredient.recipes.map((recipe: any) => ({
							dishId: recipe.dish.id,
							dishName: recipe.dish.name,
							quantityRequired: recipe.quantityRequired,
						})),
					};
				}

				return baseIngredient;
			});

			// Sort: low-stock items first, then by name
			ingredientsWithStatus.sort((a, b) => {
				if (a.isLowStock && !b.isLowStock) return -1;
				if (!a.isLowStock && b.isLowStock) return 1;
				return a.name.localeCompare(b.name);
			});

			return { ingredients: ingredientsWithStatus };
		}),

	/**
	 * T100: inventory.getById - Get ingredient details with dish usage
	 * Auth: Manager only
	 * Contract: inventory-router.md Procedure 2
	 */
	getById: managerOnlyProcedure
		.input(
			z.object({
				ingredientId: z.number().int().positive(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const { db } = ctx;
			const { ingredientId } = input;

			const ingredient = await db.query.ingredients.findFirst({
				where: (ingredients, { eq }) => eq(ingredients.id, ingredientId),
				with: {
					recipes: {
						with: {
							dish: true,
						},
					},
				},
			});

			if (!ingredient) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Ingredient with ID ${ingredientId} not found`,
				});
			}

			const isLowStock = ingredient.quantity < ingredient.threshold;

			return {
				id: ingredient.id,
				name: ingredient.name,
				quantity: ingredient.quantity,
				unit: ingredient.unit,
				threshold: ingredient.threshold,
				isLowStock,
				usedInDishes: ingredient.recipes.map((recipe) => ({
					dishId: recipe.dish.id,
					dishName: recipe.dish.name,
					quantityRequired: recipe.quantityRequired,
				})),
				updatedAt: ingredient.updatedAt,
			};
		}),

	/**
	 * T101: inventory.adjustStock - Manually adjust ingredient stock
	 * Auth: Manager only
	 * Contract: inventory-router.md Procedure 3
	 * 
	 * Business Logic:
	 * - Validate new quantity will not be negative
	 * - Update quantity and updatedAt timestamp
	 * - Check if crosses threshold and trigger alert (future: WebSocket notification)
	 */
	adjustStock: managerOnlyProcedure
		.input(
			z.object({
				ingredientId: z.number().int().positive(),
				adjustment: z.number(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { ingredientId, adjustment } = input;

			// Get current ingredient
			const ingredient = await db.query.ingredients.findFirst({
				where: (ingredients, { eq }) => eq(ingredients.id, ingredientId),
			});

			if (!ingredient) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Ingredient with ID ${ingredientId} not found`,
				});
			}

			const oldQuantity = ingredient.quantity;
			const newQuantity = oldQuantity + adjustment;

			// Validate new quantity
			if (newQuantity < 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Adjustment would result in negative quantity: ${oldQuantity} + ${adjustment} = ${newQuantity}`,
				});
			}

			// Update ingredient
			const [updated] = await db
				.update(ingredients)
				.set({
					quantity: newQuantity,
					updatedAt: new Date(),
				})
				.where(eq(ingredients.id, ingredientId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update ingredient",
				});
			}

			// TODO: Log adjustment in audit trail if reason provided
			// TODO: Trigger WebSocket notification if crossing threshold

			return {
				ingredientId: updated.id,
				oldQuantity,
				newQuantity: updated.quantity,
				adjustment,
				updatedAt: updated.updatedAt,
			};
		}),

	/**
	 * T102: inventory.updateThreshold - Set low-stock alert threshold
	 * Auth: Manager only
	 * Contract: inventory-router.md Procedure 4
	 * 
	 * Business Logic:
	 * - Validate threshold is non-negative
	 * - Update threshold
	 * - Recompute isLowStock status
	 * - Trigger alert notification if newly below threshold
	 */
	updateThreshold: managerOnlyProcedure
		.input(
			z.object({
				ingredientId: z.number().int().positive(),
				threshold: z.number().nonnegative(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { ingredientId, threshold } = input;

			// Get current ingredient
			const ingredient = await db.query.ingredients.findFirst({
				where: (ingredients, { eq }) => eq(ingredients.id, ingredientId),
			});

			if (!ingredient) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Ingredient with ID ${ingredientId} not found`,
				});
			}

			// Update threshold
			const [updated] = await db
				.update(ingredients)
				.set({
					threshold,
					updatedAt: new Date(),
				})
				.where(eq(ingredients.id, ingredientId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update ingredient threshold",
				});
			}

			// Recompute isLowStock status
			const isLowStock = updated.quantity < updated.threshold;

			// TODO: Trigger WebSocket notification if newly below threshold

			return {
				ingredientId: updated.id,
				threshold: updated.threshold,
				isLowStock,
				updatedAt: updated.updatedAt,
			};
		}),
});
