# API Contracts: Inventory Router

**Router**: `inventory`  
**Path**: `/trpc/inventory.*`  
**Authentication**: Manager-only (all procedures)

## Purpose

Manages ingredient inventory tracking, stock adjustments, and low-stock alerts (P3 priority - User Story 5).

---

## Procedures

### 1. `inventory.getAll`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves all ingredients with current stock levels and alerts (FR-007, FR-012).

**Input Schema**:
```typescript
{
  includeRecipes?: boolean   // Include which dishes use each ingredient
}
```

**Output Schema**:
```typescript
{
  ingredients: Array<{
    id: number,
    name: string,
    quantity: number,
    unit: string,
    threshold: number,
    isLowStock: boolean,     // Computed: quantity < threshold
    updatedAt: Date,
    usedInDishes?: Array<{  // If includeRecipes=true
      dishId: number,
      dishName: string,
      quantityRequired: number
    }>
  }>
}
```

**Business Logic**:
- Join with `recipe` and `dishes` if `includeRecipes = true`
- Calculate `isLowStock` flag for each ingredient
- Sort by `isLowStock DESC, name ASC` (low-stock items first)

---

### 2. `inventory.getById`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves detailed information for a specific ingredient.

**Input Schema**:
```typescript
{
  ingredientId: number
}
```

**Output Schema**:
```typescript
{
  id: number,
  name: string,
  quantity: number,
  unit: string,
  threshold: number,
  isLowStock: boolean,
  usedInDishes: Array<{
    dishId: number,
    dishName: string,
    quantityRequired: number
  }>,
  updatedAt: Date
}
```

**Errors**:
- `NOT_FOUND`: Ingredient ID does not exist

---

### 3. `inventory.adjustStock`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Manually adjusts ingredient stock (FR-010).

**Input Schema**:
```typescript
{
  ingredientId: number,
  adjustment: number,        // Positive (add stock) or negative (reduce stock)
  reason?: string            // Optional audit note
}
```

**Output Schema**:
```typescript
{
  ingredientId: number,
  oldQuantity: number,
  newQuantity: number,
  adjustment: number,
  updatedAt: Date
}
```

**Business Logic**:
- Validate new quantity will not be negative: `currentQuantity + adjustment >= 0`
- Update `ingredients.quantity`
- Log adjustment in audit trail (optional: create `inventory_audit_log` table)
- Update `updatedAt` timestamp
- Check if new quantity crosses threshold and trigger alert

**Errors**:
- `NOT_FOUND`: Ingredient ID does not exist
- `BAD_REQUEST`: Adjustment would result in negative quantity

---

### 4. `inventory.setThreshold`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Sets low-stock alert threshold for an ingredient (FR-011).

**Input Schema**:
```typescript
{
  ingredientId: number,
  threshold: number          // New threshold value (>= 0)
}
```

**Output Schema**:
```typescript
{
  ingredientId: number,
  threshold: number,
  isLowStock: boolean,       // Recomputed with new threshold
  updatedAt: Date
}
```

**Business Logic**:
- Update `ingredients.threshold`
- Recompute `isLowStock` status
- If newly below threshold, trigger alert notification

**Errors**:
- `NOT_FOUND`: Ingredient ID does not exist
- `BAD_REQUEST`: Threshold is negative

---

### 5. `inventory.getLowStockAlerts`

**Type**: `query`  
**Auth**: Required (Manager only)  
**Description**: Retrieves all ingredients currently below their threshold (FR-012).

**Input Schema**: None

**Output Schema**:
```typescript
{
  alerts: Array<{
    ingredientId: number,
    name: string,
    quantity: number,
    threshold: number,
    deficit: number,         // threshold - quantity
    affectedDishes: Array<{ dishId: number, dishName: string }>,
    updatedAt: Date
  }>,
  totalAlerts: number
}
```

**Business Logic**:
- Query ingredients where `quantity < threshold`
- Join with `recipe` and `dishes` to show affected menu items
- Sort by `deficit DESC` (most critical first)

---

### 6. `inventory.create`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Adds a new ingredient to inventory.

**Input Schema**:
```typescript
{
  name: string,              // Unique, max 100 chars
  quantity: number,          // Initial stock
  unit: string,              // e.g., "kg", "L", "pieces"
  threshold: number          // Low-stock alert level
}
```

**Output Schema**:
```typescript
{
  ingredientId: number,
  name: string,
  quantity: number,
  unit: string,
  threshold: number
}
```

**Errors**:
- `BAD_REQUEST`: Ingredient name already exists, invalid input
- `FORBIDDEN`: User is not Manager

---

### 7. `inventory.update`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Updates ingredient metadata (name, unit).

**Input Schema**:
```typescript
{
  ingredientId: number,
  name?: string,
  unit?: string
}
```

**Output Schema**:
```typescript
{
  ingredientId: number,
  updatedFields: string[],
  updatedAt: Date
}
```

**Errors**:
- `NOT_FOUND`: Ingredient ID does not exist
- `BAD_REQUEST`: Name already exists (uniqueness violation)

---

## WebSocket Notifications

When ingredient stock falls below threshold:

```typescript
{
  type: 'LOW_STOCK_ALERT',
  payload: {
    ingredientId: number,
    ingredientName: string,
    currentQuantity: number,
    threshold: number,
    affectedDishes: string[],  // Dish names
    timestamp: Date
  }
}
```

**Recipients**: All connected `manager` role users

---

## Type Definitions

```typescript
export type Ingredient = {
  id: number
  name: string
  quantity: number
  unit: string
  threshold: number
  updatedAt: Date
}

export type IngredientWithAlert = Ingredient & {
  isLowStock: boolean
  deficit?: number
}
```

---

**Phase 1B-3 Complete**: Inventory router contract specified with stock management procedures.
