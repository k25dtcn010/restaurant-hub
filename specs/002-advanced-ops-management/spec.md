# Feature Specification: Advanced Operations Management

**Feature Branch**: `002-advanced-ops-management`  
**Created**: 2025-10-18  
**Status**: Draft  
**Input**: User description: "Extend features based on Spec 1: 001-restaurant-hub-mvp - Menu Management with modifiers and special requests, Category Management with flags, Reservation Management, and Shift/Session Management"

## Clarifications

### Session 2025-10-18

- Q: Should there be limits on how many modifiers customers can select from a modifier group? → A: Optional min/max per group - managers define constraints when creating modifier groups (e.g., "1-3 toppings", "exactly 1 size")
- Q: Should the public reservation form have protection against spam or malicious bookings? → A: Staff confirmation after booking - reservations require staff approval before being confirmed
- Q: How should restaurant operating hours be configured for reservation validation? → A: Manager-configurable per day - managers set hours for each day of week (e.g., Mon-Thu vs Fri-Sun)
- Q: Can categories be truly deleted or should they follow soft-delete pattern like dishes? → A: Soft delete only (hide) - categories can only be hidden, not deleted, maintaining referential integrity
- Q: Are modifiers dish-specific or can they be reused across multiple dishes? → A: Shared modifier pool - modifiers exist globally, managers select which modifiers apply to which dishes

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Menu Item Customization with Modifiers (Priority: P1)

Customers ordering via QR code or staff creating orders can add modifiers to dishes (e.g., "extra cheese", "no onions", "less sugar") and include special requests (e.g., "gluten-free preparation"). The kitchen receives these customizations with each order item.

**Why this priority**: Menu customization is essential for customer satisfaction and competitive differentiation. Modern diners expect the ability to personalize their orders. This directly impacts customer experience and order accuracy.

**Independent Test**: Can be fully tested by viewing a dish in the menu, selecting available modifiers (both additions and removals), entering a special request in the text field, submitting the order, and verifying the kitchen dashboard displays all customizations clearly with the order item.

**Acceptance Scenarios**:

1. **Given** a customer views a dish detail page, **When** they expand the customization options, **Then** they see all available modifiers grouped by category (e.g., "Add-ons", "Modifications", "Preparation Style")
2. **Given** a customer selects a modifier with additional cost, **When** they add it to their order, **Then** the order total increases by the modifier price
3. **Given** a customer selects a modifier that is free (e.g., "no onions"), **When** they add it to their order, **Then** the order total remains unchanged
4. **Given** a customer enters a special request text, **When** they submit the order, **Then** the request is attached to that specific order item and visible in the kitchen dashboard
5. **Given** a modifier is marked as "out of stock" by kitchen staff, **When** a customer views the dish, **Then** that modifier is disabled and shows as unavailable
6. **Given** staff creates an order manually, **When** they add a dish, **Then** they have access to the same modifier options and special request field as customers

---

### User Story 2 - Menu Category Organization and Flags (Priority: P1)

Managers organize menu items into categories (e.g., "Appetizers", "Main Course", "Desserts", "Beverages") and can flag items as "Recommended", "Chef's Special", or set "Order Priority" for kitchen preparation sequence.

**Why this priority**: Proper menu organization is critical for customer browsing experience and kitchen workflow efficiency. Categories help customers find items quickly, while flags influence both customer decisions and kitchen operations.

