# Staff-Order Page UI Redesign

## Changes Made

Redesigned the staff-order page from a stacked layout to a modern 3-column layout with improved UX.

### New Components Created

1. **MenuItemCard** (`apps/web/src/components/menu-item-card.tsx`)
   - Uses FieldChoiceCard pattern with Radio components
   - Displays dish info: name, description, price, photo
   - Includes quantity controls (Add/+/- buttons)
   - Supports badges for recommendations, chef specials, hidden items
   - Shows confirmation dialog for hidden dishes
   - Responsive and clean horizontal card layout

2. **TableSelectorColumn** (`apps/web/src/components/table-selector-column.tsx`)
   - Left column (1/3 width)
   - Scrollable table list with search functionality
   - Shows table number, capacity, and "In Use" status
   - Visual indicator for selected table
   - Persistent search field

3. **MenuListColumn** (`apps/web/src/components/menu-list-column.tsx`)
   - Center column (1/3 width)
   - Scrollable menu items with search
   - Uses MenuItemCard for each item
   - Integrates FieldGroup/FieldSet for proper structure
   - Shows item count at bottom
   - Search supports dish name and description

4. **OrderCartColumn** (`apps/web/src/components/order-cart-column.tsx`)
   - Right column (1/3 width)
   - Scrollable cart items display
   - Shows subtotal and total with item count
   - Remove item buttons
   - Submit order button
   - Empty state with helpful message

### Layout Structure

- **Header**: Page title and description (fixed at top)
- **3 Equal Columns**: Takes up remaining screen space
  - All columns have `h-full` and scroll independently
  - No horizontal scrolling needed
  - When no table selected: center and right show placeholder messages

### Features

- ✅ Tables have persistent search
- ✅ Menu items have persistent search (by name and description)
- ✅ All columns are scrollable
- ✅ Menu items use Field components as requested
- ✅ Quantity controls built into menu items
- ✅ Hidden dish confirmation dialog still works
- ✅ Clean visual hierarchy with borders and spacing

### UI Patterns Used

- RadioGroupItem + FieldLabel + Field (horizontal) for menu cards
- ScrollArea for scrollable columns
- Card + CardHeader + CardContent + CardFooter for containers
- Search with magnifying glass icon
- Badge variants for status indicators
