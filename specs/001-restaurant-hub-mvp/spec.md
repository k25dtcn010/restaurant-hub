# Feature Specification: RestaurantHub MVP

**Feature Branch**: `001-restaurant-hub-mvp`  
**Created**: 2025-10-17  
**Status**: Draft  
**Input**: User description: "Develop RestaurantHub, a lightweight restaurant management platform designed for small restaurants and cafes. The system should allow staff and customers to interact smoothly across the full dining flow."

## Clarifications

### Session 2025-10-17

- Q: How should real-time notifications be delivered to staff dashboards? → A: WebSocket/Server-Sent Events - Server pushes updates instantly to connected dashboards
- Q: What level of authentication security should staff login require? → A: Username + Password - Standard password-based authentication
- Q: What menu management capabilities must managers have? → A: Add/edit/disable dishes and prices - Managers can modify menu items and pricing
- Q: Can items be removed from an order after submission? → A: Only before "In Kitchen" - Items can be removed while status is "Pending"
- Q: How many tables should the system support? → A: 25-30 tables

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Customer Self-Service Ordering (Priority: P1)

A customer arrives at a table, scans the QR code with their phone, views the menu, selects dishes, and submits their order. The order is immediately sent to the kitchen, and inventory is automatically updated.

**Why this priority**: This is the core value proposition of RestaurantHub - enabling customers to order independently without waiting for staff attention. This directly improves customer satisfaction and reduces staff workload.

**Independent Test**: Can be fully tested by scanning a table QR code, browsing the menu, adding items to an order, and submitting it. Verify the order appears in the kitchen dashboard and ingredient quantities decrease appropriately. This delivers immediate value by enabling the complete customer ordering flow.

**Acceptance Scenarios**:

1. **Given** a customer scans a table QR code, **When** they view the menu, **Then** they see all available dishes with names, descriptions, prices, and photos
2. **Given** a customer is viewing the menu, **When** they select a dish and specify quantity, **Then** the item is added to their current order with correct quantity and price
3. **Given** a customer has items in their order, **When** they submit the order, **Then** the order is created with status "Pending", the kitchen is notified in real-time, and ingredient stock is reduced
4. **Given** a dish requires an ingredient that is out of stock, **When** the customer tries to order it, **Then** the system displays a message that the dish is unavailable
5. **Given** a customer has already submitted an order, **When** they scan the same table QR code again, **Then** they can add more items to the existing order
6. **Given** a customer adds new items to an existing order, **When** they submit the addition, **Then** the kitchen receives a notification about the new items only

---

### User Story 2 - Kitchen Order Management (Priority: P1)

Kitchen staff view incoming orders on a dashboard, see which dishes need to be prepared for which tables, update order status as they work, and notify serving staff when dishes are ready.

**Why this priority**: Without kitchen management, orders cannot be fulfilled. This is equally critical to P1 as it completes the basic order fulfillment loop.

**Independent Test**: Create test orders manually, verify they appear on the kitchen dashboard grouped by table, change their status through the workflow (Pending → In Kitchen → Ready to Serve), and verify status updates are reflected in real-time.

**Acceptance Scenarios**:

1. **Given** a new order is submitted, **When** the kitchen dashboard loads, **Then** the order appears in the "Pending" section with table number, dishes, quantities, and timestamp
2. **Given** orders exist for multiple tables, **When** kitchen staff view the dashboard, **Then** orders are grouped by table and sorted by submission time (oldest first)
3. **Given** a kitchen staff member starts preparing a dish, **When** they mark it as "In Kitchen", **Then** the order moves to the "In Kitchen" section and the status timestamp is updated
4. **Given** a dish is finished cooking, **When** kitchen staff mark it as "Ready to Serve", **Then** serving staff receive a real-time notification and the order moves to the "Ready" section
5. **Given** multiple dishes are in different stages, **When** kitchen staff view the dashboard, **Then** they see clear visual distinction between Pending, In Kitchen, and Ready to Serve orders

---

### User Story 3 - Staff-Assisted Ordering (Priority: P2)

A waiter assists a customer who prefers not to use the QR code. The waiter creates an order manually on behalf of the customer using a staff interface, specifying the table number and dishes.

**Why this priority**: This provides flexibility for customers who are not comfortable with technology or prefer personal service. It's secondary because the QR self-service is the primary flow.

**Independent Test**: Log in as a waiter, create an order for a specific table by selecting dishes from the menu, submit it, and verify it appears in the kitchen dashboard exactly like a QR-generated order.