**Independent Test**: Create categories, assign dishes to categories, apply flags (Recommended, Chef's Special, Priority), and verify the customer menu displays items grouped by category with visual indicators for flagged items. Verify kitchen dashboard respects order priority.

**Acceptance Scenarios**:

1. **Given** a manager accesses the menu management interface, **When** they create a new category, **Then** they can specify category name, display order, and optional icon/image
2. **Given** multiple categories exist, **When** a manager edits a dish, **Then** they can assign it to one or more categories
3. **Given** a dish is flagged as "Recommended", **When** customers view the menu, **Then** a visual badge or icon appears on that dish
4. **Given** a dish is flagged as "Chef's Special", **When** customers view the menu, **Then** a distinct visual indicator highlights the dish prominently
5. **Given** multiple orders are in "Pending" status with different priority levels, **When** kitchen staff view the dashboard, **Then** orders containing high-priority items appear at the top of the queue
6. **Given** a customer browses the menu via QR code, **When** they view the category list, **Then** categories are displayed in the manager-specified order with item counts
7. **Given** a manager disables a category, **When** customers view the menu, **Then** that category and its items are hidden (but remain in the database for historical orders)

---

### User Story 3 - Menu Item Variants (Sizes and Options) (Priority: P2)

Managers can define multiple variants for a single dish with different prices and sizes (e.g., "Small Coffee $3", "Medium Coffee $4", "Large Coffee $5" or "Cheese Pizza - 10 inch $12", "Cheese Pizza - 14 inch $18"). Customers select their preferred variant when ordering.

**Why this priority**: Many restaurants offer size variations for beverages and dishes. This is important for revenue optimization and customer choice but not critical for basic ordering workflow.

**Independent Test**: Create a dish with multiple variants (sizes/prices), verify customers can select a variant when ordering, verify the correct price is applied to the order, and verify kitchen receives the variant information.

**Acceptance Scenarios**:

1. **Given** a manager creates a new dish, **When** they enable variants, **Then** they can define multiple options with names (e.g., "Small", "Medium", "Large") and individual prices
2. **Given** a dish has variants enabled, **When** a customer adds it to their order, **Then** they must select a variant before proceeding (variant selection is required)
3. **Given** a customer selects a "Large" variant, **When** the order is submitted, **Then** the order item reflects the variant name and variant-specific price
4. **Given** modifiers are available for a dish with variants, **When** a customer selects a variant and then adds modifiers, **Then** the total price = (variant price + sum of modifier prices)
5. **Given** a variant has a different recipe (ingredient requirements) than other variants, **When** an order is submitted, **Then** ingredient stock is reduced based on the selected variant's recipe
6. **Given** a manager views inventory impact, **When** they analyze a dish with variants, **Then** they see ingredient consumption broken down by variant

---

### User Story 4 - Temporary Item Hiding (Priority: P2)

Managers or kitchen staff can temporarily hide menu items from customer view without deleting them (e.g., a dish is out of stock for the day, or an ingredient delivery is delayed). Hidden items remain in the system for future re-activation and historical order tracking.

**Why this priority**: Real-world restaurants frequently have temporary unavailability (86'd items in kitchen terminology). This prevents customer frustration and kitchen errors but is less critical than core ordering features.

**Independent Test**: Manager marks a dish as "hidden" or "temporarily unavailable", verify it disappears from customer menu view (both QR and category browsing), verify existing orders with that dish remain intact, verify the dish can be re-enabled and appears immediately in customer view.

**Acceptance Scenarios**:

1. **Given** a manager accesses the menu management interface, **When** they toggle a dish to "hidden" status, **Then** the dish is immediately removed from customer-facing menus but remains visible in manager dashboards with a "Hidden" badge
2. **Given** a dish is marked as hidden, **When** kitchen staff try to add it to a manual order, **Then** they see a warning that the item is currently hidden but can still add it if customer specifically requests it
3. **Given** a previously hidden dish is re-enabled, **When** a customer refreshes their menu view, **Then** the dish appears in its assigned category within 5 seconds
4. **Given** a dish is hidden during peak hours, **When** managers view order history, **Then** past orders containing that dish still display correctly with full details
5. **Given** multiple dishes are hidden, **When** a manager views the menu dashboard, **Then** they see a quick-access section showing all currently hidden items for easy re-activation
6. **Given** a dish has been hidden for more than 7 days, **When** a manager views the hidden items list, **Then** the system displays an alert suggesting review of that item's status

---

### User Story 5 - Table Reservation System (Priority: P2)

Customers can create reservations by specifying date, time, party size, and contact information. Staff can view upcoming reservations, assign tables to reservations, mark reservations as arrived/seated, or cancel/modify reservations as needed.

**Why this priority**: Reservations improve customer experience and help manage peak-hour capacity, but the core MVP already handles walk-in customers. This is valuable but not essential for day-to-day operations.

**Independent Test**: Create a reservation as a customer (via public reservation form), verify staff see it in the reservations dashboard, assign a table to it, mark it as "arrived", and verify the table's QR code session starts automatically. Test cancellation and modification workflows.

**Acceptance Scenarios**:

1. **Given** a customer accesses the public reservation form, **When** they fill in date, time (in 30-minute increments), party size, name, phone number, and optional notes, **Then** the system validates availability and creates a reservation with "Pending" status awaiting staff confirmation
2. **Given** a new reservation is submitted, **When** staff view the reservations dashboard, **Then** they see pending reservations requiring confirmation with customer details and requested time
3. **Given** a pending reservation exists, **When** staff review and approve it, **Then** the reservation status changes to "Confirmed" and the customer contact information is used for any necessary follow-up
4. **Given** a reservation is created, **When** staff view the reservations dashboard for a specific date, **Then** they see all confirmed reservations sorted by time with party size and contact info
5. **Given** a reservation time is approaching (within 15 minutes), **When** staff check the dashboard, **Then** the confirmed reservation is highlighted or moved to an "Arriving Soon" section
6. **Given** a customer with a reservation arrives, **When** staff mark the reservation as "Seated", **Then** the assigned table is automatically linked to a new order session
7. **Given** a pending reservation exists, **When** staff determine it cannot be accommodated, **Then** they can decline it with an optional reason (e.g., "fully booked")
8. **Given** a reservation exists for a specific time slot, **When** another customer tries to book the same time and table count exceeds available tables, **Then** the system suggests alternative times (30 minutes before/after)
9. **Given** a customer calls to cancel a reservation, **When** staff cancel it in the system, **Then** the table becomes available for that time slot again
10. **Given** a reservation is for 6 people, **When** staff assign a table, **Then** the system suggests tables with capacity >= party size and allows combining smaller tables
11. **Given** a reservation is marked "No-Show" (not arrived within 15 minutes after scheduled time), **When** staff check availability, **Then** the table is released for walk-in customers

---

### User Story 6 - Shift and Session Management (Priority: P3)

Managers can start and end operational shifts/sessions, tracking which staff members are on duty, the time range of the shift, and associating orders with specific shifts for reporting and accountability.

**Why this priority**: Shift management is valuable for accountability and reporting but doesn't block core operations. The system can function without explicit shift tracking by using timestamps and user associations.

**Independent Test**: Manager starts a shift (specifying shift name, start time, and assigned staff), verify orders created during the shift are automatically tagged with shift ID, end the shift, and verify a shift summary report shows order count, revenue, and staff involved.

**Acceptance Scenarios**:

1. **Given** a manager opens a new shift at the start of a service period, **When** they specify shift type (e.g., "Breakfast", "Lunch", "Dinner") and start time, **Then** the system creates an active shift record and allows staff login
2. **Given** an active shift is running, **When** staff members log in, **Then** their user accounts are automatically associated with the current shift
3. **Given** orders are created during an active shift, **When** the shift ends, **Then** all orders from that time period are linked to the shift for reporting
4. **Given** a manager ends a shift, **When** they close it, **Then** the system generates a shift summary showing total orders, total revenue, number of tables served, and staff who worked
5. **Given** multiple shifts overlap (e.g., lunch shift ending while dinner shift starts), **When** a manager views the dashboard, **Then** they can clearly see active shifts and their respective metrics
6. **Given** a shift has been running for an unusually long time (>12 hours), **When** a manager views active shifts, **Then** the system displays a warning suggesting the shift may need to be closed
7. **Given** a manager reviews historical shifts, **When** they filter by date range or staff member, **Then** they see all relevant shifts with revenue and order statistics

---

### Edge Cases

- **What happens when a modifier has ingredient requirements but the ingredient is out of stock?** The modifier is automatically marked as unavailable, similar to how dishes become unavailable when ingredients are depleted.
- **What happens when a customer tries to reserve a table for a date in the past?** The reservation form validates the date and prevents submission if the date is before today.
- **What happens when a dish with active variants is deleted by a manager?** The system prevents deletion and requires the dish to be "hidden" instead, preserving historical order data integrity.
- **What happens when a reservation overlaps with an existing table's active order session?** The system flags the conflict in the reservations dashboard and suggests either a different table or a slightly adjusted reservation time.
- **What happens when a shift is manually closed but there are still open (unpaid) orders?** The system allows closure but displays a warning showing the count of open orders and prompts confirmation.
- **What happens when a modifier price changes while there are pending orders with that modifier?** Existing orders retain the modifier price at the time of ordering (priceAtOrder), new orders use the updated price.
- **What happens when a global modifier price is updated (e.g., "extra cheese" changes from $2 to $2.50)?** The new price applies to all dishes that use that modifier for future orders; existing pending orders retain the old price for consistency.
- **What happens when a reservation is for more people than any single table can accommodate?** The system suggests combining multiple tables and allows staff to assign a "table group" to the reservation.
- **What happens when a category is hidden but dishes are still assigned to it?** The dishes remain assigned to the hidden category in the database, but neither the category nor its dishes appear in customer-facing menus; dishes can still be found if they belong to other visible categories.

## Requirements _(mandatory)_

### Functional Requirements

**Menu Modifiers and Customization**

- **FR-001**: System MUST allow managers to define modifiers globally with name, price adjustment (positive, zero, or negative), and availability status
- **FR-001a**: System MUST allow managers to associate modifiers with specific dishes (many-to-many relationship), selecting which modifiers are available for each dish
- **FR-001b**: System MUST allow managers to organize modifiers into groups, then assign those groups to dishes for consistent modifier presentation
- **FR-002**: System MUST support grouping modifiers into categories (e.g., "Add-ons", "Preparation", "Dietary") for organized display
- **FR-002a**: System MUST allow managers to define optional minimum and maximum selection constraints for each modifier group (e.g., "select 1-3 toppings", "choose exactly 1 size", or "unlimited selections")
- **FR-002b**: System MUST enforce modifier group selection constraints at order submission, preventing orders that violate min/max rules
- **FR-003**: System MUST display available modifiers when customers or staff view dish details
- **FR-004**: System MUST apply modifier prices to the order total when modifiers are selected
- **FR-005**: System MUST allow customers and staff to enter free-form special request text for each order item (max 200 characters)
- **FR-006**: System MUST display modifiers and special requests in the kitchen dashboard alongside dish names and quantities
- **FR-007**: System MUST mark modifiers as unavailable when their required ingredients are out of stock
- **FR-008**: System MUST track modifier ingredient requirements separately from base dish recipes

**Menu Categories**

- **FR-009**: System MUST allow managers to create and edit menu categories with name, display order (integer), and optional icon/image URL
- **FR-009a**: System MUST allow managers to hide categories (soft delete) but NOT permanently delete them to maintain referential integrity with historical data
- **FR-010**: System MUST allow managers to assign dishes to one or more categories
- **FR-011**: System MUST display menu items grouped by category in customer-facing interfaces, ordered by category display order
- **FR-012**: System MUST support category-level visibility toggle (hidden categories don't appear in customer view but remain in database)
- **FR-013**: System MUST display item count per category when customers browse the menu

**Menu Item Flags**

- **FR-014**: System MUST support three flag types: "Recommended" (boolean), "Chef's Special" (boolean), and "Order Priority" (integer, default 0)
- **FR-015**: System MUST display visual badges for "Recommended" and "Chef's Special" items in customer menu view
- **FR-016**: System MUST sort kitchen dashboard orders by order priority (high to low) within each status category
- **FR-017**: System MUST allow managers to toggle flags on/off for any dish

**Menu Item Variants (Sizes and Options)**

- **FR-018**: System MUST allow managers to enable variant support for a dish and define multiple variants with name and price
- **FR-019**: System MUST require customers to select a variant when ordering a dish with variants enabled
- **FR-020**: System MUST apply the selected variant's price to the order item total
- **FR-021**: System MUST allow defining variant-specific ingredient requirements (different recipes for different sizes)
- **FR-022**: System MUST display variant information in order history and kitchen dashboard (e.g., "Large Coffee")
- **FR-023**: System MUST calculate modifier prices in addition to variant prices (total = variant price + modifier prices)

**Temporary Item Hiding**

- **FR-024**: System MUST allow managers and kitchen staff to toggle a "hidden" status for any dish
- **FR-025**: System MUST exclude hidden dishes from customer-facing menu views (QR code, category browsing)
- **FR-026**: System MUST allow staff to view hidden dishes in management interfaces with a "Hidden" badge
- **FR-027**: System MUST allow staff to manually add hidden dishes to orders if specifically requested by customers
- **FR-028**: System MUST preserve historical orders containing dishes that are currently hidden
- **FR-029**: System MUST re-display hidden dishes in customer view within 5 seconds of being re-enabled

**Table Reservations**

- **FR-030**: System MUST provide a public reservation form accepting date, time (30-minute increments), party size, customer name, phone number, and optional notes
- **FR-030a**: System MUST allow managers to configure operating hours for each day of the week with open time and close time (e.g., different hours for weekdays vs weekends)
- **FR-030b**: System MUST allow managers to mark specific days as closed (e.g., holidays) where no reservations are accepted
- **FR-031**: System MUST validate reservation date is not in the past and time is within the configured operating hours for that day of week
- **FR-032**: System MUST create reservation requests with "Pending" status awaiting staff confirmation to prevent spam and validate legitimate bookings
- **FR-033**: System MUST allow staff to review pending reservations and either confirm or decline them with optional reason
- **FR-034**: System MUST check table availability for the requested date/time/party size when staff confirm a reservation and warn if conflicts exist
- **FR-035**: System MUST allow staff to view all reservations for a specific date, sorted by time, with status filtering (Pending, Confirmed, Seated, etc.)
- **FR-036**: System MUST allow staff to assign one or more tables to a confirmed reservation
- **FR-037**: System MUST support reservation statuses: "Pending", "Confirmed", "Seated", "No-Show", "Cancelled", "Declined"
- **FR-038**: System MUST automatically highlight confirmed reservations within 15 minutes of scheduled time
- **FR-039**: System MUST allow staff to mark confirmed reservations as "Seated" and automatically start an order session for the assigned table(s)
- **FR-040**: System MUST allow customers or staff to cancel reservations; pending reservations can be cancelled anytime, confirmed reservations can be cancelled up to 1 hour before scheduled time
- **FR-041**: System MUST suggest table combinations when party size exceeds individual table capacity
- **FR-042**: System MUST prevent double-booking of tables for overlapping time slots when confirming reservations (reservation duration assumed 90 minutes unless specified)

**Shift and Session Management**

- **FR-041**: System MUST allow managers to start a new shift with shift type (e.g., "Breakfast", "Lunch", "Dinner"), start time, and optionally assigned staff
- **FR-042**: System MUST associate staff login sessions with the currently active shift
- **FR-043**: System MUST tag all orders created during a shift with the shift ID
- **FR-044**: System MUST allow managers to end a shift and generate a summary report with order count, total revenue, tables served, and staff list
- **FR-045**: System MUST support multiple concurrent shifts (e.g., overlapping lunch and dinner shifts)
- **FR-046**: System MUST display warnings when a shift has been active for more than 12 hours
- **FR-047**: System MUST allow managers to view historical shifts filtered by date range or staff member
- **FR-048**: System MUST prevent accidental closure of shifts with open (unpaid) orders by displaying a confirmation prompt

### Key Entities

- **Modifier**: Represents a customization option that can be applied to multiple dishes (e.g., "extra cheese"); has name, price adjustment (can be 0, positive, or negative), availability status, and optional ingredient requirements; exists in a global pool and is associated with dishes via DishModifier join table
- **ModifierGroup**: Represents a category of modifiers (e.g., "Add-ons", "Preparation Style"); has name, display order, optional minimum selections allowed (integer, nullable, default null = no minimum), optional maximum selections allowed (integer, nullable, default null = unlimited), and belongs to specific dishes
- **DishModifier**: Join table linking dishes to available modifiers (many-to-many relationship); specifies which modifiers are applicable to which dishes
- **Category**: Represents a menu section (e.g., "Appetizers", "Desserts"); has name, display order (integer for sorting), optional icon/image URL, and visibility status (active/hidden)
- **DishCategory**: Join table linking dishes to categories (many-to-many relationship)
- **DishVariant**: Represents a size or option for a dish (e.g., "Small", "Medium", "Large"); has name, price, and optional variant-specific recipe (ingredient requirements)
- **OrderItemModifier**: Join table linking order items to selected modifiers; includes modifier name and price at time of order (for historical accuracy)
- **OperatingHours**: Represents restaurant hours for a specific day of week; has day (0-6 for Sunday-Saturday), open time, close time, and is_closed flag for holidays/special closures
- **Reservation**: Represents a table booking; has date, time, party size, customer name, phone number, optional notes, assigned table(s), status (Pending, Confirmed, Seated, No-Show, Cancelled, Declined), optional decline reason, and created/updated timestamps
- **Shift**: Represents an operational period; has shift type (string), start time, end time (nullable for active shifts), staff associations, and generated shift summary data (order count, revenue)
- **ShiftStaff**: Join table linking shifts to users (staff members who worked during the shift)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Customers can add modifiers and special requests to a dish and complete order submission within 4 minutes (1 minute more than baseline to account for customization time)
- **SC-002**: 90% of orders include at least one modifier or special request, demonstrating customer engagement with customization features
- **SC-003**: Kitchen staff can view and understand order customizations (modifiers + special requests) without needing clarification from serving staff in 95% of cases
- **SC-004**: Menu browsing by category reduces average time to find a desired dish by 40% compared to unorganized flat menu lists
- **SC-005**: Flagged items ("Recommended", "Chef's Special") are ordered 60% more frequently than non-flagged equivalent items
- **SC-006**: Kitchen dashboard respects order priority flags, processing high-priority orders 30% faster than standard priority
- **SC-007**: Managers can hide/unhide dishes in under 30 seconds, with changes reflected in customer view within 5 seconds
- **SC-008**: Reservation system handles at least 50 reservations per day with zero double-booking errors
- **SC-009**: 85% of reservations arrive and are seated within 10 minutes of scheduled time
- **SC-010**: Shift summary generation completes within 10 seconds and provides accurate revenue and order count data
- **SC-011**: System supports at least 3 concurrent active shifts without performance degradation
- **SC-012**: Variant selection (size/option) is completed by customers in under 15 seconds, with clear pricing display

## Assumptions

- Restaurant staff have been trained on menu management workflows (creating modifiers, managing categories, toggling flags)
- Modifier ingredient requirements are defined manually by managers when creating modifiers
- Customers understand standard modifier terminology (e.g., "extra", "no", "light", "on the side")
- Managers configure restaurant operating hours for each day of the week during initial system setup (e.g., Mon-Thu: 11 AM - 10 PM, Fri-Sun: 11 AM - 11 PM)
- Reservation time slots outside configured operating hours are automatically unavailable in the public form
- Average table turnover time for reservations is 90 minutes unless explicitly specified by staff
- Shift types (Breakfast, Lunch, Dinner, etc.) are predefined but customizable by managers
- Staff members can work across multiple shifts (e.g., same waiter works lunch and dinner)
- Modifier prices are set manually by managers based on ingredient costs and business strategy
- Customers making reservations via public form do not require authentication
- Restaurant operates a single location (no multi-location reservation coordination required)
- Variant recipes (if different from base dish) are defined at the time variants are created
- Category icons/images are hosted URLs (not uploaded files) or selected from a predefined icon library

## Out of Scope (for this feature)

- Online reservation payments or deposits (cash-only at table remains the payment method)
- Automated modifier suggestions based on customer preferences or order history
- Modifier inventory auto-depletion (managers manually mark modifiers unavailable)
- SMS or email confirmation for reservations (reservations are confirmed only via the web interface)
- Waitlist management for walk-in customers when all tables are reserved
- Dynamic pricing for variants based on time of day or demand
- Customer accounts for saving favorite modifiers or frequent customizations
- Integration with third-party reservation platforms (OpenTable, Resy, etc.)
- Shift-based staff scheduling or labor cost analysis
- Detailed analytics on modifier popularity or revenue contribution
- Multi-language support for modifier names or category labels
- Voice ordering or accessibility features for modifier selection
- Automated shift handoff notifications or checklist workflows
