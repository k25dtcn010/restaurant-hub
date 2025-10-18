# API Contracts: Dishes Router

**Router**: `dishes`  
**Path**: `/trpc/dishes.*`  
**Authentication**: Public for menu viewing, Manager-only for modifications

## Purpose

Manages menu items (dishes) that customers can order, including CRUD operations and availability management.

---

## Procedures

### 1. `dishes.getAll`

**Type**: `query`  
**Auth**: Public  
**Description**: Retrieves all active dishes for customer menu display.

**Input Schema**:

```typescript
{
  includeDisabled?: boolean  // Default: false (only show isAvailable=true)
}
```

**Output Schema**:

```typescript
{
  dishes: Array<{
    id: number
    name: string
    description: string
    price: number // In cents
    photoUrl: string | null
    isAvailable: boolean // Computed: dish enabled AND all ingredients in stock
    createdAt: Date
  }>
}
```

**Business Logic**:

- If `includeDisabled = false`: Filter `isAvailable = true` only
- Join with `recipe` and `ingredients` to check stock availability
- Dish is unavailable if any required ingredient has `quantity = 0`

---

### 2. `dishes.getById`

**Type**: `query`  
**Auth**: Public  
**Description**: Retrieves detailed information for a specific dish including recipe.

**Input Schema**:

```typescript
{
  dishId: number
}
```

**Output Schema**:

```typescript
{
  id: number,
  name: string,
  description: string,
  price: number,
  photoUrl: string | null,
  isAvailable: boolean,
  recipe: Array<{
    ingredientId: number,
    ingredientName: string,
    quantityRequired: number,
    unit: string,
    currentStock: number     // Ingredient quantity available
  }>,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3. `dishes.create`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Creates a new dish with recipe (FR-001a).

**Input Schema**:

```typescript
{
  name: string,              // Max 100 chars
  description: string,       // Max 500 chars
  price: number,             // In cents, >= 0
  photoUrl?: string | null,  // Valid URL
  recipe: Array<{
    ingredientId: number,
    quantityRequired: number // > 0
  }>
}
```

**Output Schema**:

```typescript
{
  dishId: number,
  name: string,
  price: number
}
```

**Business Logic**:

- Validate all ingredient IDs exist in database
- Create dish entry in `dishes` table
- Create recipe entries in `recipe` table
- Initial `isAvailable = true`

**Errors**:

- `BAD_REQUEST`: Invalid input (empty name, negative price, invalid ingredient IDs)
- `FORBIDDEN`: User is not Manager

---

### 4. `dishes.update`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Updates existing dish details (FR-001b).

**Input Schema**:

```typescript
{
  dishId: number,
  name?: string,
  description?: string,
  price?: number,
  photoUrl?: string | null,
  recipe?: Array<{
    ingredientId: number,
    quantityRequired: number
  }>
}
```

**Output Schema**:

```typescript
{
  dishId: number,
  updatedFields: string[],   // List of fields changed
  updatedAt: Date
}
```

**Business Logic**:

- Update only provided fields (partial update)
- If `recipe` provided, delete existing recipe entries and create new ones
- Update `updatedAt` timestamp
- Validate recipe ingredient IDs exist

**Errors**:

- `NOT_FOUND`: Dish ID does not exist
- `BAD_REQUEST`: Invalid input
- `FORBIDDEN`: User is not Manager

---

### 5. `dishes.toggleAvailability`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Enables or disables a dish (FR-001c).

**Input Schema**:

```typescript
{
  dishId: number,
  isAvailable: boolean
}
```

**Output Schema**:

```typescript
{
  dishId: number,
  isAvailable: boolean,
  updatedAt: Date
}
```

**Business Logic**:

- Set `isAvailable` field in database
- Disabled dishes (`isAvailable = false`) are hidden from customer menu
- Dishes remain in database for historical order references

**Errors**:

- `NOT_FOUND`: Dish ID does not exist
- `FORBIDDEN`: User is not Manager

---

### 6. `dishes.delete`

**Type**: `mutation`  
**Auth**: Required (Manager only)  
**Description**: Soft-deletes a dish (sets `isAvailable = false`). Hard delete prevented if dish exists in order history.

**Input Schema**:

```typescript
{
  dishId: number
}
```

**Output Schema**:

```typescript
{
  dishId: number,
  deleted: boolean
}
```

**Business Logic**:

- Check if dish exists in `order_items` table
- If exists: Set `isAvailable = false` (soft delete)
- If not exists: Hard delete from `dishes` and `recipe` tables (cascade)

**Errors**:

- `NOT_FOUND`: Dish ID does not exist
- `FORBIDDEN`: User is not Manager

---

## Type Definitions

```typescript
export type Dish = {
  id: number
  name: string
  description: string
  price: number // cents
  photoUrl: string | null
  isAvailable: boolean
  createdAt: Date
  updatedAt: Date
}

export type DishWithRecipe = Dish & {
  recipe: Array<{
    ingredientId: number
    ingredientName: string
    quantityRequired: number
    unit: string
    currentStock: number
  }>
}
```

---

**Phase 1B-2 Complete**: Dishes router contract specified with menu management procedures.
