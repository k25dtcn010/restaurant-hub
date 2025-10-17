# Data Model: RestaurantHub MVP

**Phase**: Phase 1 - Design & Contracts  
**Date**: 2025-10-17  
**Branch**: `001-restaurant-hub-mvp`

## Purpose

This document defines the complete data model for RestaurantHub MVP, including all entities, relationships, validation rules, and state transitions. The model aligns with Drizzle ORM schema definitions and ensures type-safe data flow from database to API to UI.

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐
│   User      │       │   Table     │
│─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │
│ email       │       │ number      │
│ password    │       │ qrCode      │
│ name        │       │ capacity    │
│ role        │       │ createdAt   │
│ createdAt   │       └─────────────┘
└─────────────┘              │
                             │ 1:N
                             ▼
                    ┌─────────────┐
                    │   Order     │
                    │─────────────│
                    │ id (PK)     │◄────────┐
                    │ tableId FK  │         │
                    │ status      │         │ 1:N
                    │ totalAmount │         │
                    │ createdAt   │         │
                    │ updatedAt   │    ┌─────────────────┐
                    └─────────────┘    │  OrderItem      │
                           │           │─────────────────│
                           │ 1:N       │ id (PK)         │
                           │           │ orderId FK      │
                           └───────────┤ dishId FK       │
                                       │ quantity        │
                                       │ priceAtOrder    │
                                       │ special...      │
                                       │ createdAt       │
                                       └─────────────────┘
                                              │
                                              │ N:1
                                              ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ Ingredient  │       │   Recipe    │       │    Dish     │
│─────────────│       │─────────────│       │─────────────│
│ id (PK)     │◄──────┤ ingredientId│       │ id (PK)     │
│ name        │  N:1  │ dishId FK   │  N:1  │ name        │
│ quantity    │       │ quantityReq │───────┤ description │
│ unit        │       └─────────────┘       │ price       │
│ threshold   │                             │ photoUrl    │
│ updatedAt   │                             │ isAvailable │
└─────────────┘                             │ createdAt   │
                                            │ updatedAt   │
                                            └─────────────┘

┌──────────────────────┐       ┌─────────────────────┐
│ OrderStatusHistory   │       │     Payment         │
│──────────────────────│       │─────────────────────│
│ id (PK)              │       │ id (PK)             │
│ orderId FK           │       │ orderId FK          │
│ status               │       │ amount              │
│ changedBy (userId)   │       │ method ('Cash')     │
│ changedAt            │       │ paidAt              │
└──────────────────────┘       └─────────────────────┘
```

---

## Entity Definitions

### 1. User

**Purpose**: Represents staff members who authenticate to access role-specific dashboards.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique user identifier                         |
| email       | TEXT            | UNIQUE, NOT NULL                     | User email for login                           |
| password    | TEXT            | NOT NULL                             | Hashed password (Better-Auth handles hashing)  |
| name        | TEXT            | NOT NULL                             | Display name                                   |
| role        | TEXT (ENUM)     | NOT NULL, CHECK IN ('Manager', 'KitchenStaff', 'Waiter') | User role for access control |
| createdAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Account creation timestamp                     |

**Validation Rules**:
- Email must be valid email format (RFC 5322)
- Password must be at least 8 characters (enforced by Better-Auth)
- Role must be one of three defined values: 'Manager', 'KitchenStaff', 'Waiter'
- Email uniqueness enforced at database level

**Relationships**:
- **1:N with OrderStatusHistory**: User can change status of many orders
- **1:N with Payment** (implicit via audit trail): User who processes payments

**TypeScript Type** (exported from `packages/db`):
```typescript
export type User = {
  id: number
  email: string
  password: string // Never exposed to frontend
  name: string
  role: 'Manager' | 'KitchenStaff' | 'Waiter'
  createdAt: Date
}

export type UserPublic = Omit<User, 'password'>
```

---

### 2. Table

**Purpose**: Represents physical tables in the restaurant, each with a unique QR code for customer ordering.

**Fields**:
| Field      | Type            | Constraints                          | Description                                |
|------------|-----------------|--------------------------------------|--------------------------------------------|
| id         | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique table identifier                    |
| number     | INTEGER         | UNIQUE, NOT NULL, CHECK (1-30)       | Human-readable table number (1-30)         |
| qrCode     | TEXT            | UNIQUE, NOT NULL                     | QR code string (URL with tableId param)    |
| capacity   | INTEGER         | NOT NULL, DEFAULT 4                  | Number of seats at table                   |
| createdAt  | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Table setup timestamp                      |

**Validation Rules**:
- Table number must be between 1 and 30 (restaurant supports 25-30 tables)
- QR code format: `https://app.restauranthub.com/?table={number}`
- Capacity must be positive integer (minimum 1, typical 2-8)

