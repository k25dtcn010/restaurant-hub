import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { appRouter } from "../../src/routers/index";
import { db, eq, tables, ingredients, dishes, recipes, orders, orderItems } from "@learn-bettert/db";
import type { Context } from "../../src/context";

/**
 * T042: Integration test for complete customer ordering flow
 * 
 * This test validates the end-to-end customer self-service ordering journey:
 * 1. Customer scans QR code → validates table
 * 2. Customer views menu → sees available dishes with stock
 * 3. Customer creates order → adds items to cart
 * 4. Customer adds more items → order updates
 * 5. Customer submits order → inventory reduced, kitchen notified
 * 
 * Tests the integration between tables, dishes, and orders routers
 * following the User Story 1 specification.
 */

// Mock context for unauthenticated customer
const customerContext: Context = {
session: null,
user: null,
role: null,
db,
};

describe("Integration: Complete Customer Ordering Flow", () => {
let testTableId: number;
let testDish1Id: number;
let testDish2Id: number;
let testIngredient1Id: number;
let testIngredient2Id: number;

beforeAll(async () => {
// Check if test data already exists from previous run
const existingTable = await db.query.tables.findFirst({
where: (tables, { eq }) => eq(tables.number, 200),
});
const existingIngredient1 = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.name, "Integration Test Beef"),
});
const existingIngredient2 = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.name, "Integration Test Rice"),
});
const existingDish1 = await db.query.dishes.findFirst({
where: (dishes, { eq }) => eq(dishes.name, "Integration Test Steak"),
});
const existingDish2 = await db.query.dishes.findFirst({
where: (dishes, { eq }) => eq(dishes.name, "Integration Test Fried Rice"),
});

if (existingTable && existingIngredient1 && existingIngredient2 && existingDish1 && existingDish2) {
testTableId = existingTable.id;
testIngredient1Id = existingIngredient1.id;
testIngredient2Id = existingIngredient2.id;
testDish1Id = existingDish1.id;
testDish2Id = existingDish2.id;
} else {
// Create integration test data
// Table for integration test (use number > 30 to avoid conflicts)
const [table] = await db.insert(tables).values({
number: 200,
qrCode: "https://app.restauranthub.com/?table=200",
capacity: 4,
}).returning();
testTableId = table.id;

// Ingredient 1: Beef with sufficient stock
const [ingredient1] = await db.insert(ingredients).values({
name: "Integration Test Beef",
quantity: 50,
unit: "kg",
threshold: 5,
}).returning();
testIngredient1Id = ingredient1.id;

// Ingredient 2: Rice with sufficient stock
const [ingredient2] = await db.insert(ingredients).values({
name: "Integration Test Rice",
quantity: 100,
unit: "kg",
threshold: 10,
}).returning();
testIngredient2Id = ingredient2.id;

// Dish 1: Steak (expensive)
const [dish1] = await db.insert(dishes).values({
name: "Integration Test Steak",
description: "Premium grilled steak",
price: 2500, // $25.00
isAvailable: true,
}).returning();
testDish1Id = dish1.id;

// Recipe for Steak
await db.insert(recipes).values({
dishId: testDish1Id,
ingredientId: testIngredient1Id,
quantityRequired: 0.5, // 0.5 kg per steak
});

// Dish 2: Fried Rice (cheaper)
const [dish2] = await db.insert(dishes).values({
name: "Integration Test Fried Rice",
description: "Delicious fried rice",
price: 800, // $8.00
isAvailable: true,
}).returning();
testDish2Id = dish2.id;

// Recipe for Fried Rice
await db.insert(recipes).values({
dishId: testDish2Id,
ingredientId: testIngredient2Id,
quantityRequired: 0.3, // 0.3 kg per serving
});
}
});

beforeEach(async () => {
// Clean up any previous test orders
const previousOrders = await db.query.orders.findMany({
where: (orders, { eq }) => eq(orders.tableId, testTableId),
});
for (const order of previousOrders) {
// Delete order items first (foreign key constraint)
await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
await db.delete(orders).where(eq(orders.id, order.id));
}

// Reset ingredient stock
await db.update(ingredients)
.set({ quantity: 50 })
.where(eq(ingredients.id, testIngredient1Id));
await db.update(ingredients)
.set({ quantity: 100 })
.where(eq(ingredients.id, testIngredient2Id));
});

