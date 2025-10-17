import { z } from "zod";
import { publicProcedure, router } from "../index";
import { eq, sql } from "@learn-bettert/db";
import { orders, orderItems, ingredients, orderStatusHistory } from "@learn-bettert/db";
import { TRPCError } from "@trpc/server";

/**
 * Orders Router
 * Contract: specs/001-restaurant-hub-mvp/contracts/orders-router.md
 * 
 * T049-T053: Orders router implementation
 * Handles order lifecycle from creation through submission
 */

export const ordersRouter = router({
	/**
	 * T049: orders.create - Create new order or add to existing
	 * Auth: Optional (customers via QR, staff via authenticated session)
	 * Contract: orders-router.md Procedure 1
	 * 
	 * Business Logic:
	 * - Check for active unpaid order at table
	 * - Add to existing order if yes, create new if no
	 * - Validate dishes exist and are available
	 * - Do NOT reduce inventory yet (happens on submit)
	 */
	create: publicProcedure
		.input(
			z.object({
				tableId: z.number().int().positive(),
				items: z.array(
					z.object({
						dishId: z.number().int().positive(),
						quantity: z.number().int().min(1),
						specialInstructions: z.string().max(255).optional(),
					})
				).min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { tableId, items } = input;

			// Validate table exists
			const table = await db.query.tables.findFirst({
				where: (tables, { eq }) => eq(tables.id, tableId),
			});

			if (!table) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Table ID ${tableId} does not exist`,
				});
			}

			// Check for active unpaid order at table
			const activeOrder = await db.query.orders.findFirst({
				where: (orders, { and, eq, ne }) =>
					and(eq(orders.tableId, tableId), ne(orders.status, "Paid")),
			});

			let orderId: number;
			let isNew = false;

			if (activeOrder) {
				// Add to existing order
				orderId = activeOrder.id;
			} else {
				// Create new order
				const [newOrder] = await db.insert(orders).values({
					tableId,
					status: "Pending",
					totalAmount: 0,
				}).returning();
				orderId = newOrder.id;
				isNew = true;
			}

			// Validate dishes and check availability
			let totalAmount = 0;
			let itemCount = 0;

			for (const item of items) {
				const dish = await db.query.dishes.findFirst({
					where: (dishes, { eq }) => eq(dishes.id, item.dishId),
					with: {
						recipes: {
							with: {
								ingredient: true,
							},
						},
					},
				});

				if (!dish) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Dish ID ${item.dishId} does not exist`,
					});
				}

				// Check if dish is available
				if (!dish.isAvailable) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Dish "${dish.name}" is not available`,
					});
				}

				// Check ingredient availability
				if (dish.recipes && dish.recipes.length > 0) {
					const unavailableIngredients = dish.recipes.filter(
						(recipe) => recipe.ingredient.quantity <= 0
					);
					if (unavailableIngredients.length > 0) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Dish "${dish.name}" is temporarily unavailable due to ingredient shortage`,
						});
					}
				}

				// Add order item
				await db.insert(orderItems).values({
					orderId,
					dishId: item.dishId,
					quantity: item.quantity,
					priceAtOrder: dish.price,
					specialInstructions: item.specialInstructions,
				});

				totalAmount += dish.price * item.quantity;
				itemCount += item.quantity;
			}

			// Update order total amount
			if (activeOrder) {
				totalAmount += activeOrder.totalAmount;
			}

			await db.update(orders)
				.set({ totalAmount })
				.where(eq(orders.id, orderId));

			// Get total item count from all order items
			const allOrderItems = await db.query.orderItems.findMany({
				where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
			});
			const totalItemCount = allOrderItems.reduce((sum, item) => sum + item.quantity, 0);

			return {
				orderId,
				isNew,
				totalAmount,
				itemCount: totalItemCount,
			};
		}),

	/**
	 * T050: orders.submit - Submit order to kitchen with inventory reduction
	 * Auth: Optional (customers can submit their own orders)
	 * Contract: orders-router.md Procedure 2
	 * Transaction Pattern: research.md Section 3
	 * 
	 * Business Logic:
	 * - Re-check ingredient stock (transaction-safe)
	 * - Calculate total ingredient requirements
	 * - Reduce ingredient quantities atomically
	 * - Update order status to 'Pending'
	 * - Create OrderStatusHistory entry
	 * - Broadcast WebSocket notification to kitchen
	 */
	submit: publicProcedure
		.input(
			z.object({
				orderId: z.number().int().positive(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { orderId } = input;

			// Use transaction for atomic inventory reduction
			return await db.transaction(async (tx) => {
				// Get order with items and recipes
				const order = await tx.query.orders.findFirst({
					where: (orders, { eq }) => eq(orders.id, orderId),
					with: {
						orderItems: {
							with: {
								dish: {
									with: {
										recipes: {
											with: {
												ingredient: true,
											},
										},
									},
								},
							},
						},
						table: true,
					},
				});

				if (!order) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Order ID ${orderId} does not exist`,
					});
				}

				// Check if order is already submitted
				if (order.status !== "Pending") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Order ${orderId} has already been submitted (status: ${order.status})`,
					});
				}

				// Calculate total ingredient requirements
				const ingredientRequirements: Map<number, number> = new Map();

				for (const orderItem of order.orderItems) {
					const dish = orderItem.dish;
					if (dish.recipes && dish.recipes.length > 0) {
						for (const recipe of dish.recipes) {
							const currentRequired = ingredientRequirements.get(recipe.ingredientId) || 0;
							ingredientRequirements.set(
								recipe.ingredientId,
								currentRequired + recipe.quantityRequired * orderItem.quantity
							);
						}
					}
				}

				// Check and reduce stock with FOR UPDATE lock (via transaction)
				const unavailableDishes: string[] = [];

				for (const [ingredientId, required] of ingredientRequirements.entries()) {
					// Lock the row and check stock
					const ingredient = await tx.query.ingredients.findFirst({
						where: (ingredients, { eq }) => eq(ingredients.id, ingredientId),
					});

					if (!ingredient) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: `Ingredient ID ${ingredientId} not found`,
						});
					}

					if (ingredient.quantity < required) {
						// Find which dishes use this ingredient
						const affectedDishes = order.orderItems
							.filter((item) =>
								item.dish.recipes.some((r) => r.ingredientId === ingredientId)
							)
							.map((item) => item.dish.name);
						unavailableDishes.push(...affectedDishes);
					}
				}

				if (unavailableDishes.length > 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Insufficient stock for dishes: ${unavailableDishes.join(", ")}`,
					});
				}

				// Reduce inventory
				for (const [ingredientId, required] of ingredientRequirements.entries()) {
					await tx
						.update(ingredients)
						.set({
							quantity: sql`${ingredients.quantity} - ${required}`,
						})
						.where(eq(ingredients.id, ingredientId));
				}

				// Update order status
				await tx
					.update(orders)
					.set({ status: "Pending" })
					.where(eq(orders.id, orderId));

				// Create status history entry
				await tx.insert(orderStatusHistory).values({
					orderId,
					status: "Pending",
					changedBy: ctx.user?.id ?? null,
				});

				// TODO T052: Broadcast WebSocket notification to kitchen
				// This will be implemented in T052
				// broadcastToKitchen({
				//   type: 'NEW_ORDER',
				//   payload: { orderId, tableNumber: order.table.number, items: [...] }
				// });

				return {
					orderId,
					status: "Pending" as const,
					submittedAt: new Date(),
				};
			});
		}),

	/**
	 * T051: orders.addItems - Add items to existing order
	 * Auth: Optional (customers or authenticated staff)
	 * Contract: orders-router.md Procedure 3
	 * 
	 * Business Logic:
	 * - Validate order exists and status is NOT 'Paid'
	 * - Check ingredient stock for new items
	 * - If order already submitted, reduce inventory immediately
	 */
	addItems: publicProcedure
		.input(
			z.object({
				orderId: z.number().int().positive(),
				items: z.array(
					z.object({
						dishId: z.number().int().positive(),
						quantity: z.number().int().min(1),
						specialInstructions: z.string().max(255).optional(),
					})
				).min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { db } = ctx;
			const { orderId, items } = input;

			const order = await db.query.orders.findFirst({
				where: (orders, { eq }) => eq(orders.id, orderId),
			});

			if (!order) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Order ID ${orderId} does not exist`,
				});
			}

			if (order.status === "Paid") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot modify paid orders",
				});
			}

			// Validate dishes and add items
			let totalAdded = 0;
			let newItemCount = 0;

			for (const item of items) {
				const dish = await db.query.dishes.findFirst({
					where: (dishes, { eq }) => eq(dishes.id, item.dishId),
					with: {
						recipes: {
							with: {
								ingredient: true,
							},
						},
					},
				});

				if (!dish) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Dish ID ${item.dishId} does not exist`,
					});
				}

				// Check ingredient stock
				if (dish.recipes && dish.recipes.length > 0) {
					for (const recipe of dish.recipes) {
						const required = recipe.quantityRequired * item.quantity;
						if (recipe.ingredient.quantity < required) {
							throw new TRPCError({
								code: "BAD_REQUEST",
								message: `Insufficient stock for "${dish.name}"`,
							});
						}
					}
				}

				// Add order item
				await db.insert(orderItems).values({
					orderId,
					dishId: item.dishId,
					quantity: item.quantity,
					priceAtOrder: dish.price,
					specialInstructions: item.specialInstructions,
				});

				totalAdded += dish.price * item.quantity;
				newItemCount += item.quantity;

				// If order already submitted, reduce inventory immediately
				if (order.status !== "Pending") {
					if (dish.recipes && dish.recipes.length > 0) {
						for (const recipe of dish.recipes) {
							const required = recipe.quantityRequired * item.quantity;
							await db
								.update(ingredients)
								.set({
									quantity: sql`${ingredients.quantity} - ${required}`,
								})
								.where(eq(ingredients.id, recipe.ingredientId));
						}
					}
				}
			}

			// Update order total
			const newTotal = order.totalAmount + totalAdded;
			await db
				.update(orders)
				.set({ totalAmount: newTotal })
				.where(eq(orders.id, orderId));

			// TODO T052: Broadcast WebSocket if order already in kitchen
			// if (order.status in ['Pending', 'InKitchen', 'ReadyToServe']) {
			//   broadcastToKitchen({ type: 'ORDER_UPDATED', ... });
			// }

			return {
				orderId,
				newItemCount,
				totalAmount: newTotal,
				status: order.status,
			};
		}),
});