**Relationships**:
- **1:N with Order**: Table can have multiple orders over time (but only one active unpaid order at a time)

**TypeScript Type**:
```typescript
export type Table = {
  id: number
  number: number // 1-30
  qrCode: string
  capacity: number
  createdAt: Date
}
```

**Business Logic**:
- Only one "unpaid" order per table at any time (enforced in API logic)
- When order is marked "Paid", table session clears (new QR scan starts fresh order)

---

### 3. Order

**Purpose**: Represents a customer's order for a specific table, tracking items, status, and lifecycle.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique order identifier                        |
| tableId     | INTEGER         | NOT NULL, FOREIGN KEY → tables.id    | Which table placed this order                  |
| status      | TEXT (ENUM)     | NOT NULL, DEFAULT 'Pending', CHECK IN (...) | Current order status in lifecycle       |
| totalAmount | INTEGER         | NOT NULL, DEFAULT 0                  | Total price in cents (sum of order items)      |
| createdAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When order was first created                   |
| updatedAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last modification timestamp                    |

**Status Enum Values**:
- `'Pending'`: Order created, awaiting kitchen preparation
- `'InKitchen'`: Kitchen has started preparing dishes
- `'ReadyToServe'`: Dishes are cooked and ready for pickup
- `'Served'`: Food delivered to customer table
- `'Completed'`: Customer finished eating (pre-payment)
- `'Paid'`: Payment received, order closed

**Validation Rules**:
- Total amount must be non-negative
- Status must be one of six defined lifecycle states
- Status transitions must follow allowed paths (enforced in API business logic)

**Relationships**:
- **N:1 with Table**: Many orders belong to one table
- **1:N with OrderItem**: Order contains multiple dish items
- **1:N with OrderStatusHistory**: Order has audit trail of status changes
- **1:1 with Payment**: Order has one payment record (when status = 'Paid')

**State Transition Rules**:
```
Pending ──────────► InKitchen ──────────► ReadyToServe ──────────► Served ──────────► Completed ──────────► Paid
   │                                                                                                          │
   └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                          (Cancel allowed only from Pending status)
```

**Allowed Transitions**:
- `Pending → InKitchen`: Kitchen starts preparing
- `InKitchen → ReadyToServe`: Dishes finished cooking
- `ReadyToServe → Served`: Waiter delivers food
- `Served → Completed`: Customer indicates done eating
- `Completed → Paid`: Payment processed
- `Pending → Cancelled` (optional, not in MVP scope)

**TypeScript Type**:
```typescript
export type OrderStatus = 'Pending' | 'InKitchen' | 'ReadyToServe' | 'Served' | 'Completed' | 'Paid'

export type Order = {
  id: number
  tableId: number
  status: OrderStatus
  totalAmount: number // in cents
  createdAt: Date
  updatedAt: Date
}
```

---

### 4. OrderItem

**Purpose**: Represents a single dish within an order, with quantity and pricing snapshot.

**Fields**:
| Field              | Type            | Constraints                          | Description                                    |
|--------------------|-----------------|--------------------------------------|------------------------------------------------|
| id                 | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique order item identifier                   |
| orderId            | INTEGER         | NOT NULL, FOREIGN KEY → orders.id, ON DELETE CASCADE | Parent order |
| dishId             | INTEGER         | NOT NULL, FOREIGN KEY → dishes.id    | Which dish was ordered                         |
| quantity           | INTEGER         | NOT NULL, CHECK > 0                  | Number of this dish ordered                    |
| priceAtOrder       | INTEGER         | NOT NULL                             | Price in cents at time of order (historical)   |
| specialInstructions| TEXT            | NULLABLE                             | Customer notes (e.g., "no onions")             |
| createdAt          | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When item added to order                       |