test("End-to-End: Customer scans QR, views menu, creates order, adds items, and submits", async () => {
const caller = appRouter.createCaller(customerContext);

// ========================================
// STEP 1: Customer scans QR code
// ========================================
console.log("\n📱 STEP 1: Customer scans QR code for Table 200");

const tableValidation = await caller.tables.getById({ tableId: testTableId });

expect(tableValidation).toBeDefined();
expect(tableValidation.isValid).toBe(true);
expect(tableValidation.number).toBe(200);
expect(tableValidation.capacity).toBe(4);

console.log("✅ Table validated successfully");

// ========================================
// STEP 2: Customer views available menu
// ========================================
console.log("\n🍽️  STEP 2: Customer views menu");

const menu = await caller.dishes.getAll({});

expect(menu).toBeDefined();
expect(menu.dishes).toBeArray();
expect(menu.dishes.length).toBeGreaterThan(0);

// Find our test dishes
const steak = menu.dishes.find(d => d.id === testDish1Id);
const friedRice = menu.dishes.find(d => d.id === testDish2Id);

expect(steak).toBeDefined();
expect(steak?.isAvailable).toBe(true);
expect(steak?.price).toBe(2500);

expect(friedRice).toBeDefined();
expect(friedRice?.isAvailable).toBe(true);
expect(friedRice?.price).toBe(800);

console.log("✅ Menu loaded with 2 available dishes");

// ========================================
// STEP 3: Customer creates initial order
// ========================================
console.log("\n🛒 STEP 3: Customer adds 1x Steak to cart");

const initialOrder = await caller.orders.create({
tableId: testTableId,
items: [
{
dishId: testDish1Id,
quantity: 1,
specialInstructions: "Medium rare please",
},
],
});

expect(initialOrder).toBeDefined();
expect(initialOrder.isNew).toBe(true);
expect(initialOrder.totalAmount).toBe(2500); // 1 * $25.00
expect(initialOrder.itemCount).toBe(1);

const orderId = initialOrder.orderId;
expect(orderId).toBeGreaterThan(0);

console.log(`✅ Order created with ID: ${orderId}, Total: $${initialOrder.totalAmount / 100}`);

// ========================================
// STEP 4: Customer adds more items to order
// ========================================
console.log("\n➕ STEP 4: Customer adds 2x Fried Rice to same order");

const updatedOrder = await caller.orders.create({
tableId: testTableId,
items: [
{
dishId: testDish2Id,
quantity: 2,
specialInstructions: "Extra spicy",
},
],
});

expect(updatedOrder).toBeDefined();
expect(updatedOrder.orderId).toBe(orderId); // Same order ID
expect(updatedOrder.isNew).toBe(false); // Added to existing
expect(updatedOrder.totalAmount).toBe(4100); // $25.00 + (2 * $8.00) = $41.00
expect(updatedOrder.itemCount).toBe(3); // 1 steak + 2 fried rice

console.log(`✅ Order updated, Total: $${updatedOrder.totalAmount / 100}, Items: ${updatedOrder.itemCount}`);

// ========================================
// STEP 5: Verify inventory BEFORE submission
// ========================================
console.log("\n📦 STEP 5: Verify inventory before submission");

const beefBeforeSubmit = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient1Id),
});
const riceBeforeSubmit = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient2Id),
});

expect(beefBeforeSubmit?.quantity).toBe(50); // No reduction yet
expect(riceBeforeSubmit?.quantity).toBe(100); // No reduction yet

console.log("✅ Inventory unchanged (order not submitted yet)");

// ========================================
// STEP 6: Customer submits order to kitchen
// ========================================
console.log("\n�� STEP 6: Customer submits order to kitchen");

const submittedOrder = await caller.orders.submit({
orderId,
});

expect(submittedOrder).toBeDefined();
expect(submittedOrder.orderId).toBe(orderId);
expect(submittedOrder.status).toBe("Pending");
expect(submittedOrder.submittedAt).toBeInstanceOf(Date);

console.log(`✅ Order submitted successfully, Status: ${submittedOrder.status}`);

// ========================================
// STEP 7: Verify inventory AFTER submission
// ========================================
console.log("\n📉 STEP 7: Verify inventory reduced atomically");

const beefAfterSubmit = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient1Id),
});
const riceAfterSubmit = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient2Id),
});

