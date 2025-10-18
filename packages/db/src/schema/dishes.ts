import { relations } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { recipes } from "./recipes"

// Dish entity per data-model.md Section 5
export const dishes = sqliteTable("dishes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // Stored in cents
  photoUrl: text("photo_url"),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  // New columns per data-model.md Section 4.1 (Dish Extensions)
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
  isRecommended: integer("is_recommended", { mode: "boolean" }).notNull().default(false),
  isChefSpecial: integer("is_chef_special", { mode: "boolean" }).notNull().default(false),
  orderPriority: integer("order_priority").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

// Relations
export const dishesRelations = relations(dishes, ({ many }) => ({
  recipes: many(recipes),
}))

// TypeScript type exports
export type Dish = typeof dishes.$inferSelect
export type DishInsert = typeof dishes.$inferInsert
