# Table Selector Field Component Update

## Changes Made

Updated `TableSelectorColumn` to use Field components instead of Button menu pattern.

### Before
- Used `Button` components with `variant="ghost"` and `variant="default"`
- Simple click handler for selection
- No form semantics

### After
- Uses `FieldChoiceCard` pattern with:
  - `RadioGroup` for state management
  - `FieldLabel` wrapper for each table option
  - `Field` with `orientation="horizontal"` 
  - `RadioGroupItem` for radio button
  - `FieldContent` containing title and description
  - `FieldTitle` for table number
  - `FieldDescription` for seat count
  - `Badge` for "In Use" status (right side)

### Component Structure
```
FieldGroup
  └── FieldSet
      └── RadioGroup (managed state: selectedTableId)
          └── For each table:
              FieldLabel
              └── Field (horizontal)
                  ├── RadioGroupItem
                  └── FieldContent
                      ├── FieldTitle (Table {number})
                      ├── FieldDescription ({capacity} seats)
                      └── Badge (if hasActiveOrder)
```

### Features
- ✅ Proper form semantics with RadioGroup
- ✅ Searchable via Input field in header
- ✅ Visual feedback on selected table
- ✅ "In Use" badge indicator
- ✅ Scrollable content area
- ✅ Summary line showing selected table at bottom
- ✅ Consistent with FieldChoiceCard pattern used in MenuItemCard

### Key Attributes
- `orientation="horizontal"` - Displays radio button and content side-by-side
- `onClick={() => onSelectTable(table.id)}` on RadioGroupItem for immediate feedback
- `value={selectedTableId?.toString() || ""}` on RadioGroup for state tracking
- Search filter on table number and capacity
