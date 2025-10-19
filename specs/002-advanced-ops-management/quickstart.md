# Quickstart Guide: Advanced Operations Management

**Feature**: 002-advanced-ops-management  
**Date**: 2025-10-18  
**Prerequisites**: RestaurantHub MVP (001-restaurant-hub-mvp) fully implemented

## Overview

This guide provides step-by-step instructions for setting up and testing the Advanced Operations Management features: menu modifiers, categories, variants, reservations, and shift management.

---

## Setup

### 1. Database Migration

Run the database migration to create new tables and extend existing ones:

```bash
cd packages/db
bun run db:generate  # Generate migration from schema changes
bun run db:migrate   # Apply migration to database
```

**Expected Output**:

```
✓ Migration 0002_advanced_ops.sql applied successfully
✓ Created tables: modifiers, modifier_groups, dish_modifiers, order_item_modifiers, categories, dish_categories, dish_variants, variant_recipes, operating_hours, reservations, shifts, shift_staff
✓ Extended tables: dishes (+4 columns), order_items (+2 columns), orders (+1 column)
```

### 2. Seed Test Data (Optional)

Seed sample modifiers, categories, and operating hours for testing:

```bash
cd packages/db
bun run src/seed-advanced-ops.ts  # New seed script for this feature
```

**Seeded Data**:

- 20 modifiers (e.g., "Extra Cheese +$2", "No Onions $0", "Spicy +$1")
- 5 modifier groups (e.g., "Toppings", "Preparation", "Size")
- 6 categories (e.g., "Appetizers", "Main Course", "Desserts", "Beverages")
- Operating hours for all 7 days (Mon-Thu: 11:00-22:00, Fri-Sun: 11:00-23:00)
- 3 sample reservations (1 Pending, 1 Confirmed, 1 Seated)

---

## Feature Walkthroughs

### A. Menu Modifiers

#### Manager: Create Modifiers

1. **Login** as manager (`admin@restauranthub.com`)
2. Navigate to **Menu Management** → **Modifiers** tab
3. Click **Create Modifier**
   - Name: "Extra Cheese"
   - Price Adjustment: +200 (cents, i.e., +$2.00)
   - Is Available: ✓
4. Click **Save**
5. Repeat for modifiers like "No Onions" (+$0), "Gluten-Free Bread" (+$1.50)

#### Manager: Create Modifier Groups

1. In **Menu Management** → **Modifiers** tab
2. Click **Create Modifier Group**
   - Name: "Toppings"
   - Min Selections: 0
   - Max Selections: 3
   - Display Order: 1
3. Click **Save**
4. Repeat for groups like "Size" (min=1, max=1), "Preparation" (min=0, max=unlimited)

#### Manager: Assign Modifiers to Dish

1. Navigate to **Menu Management** → **Dishes**
2. Click **Edit** on a dish (e.g., "Cheeseburger")
3. In the **Modifiers** section:
   - Select modifier group: "Toppings"
   - Check modifiers: "Extra Cheese", "Bacon", "Avocado"
4. Click **Save**

#### Customer: Order with Modifiers

1. Scan QR code for a table
2. Browse menu → Select "Cheeseburger"
3. Expand **Customize** section
4. Under "Toppings" group, select:
   - ✓ Extra Cheese (+$2.00)
   - ✓ Bacon (+$1.50)
5. Enter special request: "No pickles, extra lettuce"
6. Verify total price updates: $12.00 (base) + $2.00 + $1.50 = $15.50
7. Click **Add to Order**

#### Kitchen: View Order with Modifiers

1. Login as kitchen staff
2. Open **Kitchen Dashboard**
3. Verify new order displays:
   ```
   Table 5 - Order #42
   1x Cheeseburger
      + Extra Cheese (+$2.00)
      + Bacon (+$1.50)
      Special: No pickles, extra lettuce
   ```

---

### B. Menu Categories

#### Manager: Create Categories

1. Login as manager
2. Navigate to **Menu Management** → **Categories** tab
3. Click **Create Category**
   - Name: "Appetizers"
   - Display Order: 1
   - Icon URL: (optional, e.g., URL to icon image)
4. Click **Save**
5. Repeat for "Main Course" (order=2), "Desserts" (order=3), "Beverages" (order=4)

#### Manager: Assign Dishes to Categories

1. In **Menu Management** → **Dishes**
2. Click **Edit** on a dish (e.g., "Mozzarella Sticks")
3. In **Categories** section, check: "Appetizers"
4. Click **Save**
5. Repeat for other dishes (assign to appropriate categories)

#### Manager: Toggle Category Visibility

1. In **Menu Management** → **Categories**
2. Click **Hide** button next to "Desserts" category
3. Verify category shows "Hidden" badge
4. Open customer menu in another browser (QR code)
5. Verify "Desserts" category is NOT visible

#### Customer: Browse by Category

