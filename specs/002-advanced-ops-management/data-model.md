# Data Model: Advanced Operations Management

**Feature**: 002-advanced-ops-management  
**Date**: 2025-10-18  
**Status**: Complete

## Overview

This document defines the database schema extensions for menu modifiers, categories, variants, reservations, and shift management. All entities follow Drizzle ORM patterns with full TypeScript type safety.

---

## 1. Menu Modifiers

### 1.1 Modifier

Represents a customization option that can be applied to dishes (e.g., "extra cheese", "no onions").

**Table**: `modifiers`

| Column          | Type      | Constraints                    | Description                                   |
| --------------- | --------- | ------------------------------ | --------------------------------------------- |
| id              | integer   | PRIMARY KEY, AUTO INCREMENT    | Unique modifier identifier                    |
| name            | text      | NOT NULL                       | Modifier display name (e.g., "Extra Cheese")  |
| priceAdjustment | integer   | NOT NULL                       | Price change in cents (can be negative, 0, +) |
| isAvailable     | boolean   | NOT NULL, DEFAULT true         | Whether modifier can be selected              |
| createdAt       | timestamp | NOT NULL, DEFAULT CURRENT_TIME | Creation timestamp                            |
| updatedAt       | timestamp | NOT NULL, AUTO UPDATE          | Last update timestamp                         |

**Indexes**:

- Primary key on `id`

**Relations**:

- One-to-many with `dishModifiers` (a modifier can be assigned to multiple dishes)
- One-to-many with `orderItemModifiers` (a modifier can appear in multiple orders)

---

### 1.2 ModifierGroup

Represents a category of modifiers (e.g., "Toppings", "Preparation Style") with optional selection constraints.

**Table**: `modifier_groups`

| Column        | Type    | Constraints                 | Description                                     |
| ------------- | ------- | --------------------------- | ----------------------------------------------- |
| id            | integer | PRIMARY KEY, AUTO INCREMENT | Unique group identifier                         |
| name          | text    | NOT NULL                    | Group display name (e.g., "Toppings")           |
| minSelections | integer | NULL                        | Minimum modifiers to select (null = no minimum) |
| maxSelections | integer | NULL                        | Maximum modifiers to select (null = unlimited)  |
| displayOrder  | integer | NOT NULL, DEFAULT 0         | Order for UI display (lower = higher priority)  |

**Indexes**:

- Primary key on `id`
- Index on `displayOrder` for sorting

**Relations**:

- One-to-many with `dishModifiers` (a group can be assigned to multiple dishes)

---

### 1.3 DishModifier

Join table linking dishes to available modifiers within a specific modifier group.

**Table**: `dish_modifiers`

| Column          | Type    | Constraints                                 | Description                    |
| --------------- | ------- | ------------------------------------------- | ------------------------------ |
| dishId          | integer | NOT NULL, FOREIGN KEY → dishes(id)          | Associated dish                |
| modifierId      | integer | NOT NULL, FOREIGN KEY → modifiers(id)       | Associated modifier            |
| modifierGroupId | integer | NOT NULL, FOREIGN KEY → modifier_groups(id) | Modifier group this belongs to |

**Indexes**:

- Composite primary key on `(dishId, modifierId)`
- Index on `dishId` for querying modifiers by dish
- Index on `modifierId` for reverse lookups

**Relations**:

- Many-to-one with `dishes`
- Many-to-one with `modifiers`
- Many-to-one with `modifierGroups`

---

### 1.4 OrderItemModifier

Join table tracking which modifiers were selected for each order item (with historical pricing).

**Table**: `order_item_modifiers`

| Column       | Type    | Constraints                             | Description                              |
| ------------ | ------- | --------------------------------------- | ---------------------------------------- |
| orderItemId  | integer | NOT NULL, FOREIGN KEY → order_items(id) | Associated order item                    |
| modifierId   | integer | NOT NULL, FOREIGN KEY → modifiers(id)   | Associated modifier                      |
| name         | text    | NOT NULL                                | Modifier name at order time (historical) |
| priceAtOrder | integer | NOT NULL                                | Price adjustment at order time (cents)   |

**Indexes**:

- Composite primary key on `(orderItemId, modifierId)`
- Index on `orderItemId` for querying modifiers per order item

**Relations**:

- Many-to-one with `orderItems`
- Many-to-one with `modifiers`

---

## 2. Menu Categories

### 2.1 Category

Represents a menu section for organizing dishes (e.g., "Appetizers", "Main Course", "Desserts").

**Table**: `categories`

