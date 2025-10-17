# API Contracts: Orders Router

**Router**: `orders`  
**Path**: `/trpc/orders.*`  
**Authentication**: Required for all procedures except customer QR-based ordering

## Purpose

Manages the complete order lifecycle from creation through payment, including item management, status transitions, and real-time notifications.

---

## Procedures

### 1. `orders.create`

**Type**: `mutation`  
**Auth**: Optional (customers via QR, staff via authenticated session)  
**Description**: Creates a new order for a specific table or adds items to an existing unpaid order.

**Input Schema**:
```typescript
{
  tableId: number,           // Table number (1-30)
  items: Array<{
    dishId: number,          // ID of dish to order
    quantity: number,        // Quantity (min: 1)
    specialInstructions?: string  // Optional notes (max: 255 chars)
  }>
}
```

**Output Schema**:
```typescript
{
  orderId: number,           // Created or updated order ID
  isNew: boolean,            // True if new order, false if added to existing
  totalAmount: number,       // Total in cents
  itemCount: number          // Number of items in order
}
```

**Business Logic**:
- Check if table has active unpaid order → add to existing order if yes, create new if no
- Validate all dishes exist and are available (`isAvailable = true`)
- Check ingredient stock for all items via recipe calculation
- If stock insufficient, return error with unavailable dish names
- Calculate total amount from current dish prices
- Do NOT reduce inventory yet (happens on `submit`)
- Status initially set to `'Draft'` or `'Pending'` based on submission

**Errors**:
- `NOT_FOUND`: Table ID does not exist
- `BAD_REQUEST`: Invalid dishId, quantity <= 0, or insufficient stock
- `BAD_REQUEST`: Special instructions exceed 255 characters

**WebSocket Notification**: None (order not yet submitted)

---

### 2. `orders.submit`

**Type**: `mutation`  
**Auth**: Optional (customers can submit their own orders)  
**Description**: Submits an order to the kitchen, reducing inventory and triggering notifications.

**Input Schema**:
```typescript
{
  orderId: number            // Order ID to submit
}
```

**Output Schema**:
```typescript
{
  orderId: number,
  status: 'Pending',
  submittedAt: Date,
  estimatedWaitTime?: number  // Optional: minutes (future enhancement)
}
```

**Business Logic**:
- Validate order exists and is in submittable state (not already submitted)
- Re-check ingredient stock (transaction-safe)
- Calculate total ingredient requirements across all order items
- Reduce ingredient quantities atomically (database transaction)
- If stock insufficient, rollback transaction and return error
- Update order status to `'Pending'`
- Create `OrderStatusHistory` entry
- Broadcast WebSocket notification to kitchen dashboard

**Errors**:
- `NOT_FOUND`: Order ID does not exist
- `BAD_REQUEST`: Order already submitted or in later status
- `BAD_REQUEST`: Insufficient stock (list unavailable dishes)
- `CONFLICT`: Concurrent stock depletion (retry mechanism)

**WebSocket Notification**:
```typescript
{
  type: 'NEW_ORDER',
  payload: {
    orderId: number,
    tableNumber: number,
    items: Array<{ dishName: string, quantity: number }>,
    timestamp: Date
  }
}
```
**Recipients**: All connected `kitchen` role users

---

### 3. `orders.addItems`

**Type**: `mutation`  
**Auth**: Optional (customers or authenticated staff)  
**Description**: Adds additional items to an existing order (allowed at any stage before 'Paid').

**Input Schema**:
```typescript
{
  orderId: number,
  items: Array<{
    dishId: number,
    quantity: number,
    specialInstructions?: string
  }>
}
```

**Output Schema**:
```typescript
{
  orderId: number,
  newItemCount: number,      // How many items added
  totalAmount: number,       // Updated total in cents
  status: OrderStatus        // Current status (unchanged)
}
```

**Business Logic**:
- Validate order exists and status is NOT `'Paid'` (FR-016b)
- Check ingredient stock for new items
- Add items to `order_items` table
- Recalculate `orders.totalAmount`
- If order already submitted (`'Pending'` or later), reduce inventory immediately
- Create `OrderStatusHistory` entry noting item addition
- Broadcast WebSocket notification to kitchen if order already in kitchen

**Errors**:
- `NOT_FOUND`: Order ID does not exist
- `BAD_REQUEST`: Order status is `'Paid'` (cannot modify paid orders)
- `BAD_REQUEST`: Insufficient stock for new items

**WebSocket Notification** (if order status >= 'Pending'):
```typescript
{
  type: 'ORDER_UPDATED',
  payload: {
    orderId: number,
    tableNumber: number,
    newItems: Array<{ dishName: string, quantity: number }>,
    timestamp: Date
  }
}
```
**Recipients**: Kitchen and serving staff

---

### 4. `orders.removeItems`

**Type**: `mutation`  
**Auth**: Optional (customers or authenticated staff)  
**Description**: Removes items from an order (only allowed while status is 'Pending').

