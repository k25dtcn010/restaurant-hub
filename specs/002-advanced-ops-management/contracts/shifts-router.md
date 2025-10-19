# API Contract: Shifts Router

**Router**: `shifts`  
**Package**: `packages/api/src/routers/shifts.ts`  
**Date**: 2025-10-18

## Overview

tRPC procedures for managing operational shifts and session tracking.

---

## Procedures

### `shifts.start`

Start a new operational shift.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema** (Zod):

```typescript
z.object({
  shiftType: z.enum(["Breakfast", "Lunch", "Dinner", "Custom"]),
  customTypeName: z.string().min(1).max(50).optional(), // required if shiftType = "Custom"
  staffIds: z.array(z.number()).optional(), // optional initial staff assignment
}).refine(
  (data) => {
    if (data.shiftType === "Custom") {
      return data.customTypeName != null && data.customTypeName.length > 0
    }
    return true
  },
  { message: "customTypeName is required when shiftType is Custom" }
)
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  shiftType: z.string(),
  startTime: z.date(),
  endTime: z.null(),
  totalOrders: z.null(),
  totalRevenue: z.null(),
  staff: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    })
  ),
})
```

**Logic**:

- Create new shift record with `startTime = NOW()`, `endTime = NULL`
- If `staffIds` provided, insert into `shift_staff` join table
- Store `shiftType` as-is, or use `customTypeName` if Custom
- Check for existing active shifts of same type (warn but allow)

**Errors**:

- `UNAUTHORIZED` if not manager
- `BAD_REQUEST` if Custom type without customTypeName

---

### `shifts.end`

End an active shift and generate summary.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  id: z.number(),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  shiftType: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  totalOrders: z.number(),
  totalRevenue: z.number(), // cents
  staff: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    })
  ),
})
```

**Logic**:

- Validate shift exists and `endTime = NULL` (active shift)
- Set `endTime = NOW()`
- Count orders where `orders.shiftId = :shiftId`
- Sum payment amounts where `payments.orderId IN (orders with shiftId)`
- Update `totalOrders` and `totalRevenue` fields
- Return shift summary

**Errors**:

- `NOT_FOUND` if shift doesn't exist
- `BAD_REQUEST` if shift already ended
- Display warning if there are open (unpaid) orders

---

### `shifts.listActive`

List all currently active shifts.

**Type**: Query  
**Auth**: Staff or Manager

**Input Schema**:

```typescript
z.object({}) // no params
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    shiftType: z.string(),
    startTime: z.date(),
    duration: z.number(), // minutes since start
    currentOrderCount: z.number(), // count of orders so far
    staff: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
      })
    ),
  })
).transform((shifts) => shifts.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()))
```

**Logic**:

- Query shifts where `endTime IS NULL`
- For each shift, count orders with `shiftId`
- Calculate duration in minutes: `(NOW() - startTime) / 60000`
- Warn if duration > 720 minutes (12 hours)

---

### `shifts.listHistory`

List historical shifts with filtering.

**Type**: Query  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  shiftType: z.enum(["Breakfast", "Lunch", "Dinner", "Custom"]).optional(),
  staffId: z.number().optional(), // filter by staff member
})
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    shiftType: z.string(),
    startTime: z.date(),
    endTime: z.date(),
    totalOrders: z.number(),
    totalRevenue: z.number(),
    staff: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
      })
    ),
  })
).transform((shifts) => shifts.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())) // newest first
```

**Logic**:

- Query shifts where `endTime IS NOT NULL`
- Filter by date range if provided (startTime between start/end dates)
- Filter by shiftType if provided
- Filter by staffId via `shift_staff` join if provided
- Order by `startTime DESC`

---

### `shifts.addStaff`

Add staff members to an active shift.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  shiftId: z.number(),
  staffIds: z.array(z.number()).min(1),
})
```

**Output Schema**:

```typescript
z.object({
  success: z.boolean(),
  addedCount: z.number(),
})
```

**Logic**:

- Validate shift exists and is active (`endTime = NULL`)
- Insert into `shift_staff` for each staff ID
- Ignore duplicates (upsert pattern)

**Errors**:

- `NOT_FOUND` if shift doesn't exist
- `BAD_REQUEST` if shift already ended or any staff ID is invalid

---

### `shifts.removeStaff`

Remove staff members from an active shift.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  shiftId: z.number(),
  staffIds: z.array(z.number()).min(1),
})
```

**Output Schema**:

```typescript
z.object({
  success: z.boolean(),
  removedCount: z.number(),
})
```

**Logic**:

- Validate shift exists
- Delete from `shift_staff` where `shiftId` and `staffId` match
- Return count of deleted rows

---

### `shifts.getSummary`

Get detailed summary for a specific shift (active or ended).

**Type**: Query  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  id: z.number(),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  shiftType: z.string(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  totalOrders: z.number().nullable(),
  totalRevenue: z.number().nullable(),
  staff: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    })
  ),
  orders: z.array(
    z.object({
      id: z.number(),
      tableNumber: z.string(),
      status: z.string(),
      totalAmount: z.number(),
      createdAt: z.date(),
    })
  ),
})
```

**Logic**:

- Query shift by ID
- Join with `shift_staff` to get staff list
- Join with `orders` where `orders.shiftId = :shiftId`
- If shift is active, compute current counts (don't use stored totals)
- If shift is ended, use stored `totalOrders` and `totalRevenue`

---

### `shifts.getCurrentShift`

Get the currently active shift for the authenticated user (auto-assignment for orders).

**Type**: Query  
**Auth**: Staff or Manager

**Input Schema**:

```typescript
z.object({}) // no params, uses auth context
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  shiftType: z.string(),
  startTime: z.date(),
}).nullable() // null if no active shift
```

**Logic**:

- Query active shifts where user is in `shift_staff`
- Return the most recent active shift (by `startTime DESC`)
- Used by order creation middleware to auto-tag orders with shift ID

---

## Middleware Integration

### Auto-Assign Shift to Orders

When an order is created via `orders.create`, automatically assign the current shift ID.

**Logic**:

- Call `shifts.getCurrentShift` in tRPC context middleware
- If active shift found, set `orders.shiftId = shift.id`
- If no active shift, leave `orders.shiftId = NULL`

---

## WebSocket Events

None (shift changes don't require real-time notifications).

---

## Error Codes

| Code           | Scenario                                      |
| -------------- | --------------------------------------------- |
| `UNAUTHORIZED` | Non-manager attempting manager-only operation |
| `BAD_REQUEST`  | Invalid input (ending non-active shift, etc.) |
| `NOT_FOUND`    | Shift ID doesn't exist                        |

---

## Testing Checklist

- [ ] Start shift with standard type (Breakfast, Lunch, Dinner)
- [ ] Start shift with custom type name
- [ ] Start shift with initial staff assignment
- [ ] List active shifts
- [ ] Verify warning when active shift > 12 hours
- [ ] Add staff to active shift
- [ ] Remove staff from active shift
- [ ] End shift and verify summary generation
- [ ] Verify totalOrders and totalRevenue are computed correctly
- [ ] End shift with open orders (display warning)
- [ ] List historical shifts by date range
- [ ] List historical shifts by shift type
- [ ] List historical shifts by staff member
- [ ] Get detailed shift summary
- [ ] Get current shift for authenticated user
- [ ] Verify orders auto-tagged with shift ID when created
- [ ] Verify shift summary persists after ending
