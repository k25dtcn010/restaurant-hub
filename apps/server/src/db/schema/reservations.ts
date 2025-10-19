import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"

// OperatingHours entity per data-model.md Section 6.1
export const operatingHours = sqliteTable(
  "operating_hours",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    openTime: text("open_time").notNull(), // HH:MM format
    closeTime: text("close_time").notNull(), // HH:MM format
    isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    dayOfWeekIdx: unique().on(table.dayOfWeek),
  })
)

// Reservation entity per data-model.md Section 6.2
export const reservations = sqliteTable(
  "reservations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // YYYY-MM-DD format
    time: text("time").notNull(), // HH:MM format (30-min slots)
    partySize: integer("party_size").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    notes: text("notes"),
    status: text("status").notNull(), // Pending, Confirmed, Seated, No-Show, Cancelled, Declined
    assignedTableIds: text("assigned_table_ids"), // JSON array of table IDs
    declineReason: text("decline_reason"),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
    seatedAt: integer("seated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    dateTimeIdx: index("reservations_date_time_idx").on(table.date, table.time),
    statusIdx: index("reservations_status_idx").on(table.status),
  })
)

// Relations per data-model.md Section 6
export const operatingHoursRelations = relations(operatingHours, () => ({}))

export const reservationsRelations = relations(reservations, () => ({}))

// TypeScript type exports
export type OperatingHours = typeof operatingHours.$inferSelect
export type OperatingHoursInsert = typeof operatingHours.$inferInsert
export type Reservation = typeof reservations.$inferSelect
export type ReservationInsert = typeof reservations.$inferInsert
