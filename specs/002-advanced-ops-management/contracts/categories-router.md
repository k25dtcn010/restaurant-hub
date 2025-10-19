# API Contract: Categories Router

**Router**: `categories`  
**Package**: `packages/api/src/routers/categories.ts`  
**Date**: 2025-10-18

## Overview

tRPC procedures for managing menu categories and organizing dishes.

---

## Procedures

### `categories.list`

List all categories with optional visibility filtering.

**Type**: Query  
**Auth**: Public (customers see only visible categories)

**Input Schema** (Zod):

```typescript
z.object({
  visibleOnly: z.boolean().optional().default(false),
})
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    displayOrder: z.number(),
    iconUrl: z.string().nullable(),
    isHidden: z.boolean(),
    dishCount: z.number(), // count of dishes in this category
  })
).transform((categories) => categories.sort((a, b) => a.displayOrder - b.displayOrder))
```

**Logic**:

- If `visibleOnly = true`, filter `WHERE isHidden = false`
- Join with `dish_categories` to count dishes per category
- Order by `displayOrder ASC`

---

### `categories.create`

Create a new category.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  name: z.string().min(1).max(100),
  displayOrder: z.number().int().default(0),
  iconUrl: z.string().url().optional().nullable(),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  name: z.string(),
  displayOrder: z.number(),
  iconUrl: z.string().nullable(),
  isHidden: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate user role = "manager"
- Insert into `categories` table
- Return created category

**Errors**:

- `UNAUTHORIZED` if not manager
- `BAD_REQUEST` if name is duplicate

---

### `categories.update`

Update an existing category.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  displayOrder: z.number().int().optional(),
  iconUrl: z.string().url().nullable().optional(),
  isHidden: z.boolean().optional(),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  name: z.string(),
  displayOrder: z.number(),
  iconUrl: z.string().nullable(),
  isHidden: z.boolean(),
  updatedAt: z.date(),
})
```

**Logic**:

- Validate category exists
- Update only provided fields
- Return updated category

**Errors**:

- `NOT_FOUND` if category ID doesn't exist
- `UNAUTHORIZED` if not manager

---

### `categories.toggleVisibility`

Hide or show a category (soft delete pattern).

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  id: z.number(),
  isHidden: z.boolean(),
})
```

**Output Schema**:

```typescript
z.object({
  id: z.number(),
  isHidden: z.boolean(),
})
```

**Logic**:

- Update `isHidden` field
- Return updated category
- Use optimistic updates in UI

---

### `categories.delete`

**NOT SUPPORTED** - Categories cannot be permanently deleted per constitution (soft delete only).

Instead, use `categories.toggleVisibility` with `isHidden = true`.

---

### `categories.listDishes`

List all dishes in a specific category.

**Type**: Query  
**Auth**: Public

**Input Schema**:

```typescript
z.object({
  categoryId: z.number(),
  includeHidden: z.boolean().optional().default(false), // for manager view
})
```

**Output Schema**:

```typescript
z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
    photoUrl: z.string().nullable(),
    isAvailable: z.boolean(),
    isHidden: z.boolean(),
    isRecommended: z.boolean(),
    isChefSpecial: z.boolean(),
  })
)
```

**Logic**:

- Join `dish_categories` → `dishes`
- Filter `WHERE category_id = :categoryId`
- If `includeHidden = false`, filter `AND dishes.isHidden = false`
- Order by dish name

---

### `categories.assignDishes`

Assign multiple dishes to a category.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  categoryId: z.number(),
  dishIds: z.array(z.number()).min(1),
})
```

**Output Schema**:

```typescript
z.object({
  success: z.boolean(),
  assignedCount: z.number(),
})
```

**Logic**:

- Validate category exists
- Insert into `dish_categories` for each dish ID
- Ignore duplicates (upsert pattern)

**Errors**:

- `NOT_FOUND` if category doesn't exist
- `BAD_REQUEST` if any dish ID is invalid

---

### `categories.removeDishes`

Remove dishes from a category.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  categoryId: z.number(),
  dishIds: z.array(z.number()).min(1),
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

- Delete from `dish_categories` where `categoryId` and `dishId` match
- Return count of deleted rows

---

### `categories.reorder`

Batch update display order for categories (drag-and-drop support).

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:

```typescript
z.object({
  categoryOrders: z
    .array(
      z.object({
        id: z.number(),
        displayOrder: z.number().int(),
      })
    )
    .min(1),
})
```

**Output Schema**:

```typescript
z.object({
  success: z.boolean(),
  updatedCount: z.number(),
})
```

**Logic**:

- Batch update `displayOrder` for each category ID
- Use transaction to ensure atomic update

---

## WebSocket Events

None (category changes don't require real-time notifications).

---

## Error Codes

| Code           | Scenario                                      |
| -------------- | --------------------------------------------- |
| `UNAUTHORIZED` | Non-manager attempting manager-only operation |
| `BAD_REQUEST`  | Invalid input (e.g., duplicate name)          |
| `NOT_FOUND`    | Category ID doesn't exist                     |

---

## Testing Checklist

- [ ] List categories (all vs. visible only)
- [ ] Create category with icon URL
- [ ] Update category name and display order
- [ ] Toggle category visibility (hide/show)
- [ ] Verify hidden categories not shown in customer queries
- [ ] List dishes in category
- [ ] Assign dishes to category
- [ ] Remove dishes from category
- [ ] Reorder categories (drag-and-drop simulation)
- [ ] Verify category dish count updates correctly