| Column       | Type      | Constraints                    | Description                                |
| ------------ | --------- | ------------------------------ | ------------------------------------------ |
| id           | integer   | PRIMARY KEY, AUTO INCREMENT    | Unique category identifier                 |
| name         | text      | NOT NULL                       | Category display name (e.g., "Appetizers") |
| displayOrder | integer   | NOT NULL, DEFAULT 0            | Order for UI display (lower = higher)      |
| iconUrl      | text      | NULL                           | Optional icon/image URL                    |
| isHidden     | boolean   | NOT NULL, DEFAULT false        | Soft delete flag (hidden from customers)   |
| createdAt    | timestamp | NOT NULL, DEFAULT CURRENT_TIME | Creation timestamp                         |
| updatedAt    | timestamp | NOT NULL, AUTO UPDATE          | Last update timestamp                      |

**Indexes**:

- Primary key on `id`
- Index on `displayOrder` for sorting
- Index on `isHidden` for filtering visible categories

**Relations**:

- One-to-many with `dishCategories` (a category can contain multiple dishes)

---

### 2.2 DishCategory

Join table linking dishes to categories (many-to-many relationship).

**Table**: `dish_categories`

| Column     | Type    | Constraints                            | Description         |
| ---------- | ------- | -------------------------------------- | ------------------- |
| dishId     | integer | NOT NULL, FOREIGN KEY → dishes(id)     | Associated dish     |
| categoryId | integer | NOT NULL, FOREIGN KEY → categories(id) | Associated category |

**Indexes**:

- Composite primary key on `(dishId, categoryId)`
- Index on `dishId` for querying categories by dish
- Index on `categoryId` for querying dishes by category

**Relations**:

- Many-to-one with `dishes`
- Many-to-one with `categories`

---

## 3. Dish Variants

### 3.1 DishVariant

Represents size or option variations for a dish (e.g., "Small", "Medium", "Large").

**Table**: `dish_variants`

| Column       | Type    | Constraints                        | Description                                   |
| ------------ | ------- | ---------------------------------- | --------------------------------------------- |
| id           | integer | PRIMARY KEY, AUTO INCREMENT        | Unique variant identifier                     |
| dishId       | integer | NOT NULL, FOREIGN KEY → dishes(id) | Parent dish                                   |
| name         | text    | NOT NULL                           | Variant name (e.g., "Small", "Medium")        |
| price        | integer | NOT NULL                           | Variant price in cents (overrides base price) |
| displayOrder | integer | NOT NULL, DEFAULT 0                | Order for UI display                          |

**Indexes**:

- Primary key on `id`
- Index on `dishId` for querying variants by dish
- Index on `displayOrder` for sorting

**Relations**:

- Many-to-one with `dishes`
- One-to-many with `variantRecipes` (optional, for variant-specific ingredients)
- One-to-many with `orderItems` (tracking which variant was ordered)

---

### 3.2 VariantRecipe

Optional table for variant-specific ingredient requirements (when different sizes use different amounts).

**Table**: `variant_recipes`

| Column           | Type    | Constraints                               | Description                    |
| ---------------- | ------- | ----------------------------------------- | ------------------------------ |
| variantId        | integer | NOT NULL, FOREIGN KEY → dish_variants(id) | Associated variant             |
| ingredientId     | integer | NOT NULL, FOREIGN KEY → ingredients(id)   | Required ingredient            |
| quantityRequired | integer | NOT NULL                                  | Amount needed for this variant |

**Indexes**:

- Composite primary key on `(variantId, ingredientId)`
- Index on `variantId` for querying ingredients by variant

**Relations**:

- Many-to-one with `dishVariants`
- Many-to-one with `ingredients`

---

## 4. Dish Extensions

### 4.1 Dishes Table Updates

Extend existing `dishes` table with new columns for flags and visibility.

**New Columns**:

