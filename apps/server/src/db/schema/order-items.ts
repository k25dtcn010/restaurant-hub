import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { dishes } from "./dishes"
import { orders } from "./orders"
import { dishVariants } from "./variants"

// OrderItem entity per data-model.md Section 4
export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id),
    quantity: integer("quantity").notNull(),
    priceAtOrder: integer("price_at_order").notNull(), // Historical price in cents
    specialInstructions: text("special_instructions"),
    // New columns per data-model.md Section 5.1 (Order Items Extensions)
    variantId: integer("variant_id").references(() => dishVariants.id),
    specialRequest: text("special_request"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Indexes per data-model.md Indexes and Performance section
    orderIdIdx: index("idx_order_items_order_id").on(table.orderId),
    dishIdIdx: index("idx_order_items_dish_id").on(table.dishId),
  })
)

// Relations
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  dish: one(dishes, {
    fields: [orderItems.dishId],
    references: [dishes.id],
  }),
  variant: one(dishVariants, {
    fields: [orderItems.variantId],
    references: [dishVariants.id],
  }),
}))

// TypeScript type exports
export type OrderItem = typeof orderItems.$inferSelect
export type OrderItemInsert = typeof orderItems.$inferInsert

export type OrderItemWithDish = OrderItem & {
  dish: typeof dishes.$inferSelect
}
