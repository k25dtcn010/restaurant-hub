# Research: Advanced Operations Management

**Feature**: 002-advanced-ops-management  
**Date**: 2025-10-18  
**Status**: Complete

## Overview

This document consolidates research findings for implementing menu modifiers, categories, variants, table reservations, and shift management in the RestaurantHub system. All technical unknowns from the Technical Context have been resolved.

---

## 1. Menu Modifiers Architecture

### Decision: Global Modifier Pool with Many-to-Many Associations

**Rationale**:

- Modifiers like "extra cheese" or "no onions" are reusable across multiple dishes
- Centralized management reduces duplication (single price update applies everywhere)
- Drizzle ORM supports many-to-many relationships through join tables efficiently

**Alternatives Considered**:

- **Dish-specific modifiers**: Rejected because it creates data duplication and inconsistent pricing when the same modifier appears on multiple dishes
- **Category-based modifiers only**: Rejected because it doesn't allow dish-specific customization (e.g., "burger" category might have toppings that don't apply to all burgers)

**Implementation Pattern**:

```typescript
// packages/db/src/schema/modifiers.ts
export const modifiers = sqliteTable("modifiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  priceAdjustment: integer("price_adjustment").notNull(), // cents, can be negative
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
})

export const modifierGroups = sqliteTable("modifier_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g., "Toppings", "Size", "Preparation"
  minSelections: integer("min_selections"), // nullable, default null = no minimum
  maxSelections: integer("max_selections"), // nullable, default null = unlimited
  displayOrder: integer("display_order").notNull().default(0),
})

export const dishModifiers = sqliteTable(
  "dish_modifiers",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id),
    modifierId: integer("modifier_id")
      .notNull()
      .references(() => modifiers.id),
    modifierGroupId: integer("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dishId, table.modifierId] }),
  })
)
```

**Best Practices**:

- Use Zod schema validation for min/max selection constraints at order submission
- Index foreign keys (dish_id, modifier_id) for query performance
- Store modifier price at order time (`orderItemModifiers.priceAtOrder`) to preserve historical accuracy
- WebSocket notification when modifier availability changes (reuse kitchen dashboard pattern)

---

## 2. Category Management with Soft Deletes

### Decision: Soft Delete Pattern for Categories

**Rationale**:

- Historical orders reference categories; hard delete would break referential integrity
- Managers may temporarily hide categories (seasonal menus) and need easy re-activation
- Drizzle ORM filtering via `where(eq(categories.isHidden, false))` is straightforward

**Alternatives Considered**:

- **Hard delete with cascade**: Rejected because it destroys historical data and audit trails
- **Archive table**: Rejected as overly complex for simple visibility toggle

**Implementation Pattern**:

```typescript
// packages/db/src/schema/categories.ts
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  iconUrl: text("icon_url"), // nullable
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
})

export const dishCategories = sqliteTable(
  "dish_categories",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dishId, table.categoryId] }),
  })
)
```

**Best Practices**:

- Filter hidden categories in customer-facing queries: `where(eq(categories.isHidden, false))`
- Show hidden categories with badge in manager dashboard: `{isHidden && <Badge>Hidden</Badge>}`
- Use optimistic updates in UI when toggling visibility (TanStack Query mutation)

---

## 3. Dish Variants (Size/Option Handling)

### Decision: Separate `dishVariants` Table with Variant-Specific Pricing

**Rationale**:

- Sizes like "Small/Medium/Large" have different prices and potentially different recipes
- Storing variants as separate rows (vs. JSON column) maintains type safety and allows proper indexing
- Drizzle ORM relations make querying variants with dishes straightforward

**Alternatives Considered**:

- **JSON column in dishes table**: Rejected because it loses type safety and can't be indexed efficiently
- **Separate dish entry per size**: Rejected because it creates artificial separation (menu shows "Coffee" not "Small Coffee", "Medium Coffee", "Large Coffee")

**Implementation Pattern**:

```typescript
// packages/db/src/schema/variants.ts
export const dishVariants = sqliteTable("dish_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id),
  name: text("name").notNull(), // e.g., "Small", "Medium", "Large"
  price: integer("price").notNull(), // cents, overrides base dish price
  displayOrder: integer("display_order").notNull().default(0),
})

// Variant-specific recipes (optional, for different ingredient requirements)
export const variantRecipes = sqliteTable(
  "variant_recipes",
  {
    variantId: integer("variant_id")
      .notNull()
      .references(() => dishVariants.id),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    quantityRequired: integer("quantity_required").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.variantId, table.ingredientId] }),
  })
)
```

