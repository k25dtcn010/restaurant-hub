# API Contract: Reservations Router

**Router**: `reservations`  
**Package**: `packages/api/src/routers/reservations.ts`  
**Date**: 2025-10-18

## Overview

tRPC procedures for managing table reservations and operating hours configuration.

---

## Operating Hours Procedures

### `reservations.getOperatingHours`

Get operating hours for all days of the week.

**Type**: Query  
**Auth**: Public

**Input Schema**:

```typescript
z.object({}) // no params
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    dayOfWeek: z.number(), // 0-6 (Sunday-Saturday)
    openTime: z.string(), // HH:MM format
    closeTime: z.string(), // HH:MM format
    isClosed: z.boolean(),
  })
).transform((hours) => hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek))
```

**Logic**:

- Return all operating hours records ordered by day of week
- If no records exist, return empty array (initial setup state)

---

### `reservations.updateOperatingHours`

Update operating hours for a specific day.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isClosed: z.boolean().optional().default(false),
}).refine(
  (data) => {
    if (data.isClosed) return true
    return data.openTime < data.closeTime
  },
  { message: "openTime must be before closeTime" }
)
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  dayOfWeek: z.number(),
  openTime: z.string(),
  closeTime: z.string(),
  isClosed: z.boolean(),
})
```

**Logic**:

- Upsert operating hours for the specified day
- Validate open < close time unless day is closed

**Errors**:

- `BAD_REQUEST` if openTime >= closeTime (when not closed)
- `UNAUTHORIZED` if not manager

---

## Reservation Procedures

### `reservations.create`

Create a new reservation (public form).

**Type**: Mutation  
**Auth**: None (public endpoint with rate limiting)

**Input Schema**:

```typescript
z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/), // HH:MM (30-min increments)
  partySize: z.number().int().min(1).max(20),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(10).max(20),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    const reservationDate = new Date(data.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return reservationDate >= today
  },
  { message: "Reservation date cannot be in the past" }
)
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  date: z.string(),
  time: z.string(),
  partySize: z.number(),
  customerName: z.string(),
  customerPhone: z.string(),
  notes: z.string().nullable(),
  status: z.literal("Pending"),
  createdAt: z.date(),
})
```

**Logic**:

- Validate date is not in the past
- Validate time is within operating hours for that day of week
- Create reservation with status = "Pending"
- Trigger WebSocket notification to staff dashboard
- Apply rate limiting (max 5 requests per IP per hour)

**Errors**:

- `BAD_REQUEST` if date is in past or time is outside operating hours
- `TOO_MANY_REQUESTS` if rate limit exceeded

---

### `reservations.list`

List reservations with filtering.

**Type**: Query  
**Auth**: Staff or Manager

**Input Schema**:

```typescript
z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // filter by date
  status: z.enum(["Pending", "Confirmed", "Seated", "No-Show", "Cancelled", "Declined"]).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // date range start
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // date range end
})
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    date: z.string(),
    time: z.string(),
    partySize: z.number(),
    customerName: z.string(),
    customerPhone: z.string(),
    notes: z.string().nullable(),
    status: z.enum(["Pending", "Confirmed", "Seated", "No-Show", "Cancelled", "Declined"]),
    assignedTableIds: z.array(z.number()).nullable(),
    declineReason: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
).transform((reservations) =>
  reservations.sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time}`)
    const dateTimeB = new Date(`${b.date}T${b.time}`)
    return dateTimeA.getTime() - dateTimeB.getTime()
  })
)
```

**Logic**:

- Filter by date (exact match) or date range (start/end)
- Filter by status if provided
- Order by date + time ASC
- Highlight reservations within 15 minutes of current time (UI responsibility)

---

### `reservations.confirm`

Confirm a pending reservation.

**Type**: Mutation  
**Auth**: Staff or Manager

**Input Schema**:

