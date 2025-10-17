import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

// Ingredient entity per data-model.md Section 6
export const ingredients = sqliteTable("ingredients", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	quantity: real("quantity").notNull().default(0),
	unit: text("unit").notNull(),
	threshold: real("threshold").notNull().default(0),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date()),
});

// TypeScript type exports
export type Ingredient = typeof ingredients.$inferSelect;
export type IngredientInsert = typeof ingredients.$inferInsert;

export type IngredientWithAlert = Ingredient & {
	isLowStock: boolean; // Computed: quantity < threshold
};