**Acceptance Scenarios**:

1. **Given** a waiter is logged into the staff interface, **When** they select "Create Order", **Then** they can choose a table number and browse the menu
2. **Given** a waiter is creating an order, **When** they add dishes to the order, **Then** they see the same menu items and pricing as customers see via QR
3. **Given** a waiter has selected dishes, **When** they submit the order, **Then** the order is created with the same workflow as QR orders (kitchen notification, inventory reduction, status "Pending")
4. **Given** an existing order was created via QR, **When** a waiter views it in the staff interface, **Then** they can add additional items to that order
5. **Given** a waiter views all active orders, **When** they filter by table number, **Then** they see all orders (QR and staff-created) for that table

---

### User Story 4 - Order Status Tracking and Serving (Priority: P2)

Serving staff receive notifications when dishes are ready, view which tables need service, update order status to "Served" when delivered, and mark orders as "Completed" when customers finish.

**Why this priority**: This completes the service loop and ensures proper order lifecycle management. It's P2 because basic ordering and kitchen management (P1) provide core value even without detailed serving tracking.

**Independent Test**: Create orders and advance them to "Ready to Serve" status. Verify serving staff see notifications, can mark orders as "Served" when delivered, and can complete orders. Verify status history is tracked.

**Acceptance Scenarios**:

1. **Given** a dish is marked "Ready to Serve" by the kitchen, **When** a waiter checks their dashboard, **Then** they see a notification with the table number and dishes ready
2. **Given** a waiter delivers food to a table, **When** they mark the order as "Served", **Then** the order status updates and the timestamp is recorded
3. **Given** multiple orders are ready for serving, **When** a waiter views the dashboard, **Then** orders are prioritized by how long they've been waiting (oldest first)
4. **Given** a customer has finished eating, **When** a waiter marks the order as "Completed", **Then** the order moves to completed history but remains accessible for payment processing
5. **Given** a waiter views a specific table, **When** they check order status, **Then** they see the full status history (Pending → In Kitchen → Ready → Served → Completed) with timestamps

---

### User Story 5 - Inventory Management and Alerts (Priority: P3)

Managers view current ingredient inventory, see which items are running low, and receive alerts when stock falls below minimum thresholds. They can also manually adjust inventory levels.

**Why this priority**: Inventory management is important for operations but not critical for the MVP's core ordering workflow. The system can function without proactive inventory alerts as long as out-of-stock dishes are blocked from ordering (handled in P1).

**Independent Test**: View the inventory dashboard showing all ingredients with current quantities. Manually adjust an ingredient quantity. Create orders that consume ingredients and verify quantities decrease. Set low-stock thresholds and verify alerts appear when thresholds are crossed.

**Acceptance Scenarios**:

1. **Given** a manager accesses the inventory dashboard, **When** they view ingredients, **Then** they see all ingredients with current quantity, unit of measure, and low-stock threshold
2. **Given** ingredients are displayed, **When** an ingredient quantity falls below its threshold, **Then** it is highlighted with a visual alert (e.g., red background or warning icon)
3. **Given** a manager needs to restock, **When** they select an ingredient and update its quantity, **Then** the new quantity is saved and reflected immediately in the inventory
4. **Given** orders are being fulfilled, **When** dishes are ordered, **Then** ingredient quantities automatically decrease based on recipe requirements
5. **Given** an ingredient reaches zero quantity, **When** the manager views the inventory, **Then** all dishes requiring that ingredient show as "Unavailable" in the menu
6. **Given** a manager wants to prevent stockouts, **When** they set a low-stock threshold for an ingredient, **Then** they receive an alert notification when stock falls below that level

---

### User Story 6 - Cash Payment Processing (Priority: P2)

When a customer is ready to pay, serving staff view the order total, mark the order as "Paid" after receiving cash, and the table session is cleared for the next customer.

**Why this priority**: Payment is essential to complete the transaction, but the MVP focuses on cash-only, which is simpler than digital payments. It's P2 because order management provides value even before payment handling is implemented.

**Independent Test**: Create and complete an order through all stages. View the order total in the staff interface. Mark the order as "Paid" after receiving cash. Verify the table session is reset and the QR code can be used for a new order.

**Acceptance Scenarios**:

