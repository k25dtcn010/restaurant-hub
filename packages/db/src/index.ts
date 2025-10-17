import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

// Import all schemas
import * as authSchema from "./schema/auth";
import * as tablesSchema from "./schema/tables";
import * as dishesSchema from "./schema/dishes";
import * as ingredientsSchema from "./schema/ingredients";
import * as recipesSchema from "./schema/recipes";
import * as ordersSchema from "./schema/orders";
import * as orderItemsSchema from "./schema/order-items";
import * as orderStatusHistorySchema from "./schema/order-status-history";
import * as paymentsSchema from "./schema/payments";

// Create database client
// Note: DATABASE_URL must be set in environment before importing this module
if (!process.env.DATABASE_URL) {
	throw new Error(
		"DATABASE_URL environment variable is required. Load .env before importing @repo/db",
	);
}

const client = createClient({
	url: process.env.DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Combine all schemas for Drizzle
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
};

export const db = drizzle({ client, schema });

// Export all schemas and types per data-model.md Type Exports Summary
export * from "./schema/auth";
export * from "./schema/tables";
export * from "./schema/dishes";
export * from "./schema/ingredients";
export * from "./schema/recipes";
export * from "./schema/orders";
export * from "./schema/order-items";
export * from "./schema/order-status-history";
export * from "./schema/payments";
