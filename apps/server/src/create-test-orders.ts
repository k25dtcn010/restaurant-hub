import { db, orders, orderItems, orderStatusHistory } from "@learn-bettert/db";

async function createTestOrders() {
  console.log("Creating test orders for kitchen dashboard...");
  
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const eightMinAgo = new Date(now.getTime() - 8 * 60 * 1000);
  const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000);
  
  // Create order 1 - Pending
  const [order1] = await db.insert(orders).values({
    tableId: 1,
    status: "Pending",
    totalAmount: 2500,
    createdAt: fiveMinAgo,
    updatedAt: fiveMinAgo,
  }).returning();
  
  await db.insert(orderItems).values([
    {
      orderId: order1.id,
      dishId: 1,
      quantity: 2,
      priceAtOrder: 1200,
      createdAt: fiveMinAgo,
    },
    {
      orderId: order1.id,
      dishId: 2,
      quantity: 1,
      priceAtOrder: 1300,
      createdAt: fiveMinAgo,
    },
  ]);
  
  await db.insert(orderStatusHistory).values({
    orderId: order1.id,
    status: "Pending",
    changedBy: null,
    changedAt: fiveMinAgo,
  });
  
  // Create order 2 - In Kitchen
  const [order2] = await db.insert(orders).values({
    tableId: 5,
    status: "InKitchen",
    totalAmount: 3200,
    createdAt: tenMinAgo,
    updatedAt: threeMinAgo,
  }).returning();
  
  await db.insert(orderItems).values([
    {
      orderId: order2.id,
      dishId: 3,
      quantity: 1,
      priceAtOrder: 1600,
      specialInstructions: "No onions please",
      createdAt: tenMinAgo,
    },
    {
      orderId: order2.id,
      dishId: 4,
      quantity: 1,
      priceAtOrder: 1600,
      createdAt: tenMinAgo,
    },
  ]);
  
  await db.insert(orderStatusHistory).values([
    {
      orderId: order2.id,
      status: "Pending",
      changedBy: null,
      changedAt: tenMinAgo,
    },
    {
      orderId: order2.id,
      status: "InKitchen",
      changedBy: null,
      changedAt: threeMinAgo,
    },
  ]);
  
  // Create order 3 - Ready to Serve
  const [order3] = await db.insert(orders).values({
    tableId: 12,
    status: "ReadyToServe",
    totalAmount: 1800,
    createdAt: fifteenMinAgo,
    updatedAt: oneMinAgo,
  }).returning();
  
  await db.insert(orderItems).values([
    {
      orderId: order3.id,
      dishId: 5,
      quantity: 1,
      priceAtOrder: 1800,
      createdAt: fifteenMinAgo,
    },
  ]);
  
  await db.insert(orderStatusHistory).values([
    {
      orderId: order3.id,
      status: "Pending",
      changedBy: null,
      changedAt: fifteenMinAgo,
    },
    {
      orderId: order3.id,
      status: "InKitchen",
      changedBy: null,
      changedAt: eightMinAgo,
    },
    {
      orderId: order3.id,
      status: "ReadyToServe",
      changedBy: null,
      changedAt: oneMinAgo,
    },
  ]);
  
  console.log("✓ Created 3 test orders:");
  console.log(`  - Order #${order1.id} - Table 1 - Pending (${Math.floor((now.getTime() - fiveMinAgo.getTime()) / 60000)} min ago)`);
  console.log(`  - Order #${order2.id} - Table 5 - In Kitchen (${Math.floor((now.getTime() - tenMinAgo.getTime()) / 60000)} min ago)`);
  console.log(`  - Order #${order3.id} - Table 12 - Ready to Serve (${Math.floor((now.getTime() - fifteenMinAgo.getTime()) / 60000)} min ago)`);
  process.exit(0);
}

createTestOrders().catch(console.error);