1. **Given** a customer requests the bill, **When** serving staff view the order, **Then** they see the itemized list of dishes with individual prices and the total amount due
2. **Given** a customer pays in cash, **When** the staff member marks the order as "Paid", **Then** the order status updates to "Paid", the payment timestamp is recorded, and the table session ends
3. **Given** an order is marked as "Paid", **When** a new customer scans the same table's QR code, **Then** they start a fresh order session with no reference to the previous order
4. **Given** staff view payment history, **When** they filter by date or table, **Then** they see all completed and paid orders with timestamps and amounts
5. **Given** a customer wants to split payment, **When** staff mark a partial payment, **Then** the remaining balance is calculated and displayed (cash change calculation is manual)

---

### Edge Cases

- What happens when a customer scans a QR code while another order for that table is still active and unpaid? (System should add to existing order or prompt staff to complete current order first)
- What happens when multiple customers at the same table scan the QR code simultaneously? (Both should access the same shared order session for that table)
- What happens when kitchen staff mark a dish as "Ready" but the customer has already left? (Order remains in Ready status; staff can manually mark as Completed or Cancelled)
- What happens when ingredient quantity goes negative due to concurrent orders? (System should prevent orders if stock check fails during submission)
- What happens when a customer adds an item to their order but the ingredient runs out before they submit? (Submission should fail with clear message about unavailable dish)
- What happens when staff attempt to remove items from an order that's already "In Kitchen" or later? (System should prevent the removal and display a message that modifications are only allowed for Pending orders; only additions are permitted after kitchen begins preparation)
- What happens when network connectivity is lost while a customer is ordering? (Order should queue locally and retry submission when connection is restored, or show error message if submission fails)
- What happens when a table QR code is damaged or unreadable? (Staff can manually create an order for that table using staff interface)

## Requirements _(mandatory)_

### Functional Requirements

**Ordering and Menu**

- **FR-001**: System MUST display a complete menu with dish name, description, price, and photo for each item
- **FR-001a**: System MUST allow managers to add new dishes with name, description, price, and photo
- **FR-001b**: System MUST allow managers to edit existing dish details (name, description, price, photo)
- **FR-001c**: System MUST allow managers to disable dishes (making them unavailable for ordering while preserving order history)
- **FR-002**: System MUST allow customers to select dishes, specify quantities, and add items to their order via QR code interface
- **FR-003**: System MUST allow staff members to create orders manually by selecting a table number and choosing dishes from the menu
- **FR-004**: System MUST support adding new items to an existing active order for a table
- **FR-005**: System MUST prevent ordering dishes when required ingredients are out of stock or below minimum quantity
- **FR-006**: System MUST generate a unique QR code for each table that links to that table's ordering session

**Inventory Management**

- **FR-007**: System MUST track ingredient quantities and units of measure for all menu items
- **FR-008**: System MUST define recipes that specify which ingredients and quantities are required for each dish
- **FR-009**: System MUST automatically reduce ingredient stock when an order is submitted based on recipe requirements
- **FR-010**: System MUST allow managers to manually adjust ingredient quantities (add stock, correct errors)
- **FR-011**: System MUST support configurable low-stock thresholds for each ingredient
- **FR-012**: System MUST display visual alerts when ingredient quantities fall below their threshold
- **FR-013**: System MUST prevent ingredient quantities from going negative by blocking orders when stock is insufficient

**Order Lifecycle**

- **FR-014**: System MUST assign each order one of the following statuses: "Pending", "In Kitchen", "Ready to Serve", "Served", "Completed", "Paid"
- **FR-015**: System MUST allow authorized staff to change order status at any time
- **FR-016**: System MUST record timestamps for each status change in order history
- **FR-016a**: System MUST allow items to be removed from an order only while status is "Pending" (before kitchen preparation begins)
- **FR-016b**: System MUST allow items to be added to an order at any stage before "Paid" status
- **FR-016c**: System MUST refund ingredient quantities to inventory when items are removed from a Pending order
- **FR-017**: System MUST send real-time notifications to kitchen dashboard when a new order is submitted or items are added using WebSocket or Server-Sent Events for instant push delivery
- **FR-018**: System MUST send real-time notifications to serving staff when an order is marked "Ready to Serve" using WebSocket or Server-Sent Events for instant push delivery
- **FR-019**: System MUST group orders by table number in all dashboards

**Kitchen Management**

- **FR-020**: System MUST display all active orders on the kitchen dashboard, grouped by table
- **FR-021**: System MUST sort orders by submission time (oldest first) within each status category
- **FR-022**: System MUST allow kitchen staff to update order status from Pending → In Kitchen → Ready to Serve
- **FR-023**: System MUST display dish names, quantities, special instructions, and table numbers for each order
- **FR-024**: System MUST visually distinguish between different order statuses (Pending, In Kitchen, Ready)