**Validation Rules**:
- Quantity must be positive integer (minimum 1)
- Price at order captured from `dishes.price` at time of order submission
- Special instructions limited to 255 characters (optional constraint)

**Relationships**:
- **N:1 with Order**: Many items belong to one order (cascade delete when order deleted)
- **N:1 with Dish**: Many order items reference one dish

**TypeScript Type**:
```typescript
export type OrderItem = {
  id: number
  orderId: number
  dishId: number
  quantity: number
  priceAtOrder: number // in cents
  specialInstructions: string | null
  createdAt: Date
}

export type OrderItemWithDish = OrderItem & {
  dish: Dish
}
```

**Business Logic**:
- Items can be added to order at any stage before "Paid" (FR-016b)
- Items can only be removed from order while status is "Pending" (FR-016a)
- When item is removed, ingredient stock is refunded (FR-016c)
- Total amount is recalculated when items added/removed

---

### 5. Dish

**Purpose**: Represents a menu item that customers can order.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique dish identifier                         |
| name        | TEXT            | NOT NULL                             | Dish name (e.g., "Cheeseburger")               |
| description | TEXT            | NOT NULL                             | Detailed description for menu                  |
| price       | INTEGER         | NOT NULL, CHECK >= 0                 | Current price in cents                         |
| photoUrl    | TEXT            | NULLABLE                             | URL to dish photo (optional for MVP)           |
| isAvailable | INTEGER (BOOLEAN) | NOT NULL, DEFAULT 1                | Whether dish is active in menu (0=disabled)    |
| createdAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When dish was added to menu                    |
| updatedAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last modification timestamp                    |

**Validation Rules**:
- Name required, non-empty string (max 100 characters)
- Description required (max 500 characters)
- Price must be non-negative integer (stored in cents, e.g., $12.50 = 1250)
- Photo URL must be valid URL format (if provided)

**Relationships**:
- **1:N with OrderItem**: Dish can appear in many orders
- **1:N with Recipe**: Dish requires multiple ingredients (via recipe join table)

**TypeScript Type**:
```typescript
export type Dish = {
  id: number
  name: string
  description: string
  price: number // in cents
  photoUrl: string | null
  isAvailable: boolean
  createdAt: Date
  updatedAt: Date
}

export type DishWithRecipe = Dish & {
  recipe: Recipe[]
}
```

**Availability Logic**:
- `isAvailable = false`: Dish is disabled by manager (FR-001c)
- Dish automatically unavailable if any required ingredient stock = 0 (FR-005)
- Check at order submission time (not preemptively in menu display)

---

### 6. Ingredient

**Purpose**: Represents raw materials tracked in inventory, with quantity and low-stock thresholds.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique ingredient identifier                   |
| name        | TEXT            | NOT NULL, UNIQUE                     | Ingredient name (e.g., "Beef Patty")           |
| quantity    | REAL            | NOT NULL, DEFAULT 0, CHECK >= 0      | Current stock quantity                         |
| unit        | TEXT            | NOT NULL                             | Unit of measure (e.g., "kg", "pieces", "L")    |
| threshold   | REAL            | NOT NULL, DEFAULT 0                  | Low-stock alert threshold                      |
| updatedAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last stock change timestamp                    |

**Validation Rules**:
- Quantity must be non-negative (enforced in transaction logic)
- Unit required (standardize per ingredient type)
- Threshold configurable by manager (default 0 = no alert)
- Name uniqueness enforced at database level

**Relationships**:
- **1:N with Recipe**: Ingredient used in multiple dishes

**TypeScript Type**:
```typescript
export type Ingredient = {
  id: number
  name: string
  quantity: number // Using number (float) for fractional quantities
  unit: string
  threshold: number
  updatedAt: Date
}

export type IngredientWithAlert = Ingredient & {
  isLowStock: boolean // Computed: quantity < threshold
}
```

**Business Logic**:
- Stock automatically reduced when order is submitted (via recipe calculation)
- Stock can be manually adjusted by managers (positive or negative adjustment with audit log)
- Low-stock alert triggered when `quantity < threshold` (FR-012)
- Negative stock prevented via database transaction + check (FR-013)

---

### 7. Recipe

**Purpose**: Join table linking dishes to ingredients with required quantities.

