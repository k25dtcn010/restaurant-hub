# API Contracts: Payments Router

**Router**: `payments`  
**Path**: `/trpc/payments.*`  
**Authentication**: Required (Waiter, Manager)

## Purpose

Manages cash payment processing and payment history (P2 priority - User Story 6).

---

## Procedures

### 1. `payments.create`

**Type**: `mutation`  
**Auth**: Required (Waiter, Manager)  
**Description**: Processes a cash payment for a completed order (FR-028).

**Input Schema**:

```typescript
{
  orderId: number,
  amount: number,            // Payment amount in cents (must match order total)
  method: 'Cash'             // Only 'Cash' supported in MVP
}
```

**Output Schema**:

```typescript
{
  paymentId: number,
  orderId: number,
  amount: number,
  method: 'Cash',
  paidAt: Date,
  tableId: number            // For table session clearing
}
```

**Business Logic**:

- Validate order exists and status is `'Completed'` or `'Served'`
- Validate payment amount matches `orders.totalAmount`
- Create payment record in `payments` table
- Update order status to `'Paid'`
- Create `OrderStatusHistory` entry
- Clear table session (allow new orders for this table)
- Broadcast WebSocket notification to managers

**Errors**:

- `NOT_FOUND`: Order ID does not exist
- `BAD_REQUEST`: Order not in completable state or amount mismatch
- `BAD_REQUEST`: Payment already exists for this order
- `FORBIDDEN`: User is not Waiter or Manager

**WebSocket Notification**:

```typescript
{
  type: 'PAYMENT_COMPLETED',
  payload: {
    orderId: number,
    tableNumber: number,
    amount: number,
    paidAt: Date
  }
}
```

**Recipients**: All connected `manager` role users

---

### 2. `payments.getById`

**Type**: `query`  
**Auth**: Required (Waiter, Manager)  
**Description**: Retrieves payment details for a specific order.

**Input Schema**:

```typescript
{
  paymentId: number
}
```

**Output Schema**:

```typescript
{
  id: number,
  orderId: number,
  amount: number,
  method: 'Cash',
  paidAt: Date,
  order: {
    tableNumber: number,
    items: Array<{
      dishName: string,
      quantity: number,
      priceAtOrder: number
    }>,
    totalAmount: number
  }
}
```

**Errors**:

- `NOT_FOUND`: Payment ID does not exist

---

### 3. `payments.getHistory`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves payment history with filters (FR-030).

**Input Schema**:

```typescript
{
  startDate?: Date,
  endDate?: Date,
  tableId?: number,
  limit?: number,            // Default: 50, max: 100
  offset?: number            // Default: 0
}
```

**Output Schema**:

```typescript
{
  payments: Array<{
    id: number,
    orderId: number,
    tableNumber: number,
    amount: number,
    method: 'Cash',
    paidAt: Date
  }>,
  total: number,             // Total payments count
  totalRevenue: number,      // Sum of all payment amounts in range
  page: number,
  pageSize: number
}
```

**Business Logic**:

- Query `payments` with date range and table filters
- Join with `orders` and `tables` for table numbers
- Calculate aggregate `totalRevenue` for filtered results
- Paginate results

**Errors**:

- `FORBIDDEN`: User is not Manager

---

### 4. `payments.getDailySummary`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves revenue summary for a specific date.

**Input Schema**:

```typescript
{
  date: Date // Target date (defaults to today)
}
```

**Output Schema**:

```typescript
{
  date: Date,
  totalOrders: number,       // Count of paid orders
  totalRevenue: number,      // Sum of payment amounts in cents
  averageOrderValue: number, // Revenue / orders
  paymentsByHour: Array<{    // Hourly breakdown
    hour: number,            // 0-23
    orderCount: number,
    revenue: number
  }>
}
```

**Business Logic**:

- Filter payments by date (midnight to midnight)
- Group by hour for breakdown
- Calculate aggregate statistics

---

## Type Definitions

```typescript
export type Payment = {
  id: number
  orderId: number
  amount: number // cents
  method: "Cash"
  paidAt: Date
}

export type PaymentWithOrder = Payment & {
  order: {
    tableNumber: number
    items: Array<{
      dishName: string
      quantity: number
      priceAtOrder: number
    }>
    totalAmount: number
  }
}
```

---

**Phase 1B-5 Complete**: Payments router contract specified with cash payment processing.