1. Scan QR code for a table
2. View menu → Categories displayed in order: "Appetizers", "Main Course", "Beverages"
3. Click **Appetizers** → See all appetizer dishes
4. Verify dish count badge shows correct count (e.g., "Appetizers (5)")

---

### C. Dish Variants (Sizes)

#### Manager: Create Variants for a Dish

1. Navigate to **Menu Management** → **Dishes**
2. Click **Edit** on a dish (e.g., "Coffee")
3. Enable **Has Variants** toggle
4. Click **Add Variant**:
   - Name: "Small"
   - Price: 300 (cents, i.e., $3.00)
   - Display Order: 1
5. Click **Add Variant** again:
   - Name: "Medium"
   - Price: 400 ($4.00)
   - Display Order: 2
6. Repeat for "Large" ($5.00)
7. Click **Save**

#### Customer: Order with Variant Selection

1. Scan QR code → Browse menu → Select "Coffee"
2. **Variant Selection Required** prompt appears
3. Select "Medium" ($4.00)
4. Optionally add modifiers (e.g., "Extra Shot +$1.00")
5. Verify total: $4.00 (Medium) + $1.00 (Extra Shot) = $5.00
6. Click **Add to Order**

#### Kitchen: View Order with Variant

1. Kitchen Dashboard → New order displays:
   ```
   Table 3 - Order #43
   1x Coffee (Medium)
      + Extra Shot (+$1.00)
   ```

---

### D. Dish Flags (Recommended, Chef's Special, Priority)

#### Manager: Flag a Dish

1. Navigate to **Menu Management** → **Dishes**
2. Click **Edit** on a dish (e.g., "Ribeye Steak")
3. Check **Chef's Special** ✓
4. Set **Order Priority**: 10 (high priority for kitchen)
5. Click **Save**

#### Customer: View Flagged Dishes

1. Scan QR code → Browse menu
2. Verify "Ribeye Steak" shows **Chef's Special** badge (star icon)
3. Verify "Recommended" dishes show **Recommended** badge (thumbs up icon)

#### Kitchen: Priority Sorting

1. Kitchen Dashboard → Submit multiple orders
2. Verify orders with high-priority dishes appear at TOP of queue
3. Example: Order with "Ribeye Steak" (priority=10) appears before order with "Salad" (priority=0)

---

### E. Temporary Item Hiding

#### Manager: Hide a Dish

1. Navigate to **Menu Management** → **Dishes**
2. Click **Hide** button next to a dish (e.g., "Lobster Bisque")
3. Verify dish shows "Hidden" badge in manager view

#### Customer: Verify Hidden Dish Not Visible

1. Scan QR code → Browse menu
2. Verify "Lobster Bisque" does NOT appear in any category

#### Staff: Manually Add Hidden Dish to Order

1. Login as kitchen/serving staff
2. Create manual order for a table
3. Search for "Lobster Bisque" → Shows warning: "This item is currently hidden"
4. Staff can still add it if customer specifically requests it

#### Manager: Re-enable Hidden Dish

1. In **Menu Management** → **Dishes**
2. Click **Show** button next to "Lobster Bisque"
3. Verify dish appears in customer menu within 5 seconds (real-time update)

---

### F. Table Reservations

#### Manager: Configure Operating Hours

1. Login as manager
2. Navigate to **Reservations** → **Operating Hours** tab
3. For each day of week:
   - Monday-Thursday: Open 11:00 AM, Close 10:00 PM
   - Friday-Sunday: Open 11:00 AM, Close 11:00 PM
4. Click **Save**

#### Customer: Submit Reservation (Public Form)

