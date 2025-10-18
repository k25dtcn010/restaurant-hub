# API Contract: Modifiers Router

**Router**: `modifiers`  
**Package**: `packages/api/src/routers/modifiers.ts`  
**Date**: 2025-10-18

## Overview

tRPC procedures for managing menu modifiers and modifier groups.

---

## Procedures

### `modifiers.list`

List all modifiers with optional availability filtering.

**Type**: Query  
**Auth**: Public (customers see only available modifiers)

**Input Schema** (Zod):
```typescript
z.object({
  availableOnly: z.boolean().optional().default(false),
})
```

**Output Schema**:
```typescript
z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    priceAdjustment: z.number(), // cents
    isAvailable: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
)
```

**Logic**:
- If `availableOnly = true`, filter `WHERE isAvailable = true`
- Return all modifiers with metadata

---

### `modifiers.create`

Create a new modifier.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  name: z.string().min(1).max(100),
  priceAdjustment: z.number().int(), // can be negative
  isAvailable: z.boolean().default(true),
})
```

**Output Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string(),
  priceAdjustment: z.number(),
  isAvailable: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
```

**Logic**:
- Validate user role = "manager" via Better-Auth context
- Insert into `modifiers` table
- Return created modifier

**Errors**:
- `UNAUTHORIZED` if not manager
- `BAD_REQUEST` if name is duplicate (unique constraint)

---

### `modifiers.update`

Update an existing modifier.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  priceAdjustment: z.number().int().optional(),
  isAvailable: z.boolean().optional(),
})
```

**Output Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string(),
  priceAdjustment: z.number(),
  isAvailable: z.boolean(),
  updatedAt: z.date(),
})
```

**Logic**:
- Validate modifier exists
- Update only provided fields
- Return updated modifier

**Errors**:
- `NOT_FOUND` if modifier ID doesn't exist
- `UNAUTHORIZED` if not manager

---

### `modifiers.delete`

Delete a modifier (only if not assigned to any dishes).

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
  success: z.boolean(),
})
```

**Logic**:
- Check if modifier is assigned to any dishes via `dish_modifiers`
- If assigned, return error
- Otherwise, delete from `modifiers` table

**Errors**:
- `BAD_REQUEST` if modifier is assigned to dishes (message: "Cannot delete modifier assigned to dishes")
- `NOT_FOUND` if modifier ID doesn't exist

---

### `modifiers.listGroups`

List all modifier groups.

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
    name: z.string(),
    minSelections: z.number().nullable(),
    maxSelections: z.number().nullable(),
    displayOrder: z.number(),
  })
)
```

**Logic**:
- Return all modifier groups ordered by `displayOrder ASC`

---

### `modifiers.createGroup`

Create a new modifier group.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  name: z.string().min(1).max(100),
  minSelections: z.number().int().min(0).nullable().optional(),
  maxSelections: z.number().int().min(1).nullable().optional(),
  displayOrder: z.number().int().default(0),
}).refine(
  (data) => {
    if (data.minSelections != null && data.maxSelections != null) {
      return data.minSelections <= data.maxSelections
    }
    return true
  },
  { message: "minSelections must be <= maxSelections" }
)
```

**Output Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string(),
  minSelections: z.number().nullable(),
  maxSelections: z.number().nullable(),
  displayOrder: z.number(),
})
```

**Logic**:
- Validate min <= max constraint
- Insert into `modifier_groups` table
- Return created group

---

### `modifiers.updateGroup`

Update an existing modifier group.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  minSelections: z.number().int().min(0).nullable().optional(),
  maxSelections: z.number().int().min(1).nullable().optional(),
  displayOrder: z.number().int().optional(),
}).refine(
  (data) => {
    if (data.minSelections != null && data.maxSelections != null) {
      return data.minSelections <= data.maxSelections
    }
    return true
  },
  { message: "minSelections must be <= maxSelections" }
)
```

**Output Schema**:
```typescript
z.object({
  id: z.number(),
  name: z.string(),
  minSelections: z.number().nullable(),
  maxSelections: z.number().nullable(),
  displayOrder: z.number(),
})
```

---

### `modifiers.deleteGroup`

Delete a modifier group (only if not assigned to any dishes).

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
  success: z.boolean(),
})
```

**Logic**:
- Check if group is assigned to any dishes via `dish_modifiers`
- If assigned, return error
- Otherwise, delete from `modifier_groups` table

---

### `modifiers.listForDish`

List all modifiers available for a specific dish, grouped by modifier group.

**Type**: Query  
**Auth**: Public

**Input Schema**:
```typescript
z.object({
  dishId: z.number(),
})
```

**Output Schema**:
```typescript
z.array(
  z.object({
    group: z.object({
      id: z.number(),
      name: z.string(),
      minSelections: z.number().nullable(),
      maxSelections: z.number().nullable(),
      displayOrder: z.number(),
    }),
    modifiers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        priceAdjustment: z.number(),
        isAvailable: z.boolean(),
      })
    ),
  })
)
```

**Logic**:
- Join `dish_modifiers` → `modifier_groups` → `modifiers`
- Filter `WHERE dish_id = :dishId`
- Group results by `modifier_groups.id`
- Order by `modifier_groups.displayOrder ASC`

---

### `modifiers.assignToDish`

Assign modifiers to a dish within a specific modifier group.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  dishId: z.number(),
  modifierGroupId: z.number(),
  modifierIds: z.array(z.number()).min(1),
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
- Validate dish and modifier group exist
- Insert into `dish_modifiers` for each modifier ID
- Ignore duplicates (upsert pattern)

**Errors**:
- `NOT_FOUND` if dish or modifier group doesn't exist
- `BAD_REQUEST` if any modifier ID is invalid

---

### `modifiers.removeFromDish`

Remove modifiers from a dish.

**Type**: Mutation  
**Auth**: Manager only

**Input Schema**:
```typescript
z.object({
  dishId: z.number(),
  modifierIds: z.array(z.number()).min(1),
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
- Delete from `dish_modifiers` where `dishId` and `modifierId` match
- Return count of deleted rows

---

## WebSocket Events

### `modifier:unavailable`

Broadcast when a modifier becomes unavailable (e.g., ingredient depleted).

**Payload**:
```typescript
{
  type: "modifier:unavailable",
  modifierId: number,
  name: string,
}
```

**Recipients**: All connected clients viewing menus

---

## Error Codes

| Code            | Scenario                                      |
| --------------- | --------------------------------------------- |
| `UNAUTHORIZED`  | Non-manager attempting manager-only operation |
| `BAD_REQUEST`   | Invalid input (e.g., min > max, duplicate)    |
| `NOT_FOUND`     | Modifier/group ID doesn't exist               |
| `CONFLICT`      | Cannot delete modifier assigned to dishes     |

---

## Testing Checklist

- [ ] List modifiers (all vs. available only)
- [ ] Create modifier with positive price adjustment
- [ ] Create modifier with negative price adjustment (discount)
- [ ] Update modifier availability
- [ ] Delete unassigned modifier
- [ ] Fail to delete modifier assigned to dish
- [ ] Create modifier group with min/max constraints
- [ ] Validate min <= max constraint enforcement
- [ ] List modifiers for dish (grouped by modifier group)
- [ ] Assign modifiers to dish
- [ ] Remove modifiers from dish
- [ ] Test WebSocket broadcast when modifier becomes unavailable
