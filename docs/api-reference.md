# RestaurantHub API Reference

**Version**: 1.0.0  
**Base URL**: `http://localhost:3000/trpc`  
**Authentication**: Better-Auth (session-based with httpOnly cookies)

This document provides a complete reference for all RestaurantHub API endpoints, generated from tRPC schema definitions.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Tables Router](#tables-router)
3. [Dishes Router](#dishes-router)
4. [Orders Router](#orders-router)
5. [Inventory Router](#inventory-router)
6. [Payments Router](#payments-router)
7. [Modifiers Router](#modifiers-router)
8. [Categories Router](#categories-router)
9. [Reservations Router](#reservations-router)
10. [Shifts Router](#shifts-router)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)

---

## Authentication

RestaurantHub uses Better-Auth for role-based access control.

### User Roles

| Role             | Permissions                                                  |
| ---------------- | ------------------------------------------------------------ |
| **Manager**      | Full CRUD on dishes, ingredients, users; View all operations |
| **KitchenStaff** | Update order status (Pending → InKitchen → Ready)            |
| **Waiter**       | Create orders, mark served/paid, view tables                 |
| **Customer**     | View menu, create orders via QR code (unauthenticated)       |

### Authentication Endpoints

- **POST** `/api/auth/sign-in` - Sign in with email/password
- **POST** `/api/auth/sign-out` - Sign out current user
- **GET** `/api/auth/session` - Get current session

**Test Credentials** (Development):

```
Manager: admin@restauranthub.com / password123
Chef: chef@restauranthub.com / password123
Waiter: waiter@restauranthub.com / password123
```

---

## Tables Router

Manage restaurant tables and QR code scanning.

### `tables.getAll`

**Type**: Query (Public)  
**Description**: Get all tables with their details

**Input**: None

**Output**:

```typescript
{
  tables: Array<{
    id: number
    number: number
    qrCode: string
    capacity: number
    createdAt: Date
  }>
}
```

**Example**:

```typescript
const { data } = trpc.tables.getAll.useQuery()
```

---

### `tables.getById`

**Type**: Query (Public)  
**Description**: Get specific table by ID

**Input**:

```typescript
{
  tableId: number
}
```

**Output**:

```typescript
{
  id: number
  number: number
  qrCode: string
  capacity: number
  createdAt: Date
}
```

**Errors**:

- `NOT_FOUND`: Table ID does not exist

---

## Dishes Router

Manage menu items and recipes.

### `dishes.getAll`

**Type**: Query (Public)  
**Description**: Get all dishes with availability status

**Input**:

```typescript
{
  includeDisabled?: boolean  // Default: false
}
```

**Output**:

```typescript
{
  dishes: Array<{
    id: number
    name: string
    description: string
    price: number // In cents (e.g., 1500 = $15.00)
    photoUrl: string | null
    isAvailable: boolean // Based on ingredient stock
    createdAt: Date
  }>
}
```

**Business Logic**:

- Dish is unavailable if any required ingredient has `quantity = 0`
- Dish is unavailable if manually disabled (`isAvailable = false`)

---

### `dishes.getById`

**Type**: Query (Public)  
**Description**: Get dish details with recipe

**Input**:

```typescript
{
  dishId: number
}
```

**Output**:

```typescript
{
  id: number
  name: string
  description: string
  price: number
  photoUrl: string | null
  isAvailable: boolean
  recipe: Array<{
    ingredientId: number
    ingredientName: string
    quantityRequired: number
    unit: string
    currentStock: number
  }>
  createdAt: Date
  updatedAt: Date
}
```

---

### `dishes.create` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Create new dish with recipe

**Input**:

```typescript
{
  name: string              // Max 100 chars
  description: string       // Max 500 chars
  price: number            // In cents, >= 0
  photoUrl?: string | null // Valid URL
  recipe: Array<{
    ingredientId: number
    quantityRequired: number  // > 0
  }>
}
```

**Output**:

```typescript
{
  dishId: number
  name: string
  price: number
}
```

**Errors**:

- `BAD_REQUEST`: Invalid input (negative price, invalid ingredient IDs)
- `FORBIDDEN`: User is not Manager

---

### `dishes.update` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Update existing dish

**Input**:

```typescript
{
  dishId: number
  name?: string
  description?: string
  price?: number
  photoUrl?: string | null
  recipe?: Array<{
    ingredientId: number
    quantityRequired: number
  }>
}
```

**Output**:

```typescript
{
  dishId: number
  updatedFields: string[]
  updatedAt: Date
}
```

**Errors**:

- `NOT_FOUND`: Dish ID does not exist
- `FORBIDDEN`: User is not Manager

---

### `dishes.toggleAvailability` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Enable or disable dish

**Input**:

```typescript
{
  dishId: number
  isAvailable: boolean
}
```

**Output**:

```typescript
{
  dishId: number
  isAvailable: boolean
  updatedAt: Date
}
```

**Errors**:

- `NOT_FOUND`: Dish ID does not exist
- `FORBIDDEN`: User is not Manager

---

## Orders Router

Manage order lifecycle from creation to payment.

### `orders.create`

**Type**: Mutation (Public/Authenticated)  
**Description**: Create or add to existing unpaid order for a table

**Input**:

```typescript
{
  tableId: number
  items: Array<{
    dishId: number
    quantity: number // > 0
    specialInstructions?: string
  }>
}
```

**Output**:

```typescript
{
  orderId: number
  tableId: number
  totalAmount: number
  items: Array<{
    dishId: number
    dishName: string
    quantity: number
    priceAtOrder: number
  }>
}
```

**Business Logic**:

- If table has active unpaid order, add items to existing order
- Otherwise, create new order with status "Pending"
- Store current dish price as `priceAtOrder` for historical accuracy

**Errors**:

- `NOT_FOUND`: Table ID or Dish ID does not exist
- `BAD_REQUEST`: Invalid quantities or dish unavailable

---

### `orders.submit`

**Type**: Mutation (Public)  
**Description**: Submit order to kitchen and reduce inventory

**Input**:

```typescript
{
  orderId: number
}
```

**Output**:

```typescript
{
  orderId: number
  status: "Pending"
  totalAmount: number
  submittedAt: Date
}
```

**Business Logic**:

- Atomically reduce ingredient quantities based on recipes
- Use database transaction with `FOR UPDATE` lock
- Broadcast NEW_ORDER event via WebSocket to kitchen

**Errors**:

- `NOT_FOUND`: Order ID does not exist
- `BAD_REQUEST`: Insufficient stock for one or more dishes

**WebSocket Event**:

```typescript
{
  type: "NEW_ORDER"
  order: {
    /* order details */
  }
  timestamp: string
}
```

---

### `orders.updateStatus` 🔒

**Type**: Mutation (Kitchen Staff/Waiter)  
**Description**: Update order status

**Input**:

```typescript
{
  orderId: number
  newStatus: "InKitchen" | "ReadyToServe" | "Served" | "Completed" | "Cancelled"
}
```

**Output**:

```typescript
{
  orderId: number
  status: string
  updatedAt: Date
}
```

**Business Logic**:

- Create audit trail entry in OrderStatusHistory
- If status is "ReadyToServe", broadcast ORDER_READY event to serving staff

**Errors**:

- `NOT_FOUND`: Order ID does not exist
- `FORBIDDEN`: User lacks permission for this transition

**WebSocket Event** (ReadyToServe):

```typescript
{
  type: "ORDER_READY"
  orderId: number
  tableId: number
  timestamp: string
}
```

---

### `orders.getKitchenOrders`

**Type**: Query (Public)  
**Description**: Get orders for kitchen dashboard

**Input**:

```typescript
{
  status?: "Pending" | "InKitchen" | "ReadyToServe"
}
```

**Output**:

```typescript
{
  orders: Array<{
    id: number
    tableNumber: number
    status: string
    items: Array<{
      dishName: string
      quantity: number
    }>
    totalAmount: number
    createdAt: Date
  }>
}
```

---

### `orders.getServingOrders`

**Type**: Query (Public)  
**Description**: Get orders for serving dashboard

**Input**: None

**Output**:

```typescript
{
  orders: Array<{
    id: number
    tableNumber: number
    status: "ReadyToServe" | "Served"
    items: Array<{
      dishName: string
      quantity: number
    }>
    totalAmount: number
    readySince: string | null
    waitTime: number // Minutes since ready
  }>
}
```

**Business Logic**:

- Sort by waitTime DESC (oldest first)

---

## Inventory Router

Manage ingredient stock and low-stock alerts.

### `inventory.getAll` 🔒

**Type**: Query (Manager Only)  
**Description**: Get all ingredients with stock status

**Input**:

```typescript
{
  includeRecipes?: boolean  // Default: false
}
```

**Output**:

```typescript
{
  ingredients: Array<{
    id: number
    name: string
    quantity: number
    unit: string
    threshold: number
    isLowStock: boolean // quantity < threshold
    updatedAt: Date
    usedInDishes?: Array<{
      // If includeRecipes=true
      dishId: number
      dishName: string
      quantityRequired: number
    }>
  }>
}
```

**Errors**:

- `FORBIDDEN`: User is not Manager

---

### `inventory.adjustStock` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Manually adjust ingredient quantity

**Input**:

```typescript
{
  ingredientId: number
  adjustment: number        // Can be positive or negative
  reason?: string
}
```

**Output**:

```typescript
{
  ingredientId: number
  newQuantity: number
  updatedAt: Date
}
```

**Business Logic**:

- Prevent negative quantities (clamp to 0)
- Broadcast LOW_STOCK_ALERT if new quantity < threshold

**Errors**:

- `NOT_FOUND`: Ingredient ID does not exist
- `FORBIDDEN`: User is not Manager

**WebSocket Event** (Low Stock):

```typescript
{
  type: "LOW_STOCK_ALERT"
  ingredient: {
    /* ingredient details */
  }
  timestamp: string
}
```

---

### `inventory.updateThreshold` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Update low-stock alert threshold

**Input**:

```typescript
{
  ingredientId: number
  threshold: number // >= 0
}
```

**Output**:

```typescript
{
  ingredientId: number
  threshold: number
  updatedAt: Date
}
```

---

## Payments Router

Process cash payments and clear table sessions.

### `payments.create` 🔒

**Type**: Mutation (Waiter/Manager)  
**Description**: Record cash payment for order

**Input**:

```typescript
{
  orderId: number
  amount: number           // In cents, must match order totalAmount
  method?: "Cash"          // Default: "Cash"
}
```

**Output**:

```typescript
{
  paymentId: number
  orderId: number
  amount: number
  method: string
  paidAt: Date
}
```

**Business Logic**:

- Validate order status is "Completed" or "Served"
- Validate amount matches order totalAmount
- Update order status to "Paid"
- Clear table session (allows new orders)

**Errors**:

- `NOT_FOUND`: Order ID does not exist
- `BAD_REQUEST`: Amount mismatch or invalid order status
- `FORBIDDEN`: User is not Waiter or Manager

---

### `payments.getHistory` 🔒

**Type**: Query (Manager Only)  
**Description**: Get payment history

**Input**:

```typescript
{
  startDate?: Date
  endDate?: Date
  limit?: number           // Default: 50
}
```

**Output**:

```typescript
{
  payments: Array<{
    id: number
    orderId: number
    amount: number
    method: string
    paidAt: Date
    orderDetails: {
      tableNumber: number
      totalAmount: number
    }
  }>
}
```

---

## Modifiers Router

Manage menu item modifiers and modifier groups.

### `modifiers.list`

**Type**: Query (Public)  
**Description**: List all modifiers with optional availability filtering

**Input**:

```typescript
{
  availableOnly?: boolean  // Default: false
}
```

**Output**:

```typescript
{
  modifiers: Array<{
    id: number
    name: string
    priceAdjustment: number // In cents
    isAvailable: boolean
    createdAt: Date
    updatedAt: Date
  }>
}
```

---

### `modifiers.create` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Create a new modifier

**Input**:

```typescript
{
  name: string              // Max 100 chars
  priceAdjustment: number  // In cents, can be negative
  isAvailable?: boolean    // Default: true
}
```

**Output**:

```typescript
{
  id: number
  name: string
  priceAdjustment: number
  isAvailable: boolean
}
```

**Errors**:

- `UNAUTHORIZED`: User is not Manager
- `BAD_REQUEST`: Duplicate modifier name

---

### `modifiers.getByDish`

**Type**: Query (Public)  
**Description**: Get all modifiers for a specific dish grouped by modifier groups

**Input**:

```typescript
{
  dishId: number
}
```

**Output**:

```typescript
{
  modifierGroups: Array<{
    group: {
      id: number
      name: string
      minSelections: number | null
      maxSelections: number | null
      displayOrder: number
    }
    modifiers: Array<{
      id: number
      name: string
      priceAdjustment: number
      isAvailable: boolean
    }>
  }>
}
```

---

## Categories Router

Manage menu categories for organizing dishes.

### `categories.list`

**Type**: Query (Public)  
**Description**: List all categories ordered by display order

**Input**:

```typescript
{
  visibleOnly?: boolean  // Default: false
}
```

**Output**:

```typescript
{
  categories: Array<{
    id: number
    name: string
    iconUrl: string | null
    displayOrder: number
    isHidden: boolean
    dishCount: number // Number of dishes in category
    createdAt: Date
  }>
}
```

---

### `categories.create` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Create a new category

**Input**:

```typescript
{
  name: string         // Max 100 chars
  iconUrl?: string     // Emoji or icon URL
  displayOrder?: number  // Default: 0
}
```

**Output**:

```typescript
{
  id: number
  name: string
  iconUrl: string | null
  displayOrder: number
}
```

---

### `categories.reorder` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Reorder categories by updating display orders

**Input**:

```typescript
{
  categoryOrders: Array<{
    id: number
    displayOrder: number
  }>
}
```

**Output**:

```typescript
{
  success: boolean
  updatedCount: number
}
```

---

### `categories.toggleVisibility` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Hide or show a category from customers

**Input**:

```typescript
{
  categoryId: number
}
```

**Output**:

```typescript
{
  categoryId: number
  isHidden: boolean
  updatedAt: Date
}
```

---

## Reservations Router

Manage table reservations (future implementation).

### `reservations.list`

**Type**: Query (Staff)  
**Description**: List all reservations for a specific date

**Input**:

```typescript
{
  date: string  // ISO date format (YYYY-MM-DD)
  status?: "Pending" | "Confirmed" | "Seated" | "Cancelled"
}
```

**Output**:

```typescript
{
  reservations: Array<{
    id: number
    customerName: string
    customerPhone: string
    partySize: number
    reservationTime: Date
    status: string
    tableId: number | null
    createdAt: Date
  }>
}
```

---

### `reservations.create`

**Type**: Mutation (Public/Staff)  
**Description**: Create a new reservation

**Input**:

```typescript
{
  customerName: string
  customerPhone: string
  partySize: number
  reservationTime: Date  // ISO datetime
  notes?: string
}
```

**Output**:

```typescript
{
  id: number
  confirmationCode: string
  customerName: string
  reservationTime: Date
}
```

---

## Shifts Router

Manage restaurant shifts and operating sessions.

### `shifts.listActive`

**Type**: Query (Public)  
**Description**: Get currently active shifts

**Input**: None

**Output**:

```typescript
{
  shifts: Array<{
    id: number
    shiftType: "Breakfast" | "Lunch" | "Dinner" | string
    startTime: Date
    duration: number // Minutes since start
    currentOrderCount: number
    staff: Array<{
      id: string
      name: string
    }>
  }>
}
```

---

### `shifts.start` 🔒

**Type**: Mutation (Manager Only)  
**Description**: Start a new shift

**Input**:

```typescript
{
  shiftType: "Breakfast" | "Lunch" | "Dinner" | "Custom"
  customTypeName?: string  // Required if shiftType is "Custom"
  staffIds?: string[]      // Optional staff assignments
  notes?: string
}
```

**Output**:

```typescript
{
  id: number
  shiftType: string
  startTime: Date
}
```

**Errors**:

- `BAD_REQUEST`: Active shift already exists
- `UNAUTHORIZED`: User is not Manager

---

### `shifts.end` 🔒

**Type**: Mutation (Manager Only)  
**Description**: End the active shift

**Input**:

```typescript
{
  id: number
  notes?: string
}
```

**Output**:

```typescript
{
  id: number
  endTime: Date
  duration: number
  totalOrders: number
  totalRevenue: number
}
```

**Errors**:

- `NOT_FOUND`: Shift ID does not exist or already ended

---

## Error Handling

### Error Codes

| Code                    | HTTP Status | Description                              |
| ----------------------- | ----------- | ---------------------------------------- |
| `BAD_REQUEST`           | 400         | Invalid input or business rule violation |
| `UNAUTHORIZED`          | 401         | Authentication required                  |
| `FORBIDDEN`             | 403         | Insufficient permissions                 |
| `NOT_FOUND`             | 404         | Resource does not exist                  |
| `INTERNAL_SERVER_ERROR` | 500         | Server error (logged server-side)        |

### Error Response Format

```typescript
{
  error: {
    code: "BAD_REQUEST"
    message: "Cannot submit order: Burger is currently unavailable."
    data: {
      code: "BAD_REQUEST"
      httpStatus: 400
      path: "orders.submit"
    }
  }
}
```

### Best Practices

- Never expose database errors or stack traces to frontend
- Display user-friendly, actionable error messages
- Log detailed errors server-side with context
- Use toast notifications for transient errors
- Show inline validation errors for form inputs

---

## Rate Limiting

**Public Endpoints**: 100 requests per minute per IP  
**Authenticated Endpoints**: 300 requests per minute per user

**Rate Limit Headers**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

---

## WebSocket Protocol

See [websocket-protocol.md](./websocket-protocol.md) for complete WebSocket event reference.

---

**Generated**: 2025-10-18  
**Contract References**:

- MVP: `specs/001-restaurant-hub-mvp/contracts/`
- Advanced Operations: `specs/002-advanced-ops-management/contracts/`