```typescript
z.object({
  id: z.number(),
  assignedTableIds: z.array(z.number()).min(1).optional(), // optional table assignment
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  status: z.literal("Confirmed"),
  assignedTableIds: z.array(z.number()).nullable(),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate reservation exists and status = "Pending"
- Check table availability for reservation date/time (warn if conflicts)
- Update status to "Confirmed"
- Optionally assign tables

**Errors**:

- `NOT_FOUND` if reservation doesn't exist
- `BAD_REQUEST` if status is not "Pending"
- `CONFLICT` if assigned tables are already booked (soft warning, not error)

---

### `reservations.decline`

Decline a pending reservation.

**Type**: Mutation  
**Auth**: Staff or Manager

**Input Schema**:

```typescript
z.object({
  id: z.number(),
  declineReason: z.string().min(1).max(500),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  status: z.literal("Declined"),
  declineReason: z.string(),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate reservation exists and status = "Pending"
- Update status to "Declined" with reason

---

### `reservations.markSeated`

Mark confirmed reservation as seated (customer arrived).

**Type**: Mutation  
**Auth**: Staff or Manager

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
  status: z.literal("Seated"),
  updatedAt: z.date(),
  orderSessionId: z.number().nullable(), // if auto-created order session
})
```

**Logic**:

- Validate reservation exists and status = "Confirmed"
- Update status to "Seated"
- Optionally create order session for assigned tables (future enhancement)

**Errors**:

- `NOT_FOUND` if reservation doesn't exist
- `BAD_REQUEST` if status is not "Confirmed"

---

### `reservations.markNoShow`

Mark confirmed reservation as no-show (customer didn't arrive).

**Type**: Mutation  
**Auth**: Staff or Manager

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
  status: z.literal("No-Show"),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate reservation exists and status = "Confirmed"
- Update status to "No-Show"
- Release assigned tables

---

### `reservations.cancel`

Cancel a reservation (customer or staff initiated).

**Type**: Mutation  
**Auth**: Public (with reservation ID validation) or Staff/Manager

**Input Schema**:

```typescript
z.object({
  id: z.number(),
  cancelledBy: z.enum(["customer", "staff"]).optional().default("staff"),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  status: z.literal("Cancelled"),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate reservation exists
- For customer cancellation: allow only if status = "Pending" or "Confirmed" and time is > 1 hour away
- For staff cancellation: allow any time
- Update status to "Cancelled"

**Errors**:

- `BAD_REQUEST` if customer tries to cancel within 1 hour of reservation time
- `NOT_FOUND` if reservation doesn't exist

---

### `reservations.checkAvailability`

Check table availability for a given date/time/party size.

**Type**: Query  
**Auth**: Public

**Input Schema**:

```typescript
z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/),
  partySize: z.number().int().min(1).max(20),
})
```

**Output Schema**:

```typescript
z.object({
  available: z.boolean(),
  suggestedTimes: z.array(z.string()).optional(), // alternative times if not available
  availableTables: z
    .array(
      z.object({
        id: z.number(),
        tableNumber: z.string(),
        capacity: z.number(),
      })
    )
    .optional(),
})
```

**Logic**:

- Query confirmed reservations for date/time ± 90 minutes (default reservation duration)
- Count available tables with capacity >= party size
- If no single table fits, suggest table combinations
- If no availability, suggest times 30 minutes before/after

---

## WebSocket Events

### `reservation:new`

Broadcast when new reservation submitted.

**Payload**:

```typescript
{
  type: "reservation:new",
  reservation: {
    id: number,
    date: string,
    time: string,
    partySize: number,
    customerName: string,
    status: "Pending",
  },
}
```

**Recipients**: Staff and Manager roles only

---

### `reservation:confirmed`

Broadcast when reservation confirmed by staff.

**Payload**:

```typescript
{
  type: "reservation:confirmed",
  reservationId: number,
  assignedTableIds: number[],
}
```

**Recipients**: Staff and Manager roles only

---

## Error Codes

| Code                | Scenario                                            |
| ------------------- | --------------------------------------------------- |
| `UNAUTHORIZED`      | Non-staff/manager accessing restricted procedures   |
| `BAD_REQUEST`       | Invalid input (past date, time outside hours, etc.) |
| `NOT_FOUND`         | Reservation ID doesn't exist                        |
| `CONFLICT`          | Table availability conflict (soft warning)          |
| `TOO_MANY_REQUESTS` | Rate limit exceeded on public reservation creation  |

---

## Testing Checklist

- [ ] Get operating hours (all days)
- [ ] Update operating hours for weekday vs. weekend
- [ ] Mark day as closed (holiday)
- [ ] Create reservation (valid date/time)
- [ ] Reject reservation for past date
- [ ] Reject reservation for time outside operating hours
- [ ] Reject reservation for closed day
- [ ] List reservations by date
- [ ] List reservations by status
- [ ] Confirm pending reservation
- [ ] Confirm reservation with table assignment
- [ ] Decline pending reservation with reason
- [ ] Mark confirmed reservation as seated
- [ ] Mark confirmed reservation as no-show
- [ ] Cancel reservation (customer initiated, > 1 hour before)
- [ ] Reject customer cancellation within 1 hour of time
- [ ] Cancel reservation (staff initiated, any time)
- [ ] Check availability for date/time/party size
- [ ] Suggest alternative times when not available
- [ ] Test WebSocket notification on new reservation
- [ ] Test rate limiting on public reservation creation
