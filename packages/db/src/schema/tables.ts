import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Table entity per data-model.md Section 2
export const tables = sqliteTable("tables", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	number: integer("number").notNull().unique(),
	qrCode: text("qr_code").notNull().unique(),
	capacity: integer("capacity").notNull().default(4),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

// TypeScript type exports
export type Table = typeof tables.$inferSelect;
export type TableInsert = typeof tables.$inferInsert;
