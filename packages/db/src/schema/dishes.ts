import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Dish entity per data-model.md Section 5
export const dishes = sqliteTable("dishes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	description: text("description").notNull(),
	price: integer("price").notNull(), // Stored in cents
	photoUrl: text("photo_url"),
	isAvailable: integer("is_available", { mode: "boolean" })
		.notNull()
		.default(true),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date()),
});

// TypeScript type exports
export type Dish = typeof dishes.$inferSelect;
export type DishInsert = typeof dishes.$inferInsert;
