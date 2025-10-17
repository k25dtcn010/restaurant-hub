import { sqliteTable, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { dishes } from "./dishes";
import { ingredients } from "./ingredients";

// Recipe entity (join table) per data-model.md Section 7
export const recipes = sqliteTable(
	"recipes",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		dishId: integer("dish_id")
			.notNull()
			.references(() => dishes.id, { onDelete: "cascade" }),
		ingredientId: integer("ingredient_id")
			.notNull()
			.references(() => ingredients.id, { onDelete: "restrict" }),
		quantityRequired: real("quantity_required").notNull(),
	},
	(table) => ({
		// Composite uniqueness: one ingredient per dish
		dishIngredientIdx: uniqueIndex("idx_recipe_dish_ingredient").on(
			table.dishId,
			table.ingredientId,
		),
	}),
);

// Relations
export const recipesRelations = relations(recipes, ({ one }) => ({
	dish: one(dishes, {
		fields: [recipes.dishId],
		references: [dishes.id],
	}),
	ingredient: one(ingredients, {
		fields: [recipes.ingredientId],
		references: [ingredients.id],
	}),
}));

// TypeScript type exports
export type Recipe = typeof recipes.$inferSelect;
export type RecipeInsert = typeof recipes.$inferInsert;

export type RecipeWithIngredient = Recipe & {
	ingredient: typeof ingredients.$inferSelect;
};
