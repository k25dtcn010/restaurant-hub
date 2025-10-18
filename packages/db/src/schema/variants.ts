import { relations } from "drizzle-orm"
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core"

import { dishes } from "./dishes"
import { ingredients } from "./ingredients"

// DishVariant entity per data-model.md Section 3.1
export const dishVariants = sqliteTable("dish_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id),
  name: text("name").notNull(),
  price: integer("price").notNull(), // Stored in cents (overrides base dish price)
  displayOrder: integer("display_order").notNull().default(0),
})

// VariantRecipe join table per data-model.md Section 3.2
export const variantRecipes = sqliteTable(
  "variant_recipes",
  {
    variantId: integer("variant_id")
      .notNull()
      .references(() => dishVariants.id),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    quantityRequired: integer("quantity_required").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.variantId, table.ingredientId] }),
  })
)

// Relations per data-model.md Section 3
export const dishVariantsRelations = relations(dishVariants, ({ one, many }) => ({
  dish: one(dishes, {
    fields: [dishVariants.dishId],
    references: [dishes.id],
  }),
  variantRecipes: many(variantRecipes),
}))

export const variantRecipesRelations = relations(variantRecipes, ({ one }) => ({
  variant: one(dishVariants, {
    fields: [variantRecipes.variantId],
    references: [dishVariants.id],
  }),
  ingredient: one(ingredients, {
    fields: [variantRecipes.ingredientId],
    references: [ingredients.id],
  }),
}))

// TypeScript type exports
export type DishVariant = typeof dishVariants.$inferSelect
export type DishVariantInsert = typeof dishVariants.$inferInsert
export type VariantRecipe = typeof variantRecipes.$inferSelect
export type VariantRecipeInsert = typeof variantRecipes.$inferInsert