**Best Practices**:

- Require variant selection in UI when dish has variants: `<Select required>{variants.map(...)}</Select>`
- Store selected variant ID in `orderItems.variantId` (new column)
- Total price calculation: `variantPrice + sum(modifierPrices)`

---

## 4. Reservation System with Operating Hours Validation

### Decision: Pre-Configured Operating Hours + Staff Confirmation Workflow

**Rationale**:

- Prevents spam reservations by requiring staff approval
- Operating hours vary by day (weekends vs. weekdays) and need configurable support
- 30-minute time slot increments balance granularity with complexity

**Alternatives Considered**:

- **Fully automated confirmations**: Rejected due to spam risk and inability to handle special circumstances (private events, maintenance)
- **15-minute slots**: Rejected as overly granular for typical restaurant operations

**Implementation Pattern**:

```typescript
// packages/db/src/schema/reservations.ts
export const operatingHours = sqliteTable("operating_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: text("open_time").notNull(), // HH:MM format, e.g., "11:00"
  closeTime: text("close_time").notNull(), // HH:MM format, e.g., "22:00"
  isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
})

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM (30-min increments)
  partySize: integer("party_size").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  notes: text("notes"), // nullable
  status: text("status").notNull(), // "Pending" | "Confirmed" | "Seated" | "No-Show" | "Cancelled" | "Declined"
  assignedTableIds: text("assigned_table_ids"), // JSON array of table IDs, e.g., "[1, 2]" for combined tables
  declineReason: text("decline_reason"), // nullable
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
```

**Best Practices**:

- Validate reservation time against operating hours using Zod schema in tRPC input
- Default reservation duration: 90 minutes (configurable in future)
- Highlight reservations within 15 minutes of current time using badge/color in UI
- WebSocket notification to staff dashboard when new reservation submitted

---

## 5. Shift/Session Management

### Decision: Lightweight Shift Tracking with Order Tagging

**Rationale**:

- Shift tracking primarily for reporting and accountability, not real-time workflow
- Simple start/end time with order association sufficient for MVP
- Avoid complex staff scheduling features (out of scope)

**Alternatives Considered**:

- **Full scheduling system**: Rejected as overly complex and out of scope
- **Per-order manual shift tagging**: Rejected because automatic tagging is more reliable

**Implementation Pattern**:

```typescript
// packages/db/src/schema/shifts.ts
export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftType: text("shift_type").notNull(), // "Breakfast" | "Lunch" | "Dinner" | "Custom"
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }), // nullable for active shifts
  totalOrders: integer("total_orders"), // computed on shift close
  totalRevenue: integer("total_revenue"), // cents, computed on shift close
})

export const shiftStaff = sqliteTable(
  "shift_staff",
  {
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.shiftId, table.userId] }),
  })
)

// Extend orders table
// Add: shiftId: integer("shift_id").references(() => shifts.id)
```

**Best Practices**:

- Auto-assign current active shift to new orders (middleware in tRPC context)
- Display warning in UI when shift active >12 hours
- Generate shift summary on close: count orders, sum payments

---

## 6. Performance Optimizations

### Decision: Indexes, Batching, and Caching

**Database Indexes**:

```sql
-- Auto-created by Drizzle for foreign keys
CREATE INDEX idx_dish_modifiers_dish ON dish_modifiers(dish_id);
CREATE INDEX idx_dish_modifiers_modifier ON dish_modifiers(modifier_id);
CREATE INDEX idx_dish_categories_dish ON dish_categories(dish_id);
CREATE INDEX idx_dish_categories_category ON dish_categories(category_id);
CREATE INDEX idx_reservations_date_time ON reservations(date, time);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);
```

**tRPC Batching**:

- Group related queries: `trpc.useQueries(['dishes.list', 'modifiers.list', 'categories.list'])`
- Reduce round trips for menu loading (customer + manager views)

**Caching Strategy**:

- Menu data (dishes, categories, modifiers) cached in TanStack Query with 5-minute stale time
- Invalidate cache on mutations (create/update/delete modifier, toggle dish visibility)
- Reservation availability cached per date with 1-minute stale time

---

## 7. Testing Strategy

### Decision: TDD with Integration and Unit Test Mix

**Test Coverage Targets**:

- **Unit Tests**: Zod schema validation (modifier group constraints, reservation date/time validation)
- **Integration Tests**: Full tRPC workflows (create modifier → assign to dish → order with modifier)
- **E2E Tests** (future): Customer ordering flow with modifiers, reservation submission

**Key Test Scenarios**:

```typescript
// packages/api/tests/integration/modifiers.test.ts
describe("Modifiers Router", () => {
  it("should enforce min/max modifier group selections", async () => {
    // Create modifier group with min=1, max=3
    // Attempt order with 0 selections → expect error
    // Attempt order with 4 selections → expect error
    // Attempt order with 2 selections → expect success
  })

  it("should mark modifier unavailable when ingredient depleted", async () => {
    // Create modifier with ingredient requirement
    // Deplete ingredient stock
    // Fetch dish modifiers → expect modifier isAvailable=false
  })
})

// packages/api/tests/integration/reservations.test.ts
describe("Reservations Router", () => {
  it("should reject reservations outside operating hours", async () => {
    // Configure Mon-Fri 11:00-22:00
    // Attempt reservation for 10:00 → expect error
    // Attempt reservation for 23:00 → expect error
  })

  it("should prevent double-booking confirmed reservations", async () => {
    // Confirm reservation for Table 1 at 18:00
    // Attempt another reservation for Table 1 at 18:30 (overlap) → expect warning
  })
})
```

**Best Practices**:

- Use Bun's test runner with `bun test` command
- Mock external dependencies (WebSocket, auth context) in tests
- Seed test data in setup.ts (reuse existing pattern from MVP)

---

## 8. UI Component Patterns

### Decision: Reuse shadcn/ui with Custom Compositions

**Component Library**:

- **Forms**: `<Form>`, `<Input>`, `<Select>`, `<Checkbox>` from shadcn/ui
- **Tables**: `<Table>` for reservations list, modifiers list
- **Dialogs**: `<Dialog>` for category editor, variant editor
- **Badges**: `<Badge>` for "Hidden", "Chef's Special", "Recommended" flags

**Custom Compositions**:

```tsx
// apps/web/src/components/modifier-selector.tsx
// Grouped modifiers with min/max validation
<ModifierSelector
  modifierGroups={groups}
  onSelectionChange={(selected) => {...}}
  constraints={{ min: 1, max: 3 }}
/>

// apps/web/src/components/reservation-form.tsx
// Date/time picker with operating hours validation
<ReservationForm
  operatingHours={hours}
  onSubmit={(data) => createReservation.mutate(data)}
/>
```

**Best Practices**:

- Use `react-hook-form` with Zod resolver for form validation
- Show inline error messages for validation failures
- Loading states via `isPending` from TanStack Query mutations
- Optimistic updates for instant feedback (toggle visibility, mark modifier unavailable)

---

## 9. Migration Strategy

### Decision: Single Migration with Backward Compatibility

**Migration File**: `packages/db/src/migrations/0002_advanced_ops.sql`

**Backward Compatibility**:

- Add new tables (modifiers, categories, variants, reservations, shifts)
- Add new columns to existing tables (`dishes.isHidden`, `dishes.orderPriority`, etc.)
- Use `ALTER TABLE ADD COLUMN ... DEFAULT ...` for non-nullable columns with defaults
- No destructive changes to existing schema

**Rollback Plan**:

- If migration fails, revert via Drizzle down migration
- Existing orders, tables, dishes remain functional (new columns have safe defaults)

---

## 10. WebSocket Integration

### Decision: Extend Existing WebSocket Server for Reservations

**Current WebSocket Usage**:

- Kitchen dashboard order notifications
- Serving queue updates

**New Notifications**:

- `reservation:new` → Staff dashboard when pending reservation submitted
- `reservation:confirmed` → Customer phone number (future: SMS integration placeholder)
- `modifier:unavailable` → Customer menu view when modifier stock depleted

**Implementation Pattern**:

```typescript
// apps/server/src/websocket.ts (extend existing)
export function broadcastReservationUpdate(reservation: Reservation) {
  wss.clients.forEach((client) => {
    if (client.role === "staff" || client.role === "manager") {
      client.send(
        JSON.stringify({
          type: "reservation:new",
          payload: reservation,
        })
      )
    }
  })
}
```

---

## Summary

All technical unknowns resolved. The feature extends the existing Better-T-Stack architecture cleanly:

- **Database**: Drizzle ORM with 7 new tables, 4 extended tables
- **API**: tRPC routers with Zod validation (4 new routers, 2 extended routers)
- **UI**: React components with shadcn/ui (8 new components, 2 extended components)
- **Testing**: TDD approach with unit + integration tests
- **Performance**: Indexed queries, batched tRPC calls, optimistic updates

No architectural violations or complexity concerns. Ready for Phase 1: Design & Contracts.