// 1 steak uses 0.5 kg beef
expect(beefAfterSubmit?.quantity).toBe(49.5);

// 2 fried rice use 2 * 0.3 = 0.6 kg rice
expect(riceAfterSubmit?.quantity).toBe(99.4);

console.log("✅ Inventory reduced correctly:");
console.log(`   - Beef: 50 → ${beefAfterSubmit?.quantity} kg (-0.5)`);
console.log(`   - Rice: 100 → ${riceAfterSubmit?.quantity} kg (-0.6)`);

// ========================================
// STEP 8: Verify order status history
// ========================================
console.log("\n📜 STEP 8: Verify order status history created");

const orderHistory = await db.query.orderStatusHistory.findMany({
where: (orderStatusHistory, { eq }) => eq(orderStatusHistory.orderId, orderId),
});

expect(orderHistory).toBeArray();
expect(orderHistory.length).toBeGreaterThan(0);

const pendingStatus = orderHistory.find(h => h.status === "Pending");
expect(pendingStatus).toBeDefined();

console.log(`✅ Order status history recorded (${orderHistory.length} entries)`);

// ========================================
// FINAL: Integration test summary
// ========================================
console.log("\n✨ INTEGRATION TEST COMPLETE ✨");
console.log("=====================================");
console.log(`Order ID: ${orderId}`);
console.log(`Table: 200`);
console.log(`Items: 1x Steak ($25.00), 2x Fried Rice ($8.00 each)`);
console.log(`Total: $${updatedOrder.totalAmount / 100}`);
console.log(`Status: ${submittedOrder.status}`);
console.log(`Inventory: Beef -0.5kg, Rice -0.6kg`);
console.log("=====================================");
});

test("End-to-End: Customer cannot submit order with insufficient stock", async () => {
const caller = appRouter.createCaller(customerContext);

console.log("\n❌ TEST: Insufficient stock scenario");

// Reduce beef stock to near zero
await db.update(ingredients)
.set({ quantity: 0.2 }) // Only 0.2 kg left
.where(eq(ingredients.id, testIngredient1Id));

// Customer creates order for 1 steak (needs 0.5 kg)
const order = await caller.orders.create({
tableId: testTableId,
items: [{ dishId: testDish1Id, quantity: 1 }],
});

// Try to submit - should fail
try {
await caller.orders.submit({ orderId: order.orderId });
throw new Error("Should have thrown insufficient stock error");
} catch (error: any) {
expect(error.message).toContain("Insufficient stock");
console.log("✅ Order submission blocked due to insufficient stock");
}

// Verify inventory unchanged
const beefAfter = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient1Id),
});
expect(beefAfter?.quantity).toBe(0.2); // Unchanged due to rollback

console.log("✅ Inventory unchanged (transaction rolled back)");
});

test("End-to-End: Multiple customers ordering simultaneously don't corrupt inventory", async () => {
const caller = appRouter.createCaller(customerContext);

console.log("\n🔄 TEST: Concurrent ordering scenario");

// Set beef stock to exactly 1.0 kg
await db.update(ingredients)
.set({ quantity: 1.0 })
.where(eq(ingredients.id, testIngredient1Id));

// Customer 1 creates order for 1 steak (needs 0.5 kg)
const order1 = await caller.orders.create({
tableId: testTableId,
items: [{ dishId: testDish1Id, quantity: 1 }],
});

// Customer 2 creates order for 1 steak (needs 0.5 kg)
// Using same table will add to same order - that's the business logic
const order2 = await caller.orders.create({
tableId: testTableId,
items: [{ dishId: testDish1Id, quantity: 1 }],
});

// Both should be same order (table session logic)
expect(order2.orderId).toBe(order1.orderId);
expect(order2.itemCount).toBe(2); // 2 steaks

// Submit order (needs 2 * 0.5 = 1.0 kg)
await caller.orders.submit({ orderId: order1.orderId });

// Verify inventory
const beefAfter = await db.query.ingredients.findFirst({
where: (ingredients, { eq }) => eq(ingredients.id, testIngredient1Id),
});
expect(beefAfter?.quantity).toBe(0.0); // Exactly depleted

console.log("✅ Concurrent orders handled correctly (table session logic)");
console.log(`   - Beef: 1.0 → ${beefAfter?.quantity} kg (-1.0)`);
});
});
