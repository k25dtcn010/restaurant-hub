# API Contracts: Tables Router

**Router**: `tables`  
**Path**: `/trpc/tables.*`  
**Authentication**: Public for validation, Manager-only for setup

## Purpose

Manages table configuration and QR code generation for customer ordering.

---

## Procedures

### 1. `tables.getAll`

**Type**: `query`  
**Auth**: Required (Manager, Waiter)  
**Description**: Retrieves all configured tables with active order status.

**Input Schema**: None

**Output Schema**:
```typescript
{
  tables: Array<{
    id: number,
    number: number,          // 1-30
    qrCode: string,
    capacity: number,
    hasActiveOrder: boolean, // Whether unpaid order exists
    activeOrderId: number | null,
    createdAt: Date
  }>
}
```

**Business Logic**:
- Join with `orders` to compute `hasActiveOrder` (status != 'Paid')
- Sort by table number ascending

---

### 2. `tables.getById`

**Type**: `query`  
**Auth**: Public  
**Description**: Validates a table ID exists (used when scanning QR code).

**Input Schema**:
```typescript
{
  tableId: number
}
```

**Output Schema**:
```typescript
{
  id: number,
  number: number,
  qrCode: string,
  capacity: number,
  isValid: boolean
}
```

**Errors**:
- `NOT_FOUND`: Table ID does not exist (returns `isValid: false`)

---

### 3. `tables.create`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Creates a new table with QR code (setup phase).

**Input Schema**:
```typescript
{
  number: number,            // 1-30, unique
  capacity: number           // > 0
}
```

**Output Schema**:
```typescript
{
  tableId: number,
  number: number,
  qrCode: string,            // Generated URL
  capacity: number
}
```

**Business Logic**:
- Generate QR code URL: `https://app.restauranthub.com/?table={number}`
- Validate table number is unique and within 1-30 range

**Errors**:
- `BAD_REQUEST`: Table number already exists or out of range
- `FORBIDDEN`: User is not Manager

---

### 4. `tables.update`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Updates table metadata (capacity).

**Input Schema**:
```typescript
{
  tableId: number,
  capacity?: number
}
```

**Output Schema**:
```typescript
{
  tableId: number,
  capacity: number,
  updatedAt: Date
}
```

**Errors**:
- `NOT_FOUND`: Table ID does not exist
- `FORBIDDEN`: User is not Manager

---

### 5. `tables.delete`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Deletes a table (only if no order history exists).

**Input Schema**:
```typescript
{
  tableId: number
}
```

**Output Schema**:
```typescript
{
  tableId: number,
  deleted: boolean
}
```

**Business Logic**:
- Check if table has any orders in `orders` table
- If orders exist: Return error (cannot delete)
- If no orders: Hard delete table

**Errors**:
- `NOT_FOUND`: Table ID does not exist
- `BAD_REQUEST`: Table has order history (cannot delete)
- `FORBIDDEN`: User is not Manager

---

## Type Definitions

```typescript
export type Table = {
  id: number
  number: number  // 1-30
  qrCode: string
  capacity: number
  createdAt: Date
}
```

---

**Phase 1B-4 Complete**: Tables router contract specified.
