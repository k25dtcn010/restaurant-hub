import { relations } from "drizzle-orm"
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core"

import { dishes } from "./dishes"

// Category entity per data-model.md Section 2.1
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  iconUrl: text("icon_url"),
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

// DishCategory join table per data-model.md Section 2.2
export const dishCategories = sqliteTable(
  "dish_categories",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dishId, table.categoryId] }),
  })
)

// Relations per data-model.md Section 2
export const categoriesRelations = relations(categories, ({ many }) => ({
  dishCategories: many(dishCategories),
}))

export const dishCategoriesRelations = relations(dishCategories, ({ one }) => ({
  dish: one(dishes, {
    fields: [dishCategories.dishId],
    references: [dishes.id],
  }),
  category: one(categories, {
    fields: [dishCategories.categoryId],
    references: [categories.id],
  }),
}))

// TypeScript type exports
export type Category = typeof categories.$inferSelect
export type CategoryInsert = typeof categories.$inferInsert
export type DishCategory = typeof dishCategories.$inferSelect
export type DishCategoryInsert = typeof dishCategories.$inferInsert