**Fields**:
| Field         | Type            | Constraints                          | Description                                    |
|---------------|-----------------|--------------------------------------|------------------------------------------------|
| id            | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique recipe entry identifier                 |
| dishId        | INTEGER         | NOT NULL, FOREIGN KEY → dishes.id, ON DELETE CASCADE | Which dish requires this ingredient |
| ingredientId  | INTEGER         | NOT NULL, FOREIGN KEY → ingredients.id, ON DELETE RESTRICT | Which ingredient is required |
| quantityRequired | REAL         | NOT NULL, CHECK > 0                  | How much of this ingredient per dish           |

**Validation Rules**:
- Quantity required must be positive (cannot have zero-ingredient recipes)
- Composite uniqueness: One ingredient can appear only once per dish (UNIQUE (dishId, ingredientId))

**Relationships**:
- **N:1 with Dish**: Many recipe entries belong to one dish (cascade delete)
- **N:1 with Ingredient**: Many recipe entries reference one ingredient (restrict delete if in use)

**TypeScript Type**:
```typescript
export type Recipe = {
  id: number
  dishId: number
  ingredientId: number
  quantityRequired: number
}

export type RecipeWithIngredient = Recipe & {
  ingredient: Ingredient
}
```

**Business Logic**:
- When calculating stock for order, sum all ingredient requirements: `quantity * quantityRequired` for each dish in order
- Example: Order has 2 Burgers → Recipe says 1 Burger needs 1 patty → Deduct 2 patties from inventory

---

### 8. OrderStatusHistory

**Purpose**: Audit trail tracking every status change for an order.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique history entry identifier                |
| orderId     | INTEGER         | NOT NULL, FOREIGN KEY → orders.id, ON DELETE CASCADE | Which order changed |
| status      | TEXT            | NOT NULL                             | Status after this change                       |
| changedBy   | INTEGER         | NULLABLE, FOREIGN KEY → users.id     | User who made the change (null for system)     |
| changedAt   | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Timestamp of status change                     |

**Validation Rules**:
- Status must be valid OrderStatus enum value
- ChangedBy can be null (system-initiated changes, e.g., automatic order creation)
- Entries never deleted (audit trail permanence)

**Relationships**:
- **N:1 with Order**: Many history entries belong to one order (cascade delete)
- **N:1 with User**: Many entries reference one user (nullable)

**TypeScript Type**:
```typescript
export type OrderStatusHistory = {
  id: number
  orderId: number
  status: OrderStatus
  changedBy: number | null
  changedAt: Date
}

export type OrderStatusHistoryWithUser = OrderStatusHistory & {
  user: UserPublic | null
}
```

**Business Logic**:
- Automatically create history entry whenever `orders.status` changes
- Display full status timeline in order detail view (FR-016)
- Calculate time spent in each status (e.g., "In Kitchen for 12 minutes")

---

### 9. Payment

**Purpose**: Records completed cash transactions for paid orders.

**Fields**:
| Field       | Type            | Constraints                          | Description                                    |
|-------------|-----------------|--------------------------------------|------------------------------------------------|
| id          | INTEGER         | PRIMARY KEY, AUTO_INCREMENT          | Unique payment identifier                      |
| orderId     | INTEGER         | UNIQUE, NOT NULL, FOREIGN KEY → orders.id | Which order was paid              |
| amount      | INTEGER         | NOT NULL, CHECK > 0                  | Payment amount in cents                        |
| method      | TEXT            | NOT NULL, DEFAULT 'Cash'             | Payment method (only 'Cash' in MVP)            |
| paidAt      | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Payment completion timestamp                   |

**Validation Rules**:
- Amount must be positive (matches `orders.totalAmount`)
- Method restricted to 'Cash' for MVP (future: 'Card', 'Digital')
- One-to-one with Order (only one payment per order via UNIQUE constraint on orderId)

**Relationships**:
- **1:1 with Order**: One payment belongs to one order

**TypeScript Type**:
```typescript
export type Payment = {
  id: number
  orderId: number
  amount: number // in cents
  method: 'Cash'
  paidAt: Date
}

export type PaymentWithOrder = Payment & {
  order: Order
}
```

**Business Logic**:
- Payment record created when order status changes to "Paid" (FR-028)
- After payment, table session clears (allows new order for same table)
- Payment history accessible to managers and waiters (FR-030)

---

## Indexes and Performance

