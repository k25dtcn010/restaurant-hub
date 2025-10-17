import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { orders } from "./orders";
import { user } from "./auth";

// OrderStatusHistory entity per data-model.md Section 8
export const orderStatusHistory = sqliteTable(
	"order_status_history",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		orderId: integer("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		status: text("status").notNull(), // OrderStatus enum value
		changedBy: text("changed_by").references(() => user.id), // Nullable for system changes
		changedAt: integer("changed_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		// Index per data-model.md Indexes and Performance section
		orderIdIdx: index("idx_order_status_history_order_id").on(table.orderId),
	}),
);

// Relations
export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
	order: one(orders, {
		fields: [orderStatusHistory.orderId],
		references: [orders.id],
	}),
	user: one(user, {
		fields: [orderStatusHistory.changedBy],
		references: [user.id],
	}),
}));

// TypeScript type exports
export type OrderStatusHistoryEntry = typeof orderStatusHistory.$inferSelect;
export type OrderStatusHistoryInsert = typeof orderStatusHistory.$inferInsert;

export type OrderStatusHistoryWithUser = OrderStatusHistoryEntry & {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
	} | null;
};
