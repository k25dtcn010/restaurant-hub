import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { orderItems } from "./order-items"
import { orderStatusHistory } from "./order-status-history"
import { shifts } from "./shifts"
import { tables } from "./tables"

// Order status enum per data-model.md Section 3
export const orderStatuses = [
  "Pending",
  "InKitchen",
  "ReadyToServe",
  "Served",
  "Completed",
  "Paid",
] as const

export type OrderStatus = (typeof orderStatuses)[number]

// Order entity per data-model.md Section 3
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tableId: integer("table_id")
      .notNull()
      .references(() => tables.id),
    status: text("status", { enum: orderStatuses }).notNull().default("Pending"),
    totalAmount: integer("total_amount").notNull().default(0), // Stored in cents
    // New column per data-model.md Section 7.3 (Orders Table Update)
    shiftId: integer("shift_id").references(() => shifts.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    // Indexes per data-model.md Indexes and Performance section
    tableIdIdx: index("idx_orders_table_id").on(table.tableId),
    statusIdx: index("idx_orders_status").on(table.status),
    createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
  })
)

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  shift: one(shifts, {
    fields: [orders.shiftId],
    references: [shifts.id],
  }),
  orderItems: many(orderItems),
  statusHistory: many(orderStatusHistory),
}))

// TypeScript type exports
export type Order = typeof orders.$inferSelect
export type OrderInsert = typeof orders.$inferInsert