**Serving and Payment**

- **FR-025**: System MUST display a dashboard for serving staff showing orders that are "Ready to Serve" or "Served"
- **FR-026**: System MUST allow serving staff to mark orders as "Served" when food is delivered to the table
- **FR-027**: System MUST calculate and display the total amount due for each order
- **FR-028**: System MUST allow staff to mark an order as "Paid" when cash payment is received
- **FR-029**: System MUST clear the table session when an order is marked "Paid", allowing the table QR code to start a fresh order
- **FR-030**: System MUST maintain payment history with order details, timestamps, and amounts

**User Roles and Access**

- **FR-031**: System MUST support three staff roles: Manager, Kitchen Staff, and Waiter
- **FR-032**: Managers MUST have access to all dashboards (inventory, orders, kitchen, serving, payment history)
- **FR-033**: Kitchen Staff MUST have access only to the kitchen dashboard
- **FR-034**: Waiters MUST have access to order creation, serving dashboard, and payment processing
- **FR-035**: Customers MUST NOT require accounts or authentication; they interact solely via table QR codes
- **FR-036**: Staff MUST authenticate using username and password with role-based access control

### Key Entities

- **Table**: Represents a physical table in the restaurant; has a unique table number (1-30) and associated QR code; configured during system setup with total count of 25-30 tables
- **Ingredient**: Represents a raw material or food item tracked in inventory; has name, current quantity, unit of measure, and low-stock threshold
- **Dish**: Represents a menu item that customers can order; has name, description, price, photo, availability status (active/disabled), and timestamps for creation and last modification
- **Recipe**: Defines the relationship between dishes and ingredients; specifies which ingredients and quantities are needed to prepare each dish
- **Order**: Represents a customer's order for a specific table; contains ordered dishes, quantities, current status, timestamps, and total price
- **OrderItem**: Represents a single dish within an order; includes dish reference, quantity, and any special instructions
- **User**: Represents staff members with roles (Manager, Kitchen Staff, Waiter); used for authentication and access control
- **Payment**: Represents a completed cash transaction; linked to an order with payment timestamp and amount

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Customers can scan a QR code, browse the menu, and place an order within 3 minutes
- **SC-002**: Kitchen staff can view and update order statuses for 10 concurrent orders without performance degradation
- **SC-003**: 95% of orders progress from Pending to Served status without manual intervention or errors
- **SC-004**: Ingredient stock levels update within 2 seconds of order submission
- **SC-005**: Kitchen staff receive real-time notifications for new orders within 5 seconds of submission
- **SC-006**: Serving staff can complete the payment process (view total, mark as paid, reset table) in under 1 minute
- **SC-007**: System supports at least 20 simultaneous table sessions (customers ordering concurrently) across a restaurant with 25-30 tables
- **SC-008**: Inventory alerts appear immediately when stock falls below threshold
- **SC-009**: 90% of customers successfully place orders on their first attempt without requiring staff assistance
- **SC-010**: Zero orders are fulfilled when required ingredients are out of stock (100% stock validation)

## Assumptions

- All staff members have devices (tablets, phones, or computers) to access their respective dashboards
- Each table has a printed QR code that is readable by standard smartphone cameras
- Restaurant has reliable internet connectivity for real-time notifications and order syncing
- Restaurant operates with a fixed set of 25-30 tables (table numbers are predefined and configured during system setup)
- Dishes have consistent recipes; ingredient quantities per dish do not vary dynamically
- Low-stock thresholds are set manually by managers based on expected usage and restock frequency
- Payment amounts are rounded to standard currency denominations (e.g., dollars and cents)
- Staff members are trained on basic system usage (navigating dashboards, updating statuses)
- Restaurant has a single location (no multi-location support required for MVP)
- Menu changes (adding, editing, or disabling dishes and updating prices) are handled by managers through the system and typically occur outside of peak hours

## Out of Scope (for MVP)

- Online payments, credit card processing, or digital wallets
- Customer accounts, loyalty programs, or order history for customers
- Reservations or table booking functionality
- Multi-language support for menus or interfaces
- Detailed analytics, reports, or business intelligence dashboards
- Integration with third-party delivery services (Uber Eats, DoorDash, etc.)
- Automated inventory reordering or supplier integration
- Recipe costing or profit margin calculations
- Employee scheduling or time tracking
- Customer feedback or rating systems
- Discount codes, promotions, or dynamic pricing
- Kitchen display screens with order timers or priority queues
- Voice ordering or accessibility features beyond standard mobile browser support
