import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { orders } from "./orders";
import { dishes } from "./dishes";

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
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		// Indexes per data-model.md Indexes and Performance section
		orderIdIdx: index("idx_order_items_order_id").on(table.orderId),
		dishIdIdx: index("idx_order_items_dish_id").on(table.dishId),
	}),
);

// TypeScript type exports
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderItemInsert = typeof orderItems.$inferInsert;

export type OrderItemWithDish = OrderItem & {
	dish: typeof dishes.$inferSelect;
};