**Input Schema**:
```typescript
{
  orderId: number,
  orderItemIds: number[]     // IDs of order_items to remove
}
```

**Output Schema**:
```typescript
{
  orderId: number,
  removedCount: number,      // How many items removed
  totalAmount: number,       // Updated total in cents
  status: OrderStatus
}
```

**Business Logic**:
- Validate order exists and status is `'Pending'` (FR-016a)
- For each order item to remove:
  - Calculate ingredient refund via recipe
  - Add quantities back to inventory
- Delete order items from database
- Recalculate `orders.totalAmount`
- If all items removed, delete order entirely (optional business decision)

**Errors**:
- `NOT_FOUND`: Order ID or order item IDs do not exist
- `FORBIDDEN`: Order status is not `'Pending'` (already in kitchen or later)

**WebSocket Notification**: None (modifications only allowed before kitchen sees order)

---

### 5. `orders.updateStatus`

**Type**: `mutation`  
**Auth**: Required (role-based)  
**Description**: Transitions order to next status in lifecycle.

**Input Schema**:
```typescript
{
  orderId: number,
  newStatus: OrderStatus     // Target status
}
```

**Output Schema**:
```typescript
{
  orderId: number,
  status: OrderStatus,       // Updated status
  updatedAt: Date,
  changedBy: number          // User ID who made change
}
```

**Business Logic**:
- Validate order exists
- Validate status transition is allowed (see state machine in data-model.md)
- Check user role has permission for this transition:
  - Kitchen Staff: `Pending → InKitchen`, `InKitchen → ReadyToServe`
  - Waiter: `ReadyToServe → Served`, `Served → Completed`, `Completed → Paid`
  - Manager: All transitions
- Update `orders.status` and `orders.updatedAt`
- Create `OrderStatusHistory` entry with `userId`
- Broadcast WebSocket notification based on status:
  - `ReadyToServe`: Notify serving staff
  - `Paid`: Notify managers (for analytics)

**Errors**:
- `NOT_FOUND`: Order ID does not exist
- `FORBIDDEN`: User role does not have permission for this transition
- `BAD_REQUEST`: Invalid status transition (e.g., `Pending` → `Served`)

**WebSocket Notifications**:

*When status → `'ReadyToServe'`*:
```typescript
{
  type: 'ORDER_READY',
  payload: {
    orderId: number,
    tableNumber: number,
    items: Array<{ dishName: string, quantity: number }>,
    timestamp: Date
  }
}
```
**Recipients**: All connected `serving` role users (waiters, managers)

*When status → `'Paid'`*:
```typescript
{
  type: 'ORDER_COMPLETED',
  payload: {
    orderId: number,
    tableNumber: number,
    totalAmount: number,
    timestamp: Date
  }
}
```
**Recipients**: All connected `manager` role users

---

### 6. `orders.getById`

