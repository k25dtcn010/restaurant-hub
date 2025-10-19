import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  eq,
  ingredients,
  orderItems,
  orderItemModifiers,
  orders,
  orderStatusHistory,
  sql,
} from "@learn-bettert/db"

import { publicProcedure, router } from "../index"

/**
 * WebSocket Notification Helper
 * T052: WebSocket notification broadcasting
 *
 * WebSocket notifications are now injected via tRPC context from the server.
 * This ensures real-time updates are sent to connected clients when orders change.
 * The actual WebSocket broadcasting happens in apps/server/src/websocket.ts
 */

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
   * 
   * T020: Extended to accept variantId, specialRequest, and modifiers
   * Note: Modifier price calculation will be implemented in Phase 3
   */
  create: publicProcedure
    .input(
      z.object({
        tableId: z.number().int().positive(),
        items: z
          .array(
            z.object({
              dishId: z.number().int().positive(),
              quantity: z.number().int().min(1),
              specialInstructions: z.string().max(255).optional(),
              // T020: NEW fields for advanced operations
              variantId: z.number().optional(), // Selected dish variant (if dish has variants)
              specialRequest: z.string().max(200).optional(), // Customer special request
              modifiers: z
                .array(
                  z.object({
                    modifierId: z.number(),
                    modifierGroupId: z.number(),
                  })
                )
                .optional(), // Selected modifiers
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { tableId, items } = input

      // Validate table exists
      const table = await db.query.tables.findFirst({
        where: (tables, { eq }) => eq(tables.id, tableId),
      })

      if (!table) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Table ID ${tableId} does not exist`,
        })
      }

      // Check for active pending order at table
      // Only add to orders that haven't been submitted yet
      const activeOrder = await db.query.orders.findFirst({
        where: (orders, { and, eq }) =>
          and(eq(orders.tableId, tableId), eq(orders.status, "Pending")),
      })

      let orderId: number
      let isNew = false

      if (activeOrder) {
        // Add to existing order
        orderId = activeOrder.id
      } else {
        // Create new order
        const [newOrder] = await db
          .insert(orders)
          .values({
            tableId,
            status: "Pending",
            totalAmount: 0,
          })
          .returning()

        if (!newOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create order",
          })
        }

        orderId = newOrder.id
        isNew = true
      }

      // Validate dishes and check availability
      let totalAmount = 0
      let itemCount = 0

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
        })

        if (!dish) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Dish ID ${item.dishId} does not exist`,
          })
        }

        // Check if dish is available
        if (!dish.isAvailable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Dish "${dish.name}" is not available`,
          })
        }

        // Check ingredient availability
        if (dish.recipes && dish.recipes.length > 0) {
          const unavailableIngredients = dish.recipes.filter(
            (recipe) => recipe.ingredient.quantity <= 0
          )
          if (unavailableIngredients.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Dish "${dish.name}" is temporarily unavailable due to ingredient shortage`,
            })
          }
        }

        // T031: Validate modifiers belong to dish
        let modifierObjects: Array<{ id: number; name: string; priceAdjustment: number }> = []
        if (item.modifiers && item.modifiers.length > 0) {
          // Get available modifiers for this dish
          const availableModifiers = await db.query.dishModifiers.findMany({
            where: (dishModifiers, { eq }) => eq(dishModifiers.dishId, item.dishId),
            with: {
              modifier: true,
            },
          })

          const availableModifierIds = new Set(availableModifiers.map((dm) => dm.modifier.id))

          // Validate all selected modifiers are available for this dish
          for (const selectedModifier of item.modifiers) {
            if (!availableModifierIds.has(selectedModifier.modifierId)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Modifier is not available for this dish`,
              })
            }

            // Get modifier details for price calculation
            const modifierDetail = availableModifiers.find(
              (dm) => dm.modifier.id === selectedModifier.modifierId
            )
            if (modifierDetail) {
              modifierObjects.push({
                id: modifierDetail.modifier.id,
                name: modifierDetail.modifier.name,
                priceAdjustment: modifierDetail.modifier.priceAdjustment,
              })
            }
          }
        }

        // T032: Calculate item total with modifiers
        const modifierTotal = modifierObjects.reduce((sum, m) => sum + m.priceAdjustment, 0)
        const itemPrice = dish.price + modifierTotal
        const itemTotal = itemPrice * item.quantity

        // Add order item
        const [createdOrderItem] = await db
          .insert(orderItems)
          .values({
            orderId,
            dishId: item.dishId,
            quantity: item.quantity,
            priceAtOrder: dish.price,
            specialInstructions: item.specialInstructions,
            variantId: item.variantId,
            specialRequest: item.specialRequest,
          })
          .returning()

        if (!createdOrderItem) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create order item",
          })
        }

        // T033: Insert modifiers into orderItemModifiers with historical snapshot
        if (modifierObjects.length > 0) {
          for (const modifier of modifierObjects) {
            await db.insert(orderItemModifiers).values({
              orderItemId: createdOrderItem.id,
              modifierId: modifier.id,
              name: modifier.name,
              priceAtOrder: modifier.priceAdjustment,
            })
          }
        }

        totalAmount += itemTotal
        itemCount += item.quantity
      }

      // Update order total amount
      if (activeOrder) {
        totalAmount += activeOrder.totalAmount
      }

      await db.update(orders).set({ totalAmount }).where(eq(orders.id, orderId))

      // Get total item count from all order items
      const allOrderItems = await db.query.orderItems.findMany({
        where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
      })
      const totalItemCount = allOrderItems.reduce((sum, item) => sum + item.quantity, 0)

      return {
        orderId,
        isNew,
        totalAmount,
        itemCount: totalItemCount,
      }
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { orderId } = input

      // Use transaction for atomic inventory reduction
      const result = await db.transaction(async (tx) => {
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
        })

        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Order ID ${orderId} does not exist`,
          })
        }

        // Check if order is already submitted
        if (order.status !== "Pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Order ${orderId} has already been submitted (status: ${order.status})`,
          })
        }

        // Calculate total ingredient requirements
        const ingredientRequirements: Map<number, number> = new Map()

        for (const orderItem of order.orderItems) {
          const dish = orderItem.dish
          if (dish.recipes && dish.recipes.length > 0) {
            for (const recipe of dish.recipes) {
              const currentRequired = ingredientRequirements.get(recipe.ingredientId) || 0
              ingredientRequirements.set(
                recipe.ingredientId,
                currentRequired + recipe.quantityRequired * orderItem.quantity
              )
            }
          }
        }

        // Check and reduce stock with FOR UPDATE lock (via transaction)
        const unavailableDishes: string[] = []

        for (const [ingredientId, required] of ingredientRequirements.entries()) {
          // Lock the row and check stock
          const ingredient = await tx.query.ingredients.findFirst({
            where: (ingredients, { eq }) => eq(ingredients.id, ingredientId),
          })

          if (!ingredient) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Ingredient ID ${ingredientId} not found`,
            })
          }

          if (ingredient.quantity < required) {
            // Find which dishes use this ingredient
            const affectedDishes = order.orderItems
              .filter((item) => item.dish.recipes.some((r) => r.ingredientId === ingredientId))
              .map((item) => item.dish.name)
            unavailableDishes.push(...affectedDishes)
          }
        }

        if (unavailableDishes.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient stock for dishes: ${unavailableDishes.join(", ")}`,
          })
        }

        // Reduce inventory
        for (const [ingredientId, required] of ingredientRequirements.entries()) {
          await tx
            .update(ingredients)
            .set({
              quantity: sql`${ingredients.quantity} - ${required}`,
            })
            .where(eq(ingredients.id, ingredientId))
        }

        // Update order status
        await tx.update(orders).set({ status: "Pending" }).where(eq(orders.id, orderId))

        // Create status history entry
        await tx.insert(orderStatusHistory).values({
          orderId,
          status: "Pending",
          changedBy: ctx.user?.id ?? null,
        })

        return {
          orderId,
          status: "Pending" as const,
          submittedAt: new Date(),
        }
      })

      // T052: Broadcast WebSocket notification to kitchen (after successful transaction)
      // Fetch full order details for notification
      const orderDetails = await db.query.orders.findFirst({
        where: (orders, { eq }) => eq(orders.id, result.orderId),
        with: {
          orderItems: {
            with: {
              dish: true,
            },
          },
          table: true,
        },
      })

      if (orderDetails) {
        ctx.wsNotifier.notifyKitchen({
          id: orderDetails.id,
          tableNumber: orderDetails.table.number,
          items: orderDetails.orderItems.map((item) => ({
            dishName: item.dish.name,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
          })),
          status: orderDetails.status,
          createdAt: orderDetails.createdAt,
        })

        // Also notify of status change to Pending
        ctx.wsNotifier.notifyOrderStatusChanged(result.orderId, "Pending")
      }

      return result
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
        items: z
          .array(
            z.object({
              dishId: z.number().int().positive(),
              quantity: z.number().int().min(1),
              specialInstructions: z.string().max(255).optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { orderId, items } = input

      const order = await db.query.orders.findFirst({
        where: (orders, { eq }) => eq(orders.id, orderId),
      })

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Order ID ${orderId} does not exist`,
        })
      }

      if (order.status === "Paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify paid orders",
        })
      }

      // Validate dishes and add items
      let totalAdded = 0
      let newItemCount = 0

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
        })

        if (!dish) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Dish ID ${item.dishId} does not exist`,
          })
        }

        // Check ingredient stock
        if (dish.recipes && dish.recipes.length > 0) {
          for (const recipe of dish.recipes) {
            const required = recipe.quantityRequired * item.quantity
            if (recipe.ingredient.quantity < required) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Insufficient stock for "${dish.name}"`,
              })
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
        })

        totalAdded += dish.price * item.quantity
        newItemCount += item.quantity

        // If order already submitted, reduce inventory immediately
        if (order.status !== "Pending") {
          if (dish.recipes && dish.recipes.length > 0) {
            for (const recipe of dish.recipes) {
              const required = recipe.quantityRequired * item.quantity
              await db
                .update(ingredients)
                .set({
                  quantity: sql`${ingredients.quantity} - ${required}`,
                })
                .where(eq(ingredients.id, recipe.ingredientId))
            }
          }
        }
      }

      // Update order total
      const newTotal = order.totalAmount + totalAdded
      await db.update(orders).set({ totalAmount: newTotal }).where(eq(orders.id, orderId))

      // T052: Broadcast WebSocket if order already in kitchen
      if (["Pending", "InKitchen", "ReadyToServe"].includes(order.status)) {
        // Fetch updated order details for notification
        const updatedOrder = await db.query.orders.findFirst({
          where: (orders, { eq }) => eq(orders.id, orderId),
          with: {
            orderItems: {
              with: {
                dish: true,
              },
            },
            table: true,
          },
        })

        if (updatedOrder) {
          // Notify kitchen of order update
          ctx.wsNotifier.notifyKitchen({
            id: updatedOrder.id,
            tableNumber: updatedOrder.table.number,
            items: updatedOrder.orderItems.map((item) => ({
              dishName: item.dish.name,
              quantity: item.quantity,
              specialInstructions: item.specialInstructions,
            })),
            status: updatedOrder.status,
            updatedAt: updatedOrder.updatedAt,
            isUpdate: true, // Flag to indicate this is an update
          })

          // Also notify of order modification
          ctx.wsNotifier.notifyOrderStatusChanged(orderId, order.status)
        }
      }

      return {
        orderId,
        newItemCount,
        totalAmount: newTotal,
        status: order.status,
      }
    }),

  /**
   * T064: orders.getKitchenOrders - Get orders for kitchen dashboard
   * Auth: Required (Kitchen Staff, Manager)
   * Contract: orders-router.md Procedure 8
   *
   * Business Logic:
   * - Query orders with kitchen workflow statuses
   * - T054: Sort by dishes.orderPriority DESC (high priority first), then createdAt ASC
   * - Calculate wait time for each order
   */
  getKitchenOrders: publicProcedure
    .input(
      z
        .object({
          status: z.array(z.enum(["Pending", "InKitchen", "ReadyToServe"])).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const statusFilter = input?.status || ["Pending", "InKitchen", "ReadyToServe"]

      // Query orders with specified statuses
      const ordersData = await db.query.orders.findMany({
        where: (orders, { inArray }) => inArray(orders.status, statusFilter as any),
        with: {
          table: true,
          orderItems: {
            with: {
              dish: true,
            },
          },
        },
        orderBy: (orders, { asc }) => [asc(orders.createdAt)],
      })

      // T054: Calculate max priority for each order based on its dishes
      const ordersWithPriority = ordersData.map((order) => {
        // Find the highest orderPriority among all dishes in this order
        const maxPriority = Math.max(
          ...order.orderItems.map((item) => item.dish.orderPriority || 0),
          0
        )
        return {
          ...order,
          maxPriority,
        }
      })

      // T054: Sort by maxPriority DESC (high priority first), then by createdAt ASC (oldest first)
      ordersWithPriority.sort((a, b) => {
        if (a.maxPriority !== b.maxPriority) {
          return b.maxPriority - a.maxPriority // DESC
        }
        return Number(a.createdAt) - Number(b.createdAt) // ASC
      })

      // Transform to match contract output schema
      const now = Date.now()
      const transformedOrders = ordersWithPriority.map((order) => ({
        id: order.id,
        tableNumber: order.table.number,
        status: order.status as "Pending" | "InKitchen" | "ReadyToServe",
        items: order.orderItems.map((item) => ({
          dishName: item.dish.name,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
        })),
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        waitTime: Math.floor((now - Number(order.createdAt)) / (1000 * 60)), // Minutes since created
      }))

      return {
        orders: transformedOrders,
      }
    }),

  /**
   * T065: orders.updateStatus - Update order status with history tracking
   * Auth: Required (role-based permissions)
   * Contract: orders-router.md Procedure 5
   *
   * Business Logic:
   * - Validate order exists
   * - Validate status transition
   * - Update order status
   * - Create status history entry
   * - Broadcast WebSocket notifications
   */
  updateStatus: publicProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        newStatus: z.enum(["Pending", "InKitchen", "ReadyToServe", "Served", "Completed", "Paid"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { orderId, newStatus } = input

      // Get current order
      const order = await db.query.orders.findFirst({
        where: (orders, { eq }) => eq(orders.id, orderId),
        with: {
          table: true,
          orderItems: {
            with: {
              dish: true,
            },
          },
        },
      })

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Order ID ${orderId} does not exist`,
        })
      }

      // Validate status transition (basic validation)
      const currentStatus = order.status
      const validTransitions: Record<string, string[]> = {
        Pending: ["InKitchen"],
        InKitchen: ["ReadyToServe"],
        ReadyToServe: ["Served"],
        Served: ["Completed"],
        Completed: ["Paid"],
        Paid: [], // Terminal state
      }

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        })
      }

      // Update order status
      const updatedAt = Date.now()
      await db
        .update(orders)
        .set({ status: newStatus, updatedAt: sql`${updatedAt}` })
        .where(eq(orders.id, orderId))

      // Create status history entry
      await db.insert(orderStatusHistory).values({
        orderId,
        status: newStatus,
        changedBy: ctx.user?.id ?? null,
      })

      // T066: Broadcast WebSocket notifications for all status changes
      // Always notify about status changes so all connected clients can update
      ctx.wsNotifier.notifyOrderStatusChanged(orderId, newStatus)

      // Send additional role-specific notifications for certain statuses
      if (newStatus === "ReadyToServe") {
        // Also send ORDER_READY event for serving staff
        ctx.wsNotifier.notifyOrderStatusChanged(orderId, "ORDER_READY")
      } else if (newStatus === "Paid") {
        // Also send ORDER_COMPLETED event for managers
        ctx.wsNotifier.notifyOrderStatusChanged(orderId, "ORDER_COMPLETED")
      }

      return {
        orderId,
        status: newStatus,
        updatedAt: new Date(updatedAt),
        changedBy: ctx.user?.id ?? null,
      }
    }),

  /**
   * T067: orders.getById - Get complete order details
   * Auth: Optional (customers can view their table's order, staff can view all)
   * Contract: orders-router.md Procedure 6
   *
   * Business Logic:
   * - Get order with all details
   * - Include status history
   * - Include items with dish details
   */
  getById: publicProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const { orderId } = input

      // Get order with all related data
      // T034: Include orderItemModifiers in the query
      const order = await db.query.orders.findFirst({
        where: (orders, { eq }) => eq(orders.id, orderId),
        with: {
          table: true,
          orderItems: {
            with: {
              dish: true,
              variant: true,
            },
          },
        },
      })

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Order ID ${orderId} does not exist`,
        })
      }

      // Get status history
      const statusHistoryData = await db.query.orderStatusHistory.findMany({
        where: (history, { eq }) => eq(history.orderId, orderId),
        orderBy: (history, { asc }) => [asc(history.changedAt)],
      })

      // T034: Get modifiers for each order item
      const itemsWithModifiers = await Promise.all(
        order.orderItems.map(async (item) => {
          const itemModifiers = await db.query.orderItemModifiers.findMany({
            where: (orderItemModifiers, { eq }) =>
              eq(orderItemModifiers.orderItemId, item.id),
          })

          return {
            id: item.id,
            dishId: item.dishId,
            dishName: item.dish.name,
            quantity: item.quantity,
            priceAtOrder: item.priceAtOrder,
            specialInstructions: item.specialInstructions || null,
            specialRequest: item.specialRequest || null,
            variantId: item.variantId || null,
            variantName: item.variant?.name || null,
            modifiers: itemModifiers.map((m) => ({
              name: m.name,
              priceAtOrder: m.priceAtOrder,
            })),
          }
        })
      )

      // Transform to match contract output schema
      return {
        id: order.id,
        tableId: order.tableId,
        tableNumber: order.table.number,
        status: order.status as
          | "Pending"
          | "InKitchen"
          | "ReadyToServe"
          | "Served"
          | "Completed"
          | "Paid",
        totalAmount: order.totalAmount,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        items: itemsWithModifiers,
        statusHistory: statusHistoryData.map((entry) => ({
          status: entry.status as
            | "Pending"
            | "InKitchen"
            | "ReadyToServe"
            | "Served"
            | "Completed"
            | "Paid",
          changedBy: entry.changedBy ? String(entry.changedBy) : "System",
          changedAt: new Date(entry.changedAt),
        })),
      }
    }),

  /**
   * T085: orders.getServingOrders - Get orders for serving staff
   * Auth: Required (Waiter, Manager)
   * Contract: orders-router.md Procedure 9
   *
   * Business Logic:
   * - Query orders with status in ['ReadyToServe', 'Served']
   * - Join with order_status_history to get readySince timestamp
   * - Calculate waitTime as difference between now and readySince
   * - Sort by waitTime descending (longest waiting first)
   */
  getServingOrders: publicProcedure
    .input(
      z
        .object({
          status: z.array(z.enum(["ReadyToServe", "Served"])).optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input, ctx }) => {
      const { db } = ctx
      const statusFilter = input?.status || ["ReadyToServe", "Served"]

      // Query orders with the specified statuses
      const ordersData = await db.query.orders.findMany({
        where: (orders, { inArray }) => inArray(orders.status, statusFilter),
        with: {
          table: true,
          orderItems: {
            with: {
              dish: true,
            },
          },
        },
      })

      // For each order, get the readySince timestamp from status history
      const ordersWithMetadata = await Promise.all(
        ordersData.map(async (order) => {
          // Get status history to find when order was marked ReadyToServe
          const readyStatusHistory = await db.query.orderStatusHistory.findFirst({
            where: (history, { and, eq }) =>
              and(eq(history.orderId, order.id), eq(history.status, "ReadyToServe")),
            orderBy: (history, { asc }) => [asc(history.changedAt)],
          })

          const readySince = readyStatusHistory ? new Date(readyStatusHistory.changedAt) : null

          // Calculate wait time in minutes
          const now = Date.now()
          const readyTime = readySince ? readySince.getTime() : now
          const waitTime = Math.floor((now - readyTime) / (1000 * 60)) // Convert to minutes

          return {
            id: order.id,
            tableNumber: order.table.number,
            status: order.status as "ReadyToServe" | "Served",
            items: order.orderItems.map((item) => ({
              dishName: item.dish.name,
              quantity: item.quantity,
            })),
            totalAmount: order.totalAmount,
            readySince,
            waitTime,
          }
        })
      )

      // Sort by waitTime descending (longest waiting first)
      ordersWithMetadata.sort((a, b) => b.waitTime - a.waitTime)

      return {
        orders: ordersWithMetadata,
      }
    }),
})
