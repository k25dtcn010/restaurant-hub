# Frontend Implementation for T084->T088.2 Spec 002 - Temporary Item Hiding

## Tasks to Implement

### T084 [P] - Add "Hide"/"Show" toggle button to dish list

- **File**: `apps/web/src/routes/menu-management.tsx`
- **Component**: Modify dish card in the Dishes tab
- **UI**: Eye icon button with tooltip
- **tRPC**: Use `dishes.toggleVisibility` mutation
- **Behavior**: Toggle icon shows current state (hidden/visible)

### T085 - Add "Hidden" badge to hidden dishes in manager view

- **File**: `apps/web/src/routes/menu-management.tsx`
- **Component**: Add badge in dish card header
- **Styling**: Gray badge with "Hidden" text
- **Visual**: Dish appears dimmed/muted when hidden

### T086 - Create "Hidden Items" quick-access section

- **File**: `apps/web/src/routes/menu-management.tsx`
- **Location**: Menu management dashboard (Dishes tab)
- **Display**: List of currently hidden dishes with one-click "Show" buttons
- **Filter**: `dishes.list({ includeHidden: true }).filter(d => d.isHidden)`

### T087 - Update menu query to exclude hidden dishes

- **File**: `apps/web/src/routes/index.tsx` (public menu)
- **Change**: Update query from `{ includeDisabled: false }` to `{ includeDisabled: false, includeHidden: false }`
- **Note**: The backend already filters out hidden dishes by default

### T088 - Add hidden dish warning in manual order creation

- **File**: `apps/web/src/components/menu-list.tsx`
- **Component**: Modify MenuList component to show warning for hidden dishes
- **UI**: Warning badge with ⚠️ icon for hidden dishes
- **Behavior**: When staff adds hidden dish, show confirmation dialog
- **tRPC**: Use `dishes.getAll({ includeHidden: true })` in staff-order.tsx to access all dishes

### T088.1 - Test: Hide dish → customer can't see → manager can re-enable

- Integration test file
- Test workflow: Hide → verify customer menu excludes → verify manager sees badge → re-enable

### T088.2 - Test: Historical orders with now-hidden dishes still display correctly

- Validation test file
- Ensure historical orders show dish details even if dish is now hidden

## Key Implementation Points

1. Backend already has:
   - `toggleVisibility` procedure (T083)
   - `getAll` with `includeHidden` parameter (T082)
   - `update` with `isHidden` field (T081)

2. UI Components to Use:
   - Eye icon from lucide-react for visibility toggle
   - Badge component from shadcn/ui for "Hidden" label
   - Dialog component for confirmation (already exists in DishCustomizationDialog pattern)
   - Existing Card, Button components

3. File Structure:
   - menu-management.tsx: Manager view (T084-T086)
   - index.tsx: Public menu (T087)
   - staff-order.tsx: Staff order creation (T088 partial)
   - menu-list.tsx: MenuList component (T088 UI)
   - Tests: T088.1 and T088.2

## Design Decisions

- Use Eye icon for visibility toggle (visible/hidden state)
- Gray badge (#808080 or similar) for hidden status
- Dimmed opacity (opacity-50 or opacity-60) for hidden dishes in manager view
- Staff order creation should allow hidden dishes with confirmation (real-world scenario: phone orders of items temporarily removed from menu)
- Historical orders preserve dish data even if hidden now (backward compatibility)
