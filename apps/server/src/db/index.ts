import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

// Import all schemas
import * as authSchema from "./schema/auth"
import * as categoriesSchema from "./schema/categories"
import * as dishesSchema from "./schema/dishes"
import * as ingredientsSchema from "./schema/ingredients"
// New schemas per spec 002-advanced-ops-management
import * as modifiersSchema from "./schema/modifiers"
import * as orderItemsSchema from "./schema/order-items"
import * as orderStatusHistorySchema from "./schema/order-status-history"
import * as ordersSchema from "./schema/orders"
import * as paymentsSchema from "./schema/payments"
import * as recipesSchema from "./schema/recipes"
import * as reservationsSchema from "./schema/reservations"
import * as shiftsSchema from "./schema/shifts"
import * as tablesSchema from "./schema/tables"
import * as variantsSchema from "./schema/variants"

// Create database client
// Note: DATABASE_URL must be set in environment before importing this module
// Default to in-memory database for testing if not set
const databaseUrl = process.env.DATABASE_URL || "file::memory:?cache=shared"
if (!process.env.DATABASE_URL) {
  console.warn(
    "⚠️  DATABASE_URL not set, using in-memory database. Load .env for persistent storage."
  )
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

// Combine all schemas for Drizzle (including relations)
const schema = {
  ...authSchema,
  ...tablesSchema,
  ...dishesSchema,
  ...ingredientsSchema,
  ...recipesSchema,
  ...ordersSchema,
  ...orderItemsSchema,
  ...orderStatusHistorySchema,
  ...paymentsSchema,
  ...modifiersSchema,
  ...categoriesSchema,
  ...variantsSchema,
  ...reservationsSchema,
  ...shiftsSchema,
}

export const db = drizzle({ client, schema })

// Export drizzle helpers for queries
export {
  eq,
  and,
  ne,
  inArray,
  sql,
  or,
  gt,
  lt,
  gte,
  lte,
  like,
  asc,
  desc,
  count,
} from "drizzle-orm"

// Export all schemas and types per data-model.md Type Exports Summary
export * from "./schema/auth"
export * from "./schema/tables"
export * from "./schema/dishes"
export * from "./schema/ingredients"
export * from "./schema/recipes"
export * from "./schema/orders"
export * from "./schema/order-items"
export * from "./schema/order-status-history"
export * from "./schema/payments"
export * from "./schema/modifiers"
export * from "./schema/categories"
export * from "./schema/variants"
export * from "./schema/reservations"
export * from "./schema/shifts"

// Type-safe schema access
export const dbSchema = schema