1. Open public reservation form: `http://localhost:3001/reservations/new`
2. Fill in:
   - Date: (tomorrow's date)
   - Time: 7:00 PM
   - Party Size: 4
   - Name: John Doe
   - Phone: (555) 123-4567
   - Notes: "Window seat preferred"
3. Click **Submit**
4. Verify success message: "Reservation submitted! You'll receive confirmation from staff."

#### Staff: Confirm Reservation

1. Login as staff
2. Navigate to **Reservations** dashboard
3. View **Pending** tab → See John Doe's reservation
4. Click **Confirm**
5. Assign tables: Select Table 10 and Table 11 (combined for party of 4)
6. Click **Save**
7. Reservation status changes to **Confirmed**

#### Staff: Mark Reservation as Seated

1. At reservation time, customer arrives
2. In **Reservations** dashboard, click **Mark Seated** for John Doe's reservation
3. Tables 10 and 11 automatically linked to new order session
4. Reservation status changes to **Seated**

#### Staff: Handle No-Show

1. If customer doesn't arrive within 15 minutes, reservation is highlighted
2. Click **Mark No-Show**
3. Tables 10 and 11 released for walk-in customers

#### Manager: View Reservation History

1. Navigate to **Reservations** → **History** tab
2. Filter by date range: Last 7 days
3. View all reservations with statuses (Seated, No-Show, Cancelled)

---

### G. Shift Management

#### Manager: Start a Shift

1. Login as manager
2. Navigate to **Shifts** → **Active Shifts** tab
3. Click **Start New Shift**
   - Shift Type: "Lunch"
   - Assign Staff: Select waiters Alice, Bob, Carol
4. Click **Start**
5. Shift begins at current time

#### Staff: Auto-Tagged Orders

1. During active "Lunch" shift, staff creates orders
2. All orders automatically tagged with current shift ID
3. No manual selection required

#### Manager: Add/Remove Staff Mid-Shift

1. In **Active Shifts** tab, click **Edit** on "Lunch" shift
2. Click **Add Staff** → Select Dave
3. Click **Remove Staff** → Deselect Carol (shift ended early)
4. Click **Save**

#### Manager: End Shift and View Summary

1. At end of service period, click **End Shift** for "Lunch"
2. System generates summary:
   ```
   Shift: Lunch
   Duration: 11:00 AM - 3:00 PM (4 hours)
   Total Orders: 47
   Total Revenue: $1,245.50
   Staff: Alice, Bob, Dave
   ```
3. Shift summary saved for historical reporting

#### Manager: View Shift History

1. Navigate to **Shifts** → **History** tab
2. Filter by:
   - Date Range: Last 30 days
   - Shift Type: "Lunch"
   - Staff Member: Alice
3. View all matching shifts with revenue and order counts

---

## Testing Checklist

### Modifiers

- [ ] Create modifier with positive price adjustment
- [ ] Create modifier with zero price adjustment (free customization)
- [ ] Create modifier with negative price adjustment (discount)
- [ ] Create modifier group with min/max constraints
- [ ] Assign modifiers to dish
- [ ] Customer selects modifiers within constraints
- [ ] Customer violates min/max constraints → error shown
- [ ] Order displays modifiers in kitchen dashboard
- [ ] Modifier becomes unavailable when ingredient depleted

### Categories

- [ ] Create multiple categories with display order
- [ ] Assign dishes to categories (many-to-many)
- [ ] Customer browses menu by category
- [ ] Hide category → verify not visible to customers
- [ ] Re-enable category → verify appears in customer menu

### Variants

- [ ] Create dish with variants (Small/Medium/Large)
- [ ] Customer selects variant → price updates
- [ ] Customer adds modifiers to variant → total = variant price + modifiers
- [ ] Order displays variant name in kitchen dashboard

### Flags

- [ ] Mark dish as "Recommended" → badge appears in menu
- [ ] Mark dish as "Chef's Special" → distinct badge appears
- [ ] Set high order priority → dish appears first in kitchen queue

### Hiding

- [ ] Hide dish → not visible in customer menu
- [ ] Hidden dish visible in manager dashboard with badge
- [ ] Staff can manually add hidden dish to order
- [ ] Re-enable dish → appears in customer menu within 5 seconds

### Reservations

- [ ] Configure operating hours for all days
- [ ] Customer submits reservation (valid date/time)
- [ ] Customer submits reservation for past date → error
- [ ] Customer submits reservation outside operating hours → error
- [ ] Staff confirms reservation with table assignment
- [ ] Staff declines reservation with reason
- [ ] Staff marks reservation as seated → order session starts
- [ ] Staff marks reservation as no-show
- [ ] Customer cancels reservation (> 1 hour before time)
- [ ] Customer cannot cancel within 1 hour → error
- [ ] Check availability for date/time → suggests alternative times if full

### Shifts

- [ ] Start shift with standard type (Breakfast/Lunch/Dinner)
- [ ] Start shift with custom type name
- [ ] Orders auto-tagged with current shift ID
- [ ] Add staff to active shift
- [ ] Remove staff from active shift
- [ ] End shift → summary generated (order count, revenue)
- [ ] View historical shifts by date range
- [ ] View historical shifts by staff member

---

## Troubleshooting

### Issue: Modifier Not Appearing for Dish

**Solution**: Verify modifier is assigned to dish via `dish_modifiers` table. Check modifier `isAvailable = true`.

### Issue: Category Hidden But Still Visible to Customers

**Solution**: Check customer query filters `WHERE isHidden = false`. Clear TanStack Query cache in browser.

### Issue: Reservation Rejected for Valid Time

**Solution**: Verify `operating_hours` table has entry for that day of week. Check `isClosed = false`.

### Issue: Orders Not Tagged with Shift ID

**Solution**: Verify staff user is assigned to active shift via `shift_staff` table. Check `shifts.endTime IS NULL`.

---

## Next Steps

After validating all features:

1. Run test suite: `bun test`
2. Generate test coverage report: `bun test:coverage`
3. Review constitution compliance (TDD, type safety, performance)
4. Update documentation: README.md, API reference
5. Create pull request with implementation

---

## Resources

- **Data Model**: See `data-model.md` for schema details
- **API Contracts**: See `contracts/` for tRPC procedure specifications
- **Research**: See `research.md` for technical decisions and best practices
- **Feature Spec**: See `spec.md` for full requirements and user stories
