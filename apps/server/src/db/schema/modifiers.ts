import { relations } from "drizzle-orm"
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core"

import { dishes } from "./dishes"
import { orderItems } from "./order-items"

// Modifier entity per data-model.md Section 1.1
export const modifiers = sqliteTable("modifiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  priceAdjustment: integer("price_adjustment").notNull(), // Stored in cents, can be negative/0/+
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

// ModifierGroup entity per data-model.md Section 1.2
export const modifierGroups = sqliteTable("modifier_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  minSelections: integer("min_selections"),
  maxSelections: integer("max_selections"),
  displayOrder: integer("display_order").notNull().default(0),
})

// DishModifier join table per data-model.md Section 1.3
export const dishModifiers = sqliteTable(
  "dish_modifiers",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id),
    modifierId: integer("modifier_id")
      .notNull()
      .references(() => modifiers.id),
    modifierGroupId: integer("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dishId, table.modifierId] }),
  })
)

// OrderItemModifier join table per data-model.md Section 1.4
export const orderItemModifiers = sqliteTable(
  "order_item_modifiers",
  {
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    modifierId: integer("modifier_id")
      .notNull()
      .references(() => modifiers.id),
    name: text("name").notNull(), // Historical snapshot
    priceAtOrder: integer("price_at_order").notNull(), // Historical price in cents
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orderItemId, table.modifierId] }),
  })
)

// Relations per data-model.md Section 1
export const modifiersRelations = relations(modifiers, ({ many }) => ({
  dishModifiers: many(dishModifiers),
  orderItemModifiers: many(orderItemModifiers),
}))

export const modifierGroupsRelations = relations(modifierGroups, ({ many }) => ({
  dishModifiers: many(dishModifiers),
}))

export const dishModifiersRelations = relations(dishModifiers, ({ one }) => ({
  dish: one(dishes, {
    fields: [dishModifiers.dishId],
    references: [dishes.id],
  }),
  modifier: one(modifiers, {
    fields: [dishModifiers.modifierId],
    references: [modifiers.id],
  }),
  modifierGroup: one(modifierGroups, {
    fields: [dishModifiers.modifierGroupId],
    references: [modifierGroups.id],
  }),
}))

export const orderItemModifiersRelations = relations(orderItemModifiers, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemModifiers.orderItemId],
    references: [orderItems.id],
  }),
  modifier: one(modifiers, {
    fields: [orderItemModifiers.modifierId],
    references: [modifiers.id],
  }),
}))

// TypeScript type exports
export type Modifier = typeof modifiers.$inferSelect
export type ModifierInsert = typeof modifiers.$inferInsert
export type ModifierGroup = typeof modifierGroups.$inferSelect
export type ModifierGroupInsert = typeof modifierGroups.$inferInsert
export type DishModifier = typeof dishModifiers.$inferSelect
export type DishModifierInsert = typeof dishModifiers.$inferInsert
export type OrderItemModifier = typeof orderItemModifiers.$inferSelect
export type OrderItemModifierInsert = typeof orderItemModifiers.$inferInsert
