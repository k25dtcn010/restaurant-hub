import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { orders } from "./orders";

// Payment entity per data-model.md Section 9
export const payments = sqliteTable("payments", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	orderId: integer("order_id")
		.notNull()
		.unique()
		.references(() => orders.id), // 1:1 relationship
	amount: integer("amount").notNull(), // Payment amount in cents
	method: text("method", { enum: ["Cash"] })
		.notNull()
		.default("Cash"), // MVP: Cash only
	paidAt: integer("paid_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

// Relations
export const paymentsRelations = relations(payments, ({ one }) => ({
	order: one(orders, {
		fields: [payments.orderId],
		references: [orders.id],
	}),
}));

// TypeScript type exports
export type Payment = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;

export type PaymentWithOrder = Payment & {
	order: typeof orders.$inferSelect;
};
