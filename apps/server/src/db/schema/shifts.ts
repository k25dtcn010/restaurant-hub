import { relations } from "drizzle-orm"
import { integer, sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core"

import { user } from "./auth"

// Shift entity per data-model.md Section 7.1
export const shifts = sqliteTable(
  "shifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shiftType: text("shift_type").notNull(), // e.g., "Breakfast", "Lunch", "Dinner", "Custom"
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }), // null = active shift
    totalOrders: integer("total_orders"),
    totalRevenue: integer("total_revenue"), // in cents
    notes: text("notes"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    startTimeIdx: index("shifts_start_time_idx").on(table.startTime),
    endTimeIdx: index("shifts_end_time_idx").on(table.endTime),
  })
)

// ShiftStaff join table per data-model.md Section 7.2
export const shiftStaff = sqliteTable(
  "shift_staff",
  {
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull(), // Role during this shift (e.g., "Server", "Host", "Cook")
  },
  (table) => ({
    pk: primaryKey({ columns: [table.shiftId, table.userId] }),
  })
)

// Relations per data-model.md Section 7
export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [shifts.createdById],
    references: [user.id],
  }),
  shiftStaff: many(shiftStaff),
}))

export const shiftStaffRelations = relations(shiftStaff, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftStaff.shiftId],
    references: [shifts.id],
  }),
  user: one(user, {
    fields: [shiftStaff.userId],
    references: [user.id],
  }),
}))

// TypeScript type exports
export type Shift = typeof shifts.$inferSelect
export type ShiftInsert = typeof shifts.$inferInsert
export type ShiftStaff = typeof shiftStaff.$inferSelect
export type ShiftStaffInsert = typeof shiftStaff.$inferInsert