**Critical Indexes**:
```sql
-- Orders
CREATE INDEX idx_orders_table_id ON orders(tableId);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(createdAt);

-- OrderItems
CREATE INDEX idx_order_items_order_id ON order_items(orderId);
CREATE INDEX idx_order_items_dish_id ON order_items(dishId);

-- Recipe
CREATE UNIQUE INDEX idx_recipe_dish_ingredient ON recipe(dishId, ingredientId);

-- OrderStatusHistory
CREATE INDEX idx_order_status_history_order_id ON order_status_history(orderId);
```

**Query Optimization Goals**:
- Kitchen dashboard query (all Pending/InKitchen orders): < 50ms
- Table active order lookup: < 20ms
- Inventory stock check for order submission: < 100ms

---

## Data Integrity Rules

### Foreign Key Constraints
- **CASCADE DELETE**: OrderItem, OrderStatusHistory (deleted when parent Order deleted)
- **RESTRICT DELETE**: Ingredient (cannot delete if referenced in Recipe), Dish (cannot delete if in OrderItem)
- **SET NULL**: Not used in this schema

### Check Constraints
- `orders.totalAmount >= 0`
- `order_items.quantity > 0`
- `dishes.price >= 0`
- `ingredients.quantity >= 0`
- `recipe.quantityRequired > 0`
- `payments.amount > 0`

### Unique Constraints
- `users.email`
- `tables.number`
- `tables.qrCode`
- `ingredients.name`
- `recipe (dishId, ingredientId)` (composite)
- `payments.orderId`

---

## Seed Data Requirements

**Initial data for development and testing**:

1. **Users**: 3 test accounts (one per role)
   - Manager: `admin@restauranthub.com` / `password123`
   - Kitchen: `chef@restauranthub.com` / `password123`
   - Waiter: `waiter@restauranthub.com` / `password123`

2. **Tables**: 30 tables with QR codes
   - Table numbers 1-30
   - QR codes: `https://app.restauranthub.com/?table={number}`
   - Capacity: randomized 2-6 seats

3. **Ingredients**: ~20 common ingredients
   - Beef Patty (pieces), Lettuce (kg), Tomato (kg), Cheese (pieces), Buns (pieces)
   - Chicken Breast (pieces), Rice (kg), Pasta (kg), Tomato Sauce (L), Olive Oil (L)
   - Initial quantities: 50-200 units, thresholds: 10-20 units

4. **Dishes**: ~15 menu items across categories
   - Burgers (Cheeseburger, Bacon Burger, Veggie Burger)
   - Pasta (Carbonara, Marinara, Alfredo)
   - Salads (Caesar, Greek, Garden)
   - Drinks (Soda, Water, Juice)
   - Prices: $5-$25 range (500-2500 cents)

5. **Recipes**: Link dishes to ingredients
   - Cheeseburger: 1 Beef Patty, 0.05kg Lettuce, 0.05kg Tomato, 1 Cheese, 1 Bun
   - Carbonara: 0.2kg Pasta, 0.05kg Cheese, 0.1L Olive Oil

---

## Type Exports Summary

```typescript
// packages/db/src/schema/index.ts
export type {
  User, UserPublic,
  Table,
  Order, OrderStatus,
  OrderItem, OrderItemWithDish,
  Dish, DishWithRecipe,
  Ingredient, IngredientWithAlert,
  Recipe, RecipeWithIngredient,
  OrderStatusHistory, OrderStatusHistoryWithUser,
  Payment, PaymentWithOrder,
}
```

These types automatically flow to tRPC procedures and React components via type inference.

---

## Validation at Each Layer

1. **Database Layer** (Drizzle schema):
   - Type constraints (INTEGER, TEXT, REAL)
   - NOT NULL, UNIQUE, CHECK constraints
   - Foreign key relationships

2. **API Layer** (tRPC + Zod):
   - Input schemas validate structure (e.g., `tableId` must be integer)
   - Business logic validates state (e.g., cannot remove items from "In Kitchen" order)
   - Authorization checks (role-based access)

3. **UI Layer** (React + Zod):
   - Form validation (Better-Auth forms, order creation)
   - Type-safe props (components receive typed data from tRPC)
   - Display validation errors inline

---

**Phase 1A Complete**: Data model fully defined with entities, relationships, validation rules, and state transitions. Ready to proceed with API contracts generation.