**Type**: `query`  
**Auth**: Optional (customers can view their table's order, staff can view all)  
**Description**: Retrieves detailed information for a specific order.

**Input Schema**:
```typescript
{
  orderId: number
}
```

**Output Schema**:
```typescript
{
  id: number,
  tableId: number,
  tableNumber: number,       // Joined from tables
  status: OrderStatus,
  totalAmount: number,       // In cents
  createdAt: Date,
  updatedAt: Date,
  items: Array<{
    id: number,
    dishId: number,
    dishName: string,        // Joined from dishes
    quantity: number,
    priceAtOrder: number,    // In cents
    specialInstructions: string | null
  }>,
  statusHistory: Array<{
    status: OrderStatus,
    changedBy: string | null,  // User name or 'System'
    changedAt: Date
  }>
}
```

**Business Logic**:
- Join with `tables`, `order_items`, `dishes`, `order_status_history`, `users`
- If unauthenticated, validate request includes valid `tableId` matching order
- Return full order details including status timeline

**Errors**:
- `NOT_FOUND`: Order ID does not exist
- `FORBIDDEN`: Unauthenticated customer trying to access another table's order

**WebSocket Subscription**: Frontend can subscribe to updates for this orderId

---

### 7. `orders.getActiveOrderByTable`

**Type**: `query`  
**Auth**: Optional (public for customer QR access)  
**Description**: Retrieves the active (unpaid) order for a specific table, if one exists.

**Input Schema**:
```typescript
{
  tableId: number
}
```

**Output Schema**:
```typescript
{
  orderId: number | null,    // Null if no active order
  status: OrderStatus | null,
  totalAmount: number | null,
  itemCount: number | null
} | null
```

**Business Logic**:
- Query `orders` table for orders where `tableId` matches and `status != 'Paid'`
- Should be only one active order per table (enforced in business logic)
- If multiple found (edge case), return most recent by `createdAt`

**Errors**:
- `NOT_FOUND`: Table ID does not exist

---

### 8. `orders.getKitchenOrders`

**Type**: `query`  
**Auth**: Required (Kitchen Staff, Manager)  
**Description**: Retrieves all orders currently in kitchen workflow (Pending, InKitchen, ReadyToServe).

**Input Schema**:
```typescript
{
  status?: OrderStatus[]     // Optional filter (default: ['Pending', 'InKitchen', 'ReadyToServe'])
}
```

**Output Schema**:
```typescript
{
  orders: Array<{
    id: number,
    tableNumber: number,
    status: OrderStatus,
    items: Array<{
      dishName: string,
      quantity: number,
      specialInstructions: string | null
    }>,
    createdAt: Date,
    updatedAt: Date,
    waitTime: number         // Minutes since order created
  }>
}
```

**Business Logic**:
- Query orders with status in [`'Pending'`, `'InKitchen'`, `'ReadyToServe'`]
- Group by table number
- Sort by `createdAt` ascending (oldest first) within each status
- Calculate `waitTime` as difference between `now` and `createdAt`

**Errors**:
- `UNAUTHORIZED`: User not authenticated
- `FORBIDDEN`: User role is not Kitchen Staff or Manager

---

### 9. `orders.getServingOrders`

**Type**: `query`  
**Auth**: Required (Waiter, Manager)  
**Description**: Retrieves orders ready to be served or already served (for tracking).

**Input Schema**:
```typescript
{
  status?: OrderStatus[]     // Optional filter (default: ['ReadyToServe', 'Served'])
}
```

**Output Schema**:
```typescript
{
  orders: Array<{
    id: number,
    tableNumber: number,
    status: OrderStatus,
    items: Array<{
      dishName: string,
      quantity: number
    }>,
    totalAmount: number,     // In cents
    readySince: Date | null, // Timestamp when marked ReadyToServe
    waitTime: number         // Minutes waiting for service
  }>
}
```

**Business Logic**:
- Query orders with status in [`'ReadyToServe'`, `'Served'`]
- Join with `order_status_history` to get `readySince` timestamp
- Calculate `waitTime` as difference between `now` and `readySince`
- Sort by `waitTime` descending (longest waiting first)

**Errors**:
- `UNAUTHORIZED`: User not authenticated
- `FORBIDDEN`: User role is not Waiter or Manager

---

### 10. `orders.getOrderHistory`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves historical orders with filters (for analytics and payment history).

**Input Schema**:
```typescript
{
  startDate?: Date,          // Filter by created date range
  endDate?: Date,
  tableId?: number,          // Filter by specific table
  status?: OrderStatus[],    // Filter by status (default: ['Completed', 'Paid'])
  limit?: number,            // Pagination limit (default: 50, max: 100)
  offset?: number            // Pagination offset (default: 0)
}
```

**Output Schema**:
```typescript
{
  orders: Array<{
    id: number,
    tableNumber: number,
    status: OrderStatus,
    totalAmount: number,
    createdAt: Date,
    completedAt: Date | null,  // When marked Paid
    itemCount: number
  }>,
  total: number,             // Total count (for pagination)
  page: number,              // Current page
  pageSize: number
}
```

**Business Logic**:
- Query orders with optional filters
- Default to showing `'Completed'` and `'Paid'` orders
- Support date range filtering for reporting
- Paginate results (default 50 per page)

**Errors**:
- `UNAUTHORIZED`: User not authenticated
- `FORBIDDEN`: User role is not Manager

---

## Type Definitions

```typescript
// Shared types exported from packages/api
export type OrderStatus = 'Pending' | 'InKitchen' | 'ReadyToServe' | 'Served' | 'Completed' | 'Paid'

export type CreateOrderInput = {
  tableId: number
  items: Array<{
    dishId: number
    quantity: number
    specialInstructions?: string
  }>
}

export type UpdateOrderStatusInput = {
  orderId: number
  newStatus: OrderStatus
}

// ... (additional types for all input/output schemas)
```

---

## Real-Time Event Types

WebSocket events broadcasted by this router:

1. **NEW_ORDER**: Kitchen receives new order submission
2. **ORDER_UPDATED**: Items added to existing order
3. **ORDER_READY**: Serving staff notified dish is ready
4. **ORDER_COMPLETED**: Manager notified of payment completion

---

## Error Codes Reference

| tRPC Error Code           | HTTP Status | Usage                                         |
|---------------------------|-------------|-----------------------------------------------|
| `BAD_REQUEST`             | 400         | Invalid input, business logic violation       |
| `UNAUTHORIZED`            | 401         | User not authenticated                        |
| `FORBIDDEN`               | 403         | User lacks permission for operation           |
| `NOT_FOUND`               | 404         | Order, table, or dish not found               |
| `CONFLICT`                | 409         | Concurrent modification (e.g., stock race)    |
| `INTERNAL_SERVER_ERROR`   | 500         | Unexpected server error                       |

---

**Phase 1B-1 Complete**: Orders router contract fully specified with all procedures, input/output schemas, business logic, and real-time events.