| Column        | Type    | Constraints             | Description                                  |
| ------------- | ------- | ----------------------- | -------------------------------------------- |
| isHidden      | boolean | NOT NULL, DEFAULT false | Temporary hide flag (86'd items)             |
| isRecommended | boolean | NOT NULL, DEFAULT false | Display "Recommended" badge                  |
| isChefSpecial | boolean | NOT NULL, DEFAULT false | Display "Chef's Special" badge               |
| orderPriority | integer | NOT NULL, DEFAULT 0     | Kitchen prep priority (higher = more urgent) |

**Migration**:

```sql
ALTER TABLE dishes ADD COLUMN is_hidden INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE dishes ADD COLUMN is_recommended INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE dishes ADD COLUMN is_chef_special INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE dishes ADD COLUMN order_priority INTEGER DEFAULT 0 NOT NULL;
```

---

## 5. Order Items Extensions

### 5.1 OrderItems Table Updates

Extend existing `order_items` table to support variants and special requests.

**New Columns**:

| Column         | Type    | Constraints                           | Description                            |
| -------------- | ------- | ------------------------------------- | -------------------------------------- |
| variantId      | integer | NULL, FOREIGN KEY → dish_variants(id) | Selected variant (null if no variants) |
| specialRequest | text    | NULL, MAX 200 chars                   | Custom preparation notes               |

**Migration**:

```sql
ALTER TABLE order_items ADD COLUMN variant_id INTEGER REFERENCES dish_variants(id);
ALTER TABLE order_items ADD COLUMN special_request TEXT;
```

---

## 6. Reservations

### 6.1 OperatingHours

Restaurant operating hours configuration for each day of the week.

**Table**: `operating_hours`

| Column    | Type    | Constraints                 | Description                                  |
| --------- | ------- | --------------------------- | -------------------------------------------- |
| id        | integer | PRIMARY KEY, AUTO INCREMENT | Unique identifier                            |
| dayOfWeek | integer | NOT NULL, CHECK (0-6)       | Day: 0=Sunday, 1=Monday, ..., 6=Saturday     |
| openTime  | text    | NOT NULL                    | Opening time in HH:MM format (e.g., "11:00") |
| closeTime | text    | NOT NULL                    | Closing time in HH:MM format (e.g., "22:00") |
| isClosed  | boolean | NOT NULL, DEFAULT false     | Mark day as closed (e.g., holidays)          |

**Indexes**:

- Primary key on `id`
- Unique index on `dayOfWeek` (one record per day)

**Relations**:

- None (standalone configuration table)

---

### 6.2 Reservation

Customer table reservations with lifecycle status tracking.

**Table**: `reservations`

| Column           | Type      | Constraints                    | Description                                     |
| ---------------- | --------- | ------------------------------ | ----------------------------------------------- |
| id               | integer   | PRIMARY KEY, AUTO INCREMENT    | Unique reservation identifier                   |
| date             | text      | NOT NULL                       | Reservation date in YYYY-MM-DD format           |
| time             | text      | NOT NULL                       | Reservation time in HH:MM format (30-min slots) |
| partySize        | integer   | NOT NULL                       | Number of guests                                |
| customerName     | text      | NOT NULL                       | Customer full name                              |
| customerPhone    | text      | NOT NULL                       | Customer phone number                           |
| notes            | text      | NULL                           | Optional customer notes/requests                |
| status           | text      | NOT NULL                       | Status (see below)                              |
| assignedTableIds | text      | NULL                           | JSON array of table IDs (e.g., "[1, 2]")        |
| declineReason    | text      | NULL                           | Reason if status = "Declined"                   |
| createdAt        | timestamp | NOT NULL, DEFAULT CURRENT_TIME | Submission timestamp                            |
| updatedAt        | timestamp | NOT NULL, AUTO UPDATE          | Last update timestamp                           |

**Status Values**:

- `Pending` - Awaiting staff confirmation
- `Confirmed` - Approved by staff
- `Seated` - Customer arrived and seated
- `No-Show` - Customer didn't arrive (>15 min late)
- `Cancelled` - Cancelled by customer or staff
- `Declined` - Rejected by staff (with reason)

**Indexes**:

- Primary key on `id`
- Composite index on `(date, time)` for availability queries
- Index on `status` for filtering reservations

**Relations**:

- Many-to-many with `tables` (via JSON array in `assignedTableIds`)

---

## 7. Shifts

### 7.1 Shift

Operational shift tracking for reporting and accountability.

**Table**: `shifts`

| Column       | Type      | Constraints                 | Description                                 |
| ------------ | --------- | --------------------------- | ------------------------------------------- |
| id           | integer   | PRIMARY KEY, AUTO INCREMENT | Unique shift identifier                     |
| shiftType    | text      | NOT NULL                    | Type (e.g., "Breakfast", "Lunch", "Dinner") |
| startTime    | timestamp | NOT NULL                    | Shift start timestamp                       |
| endTime      | timestamp | NULL                        | Shift end timestamp (null = active)         |
| totalOrders  | integer   | NULL                        | Computed on close: count of orders          |
| totalRevenue | integer   | NULL                        | Computed on close: sum of payments (cents)  |

**Indexes**:

- Primary key on `id`
- Index on `startTime` for chronological sorting
- Index on `endTime` IS NULL for finding active shifts

**Relations**:

- One-to-many with `shiftStaff` (multiple staff per shift)
- One-to-many with `orders` (orders tagged with shift ID)

---

### 7.2 ShiftStaff

Join table linking shifts to staff members who worked during that shift.

**Table**: `shift_staff`

| Column  | Type    | Constraints                        | Description           |
| ------- | ------- | ---------------------------------- | --------------------- |
| shiftId | integer | NOT NULL, FOREIGN KEY → shifts(id) | Associated shift      |
| userId  | integer | NOT NULL, FOREIGN KEY → users(id)  | Associated staff user |

**Indexes**:

- Composite primary key on `(shiftId, userId)`
- Index on `shiftId` for querying staff by shift
- Index on `userId` for querying shifts by staff

**Relations**:

- Many-to-one with `shifts`
- Many-to-one with `users` (from auth schema)

---

### 7.3 Orders Table Update

Extend existing `orders` table to tag orders with shift IDs.

**New Column**:

| Column  | Type    | Constraints                    | Description                      |
| ------- | ------- | ------------------------------ | -------------------------------- |
| shiftId | integer | NULL, FOREIGN KEY → shifts(id) | Shift during which order created |

**Migration**:

```sql
ALTER TABLE orders ADD COLUMN shift_id INTEGER REFERENCES shifts(id);
```

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│  Modifiers  │◄──────│  DishModifiers   │──────►│   Dishes    │
└─────────────┘       └──────────────────┘       └─────────────┘
                              │                         │
                              ▼                         │
                      ┌───────────────┐                 │
                      │ ModifierGroups│                 │
                      └───────────────┘                 │
                                                        │
┌─────────────┐       ┌──────────────────┐             │
│ Categories  │◄──────│ DishCategories   │◄────────────┘
└─────────────┘       └──────────────────┘

                      ┌──────────────────┐       ┌─────────────┐
                      │  DishVariants    │──────►│   Dishes    │
                      └──────────────────┘       └─────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ VariantRecipes│──►Ingredients
                      └───────────────┘

┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│ OrderItems  │◄──────│OrderItemModifiers    │──────►│  Modifiers  │
└─────────────┘       └──────────────────────┘       └─────────────┘
      │
      │ variantId
      ▼
┌──────────────────┐
│  DishVariants    │
└──────────────────┘

┌──────────────────┐
│ OperatingHours   │ (standalone config)
└──────────────────┘

┌──────────────────┐
│  Reservations    │──► Tables (via JSON assignedTableIds)
└──────────────────┘

┌─────────────┐       ┌──────────────┐       ┌─────────┐
│   Shifts    │◄──────│  ShiftStaff  │──────►│  Users  │
└─────────────┘       └──────────────┘       └─────────┘
      │
      │ shiftId (FK in orders)
      ▼
┌─────────────┐
│   Orders    │
└─────────────┘
```

---

## Validation Rules

### Modifiers

- `priceAdjustment` can be negative (e.g., -100 for "$1 off")
- `modifierGroups.minSelections` ≤ `modifierGroups.maxSelections` (if both set)
- Enforce selection constraints in tRPC input validation (Zod schema)

### Categories

- `displayOrder` must be unique per category (for consistent sorting)
- Hidden categories not shown in customer queries: `WHERE isHidden = false`

### Variants

- Dish can have 0 or many variants
- If variants exist, customer must select one (UI validation + tRPC input)
- `variantRecipes` optional (only if variant has different ingredients than base dish)

### Reservations

- `date` must be >= today (no past reservations)
- `time` must be within `operatingHours` for `dayOfWeek`
- `partySize` must be > 0
- `status` transitions: Pending → Confirmed/Declined, Confirmed → Seated/No-Show/Cancelled

### Shifts

- Only one shift with `endTime = NULL` per shift type at a time (active shift)
- `endTime` must be > `startTime`
- `totalOrders` and `totalRevenue` computed on shift close (not manually editable)

---

## Summary

**New Tables**: 11

- `modifiers`, `modifier_groups`, `dish_modifiers`, `order_item_modifiers`
- `categories`, `dish_categories`
- `dish_variants`, `variant_recipes`
- `operating_hours`, `reservations`
- `shifts`, `shift_staff`

**Extended Tables**: 3

- `dishes` (+4 columns: `isHidden`, `isRecommended`, `isChefSpecial`, `orderPriority`)
- `order_items` (+2 columns: `variantId`, `specialRequest`)
- `orders` (+1 column: `shiftId`)

**Total Schema Changes**: 14 tables (11 new, 3 extended)

All schemas follow Drizzle ORM patterns with full TypeScript type inference. Ready for API contract generation (Phase 1 next step).
