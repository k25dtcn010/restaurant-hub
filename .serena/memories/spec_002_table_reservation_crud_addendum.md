# Spec 002 - Table and Reservation CRUD Management Addendum

## Summary
Added comprehensive CRUD operations for managing table reservations in the Advanced Operations Management feature (Spec 002). This implements complete reservation lifecycle management with table availability checking.

## Specification Added
- Created: `specs/002-advanced-ops-management/addendum/table-and-reservation-crud.md`
- Comprehensive specification with 560 lines documenting all new CRUD operations
- Includes validation rules, error handling, WebSocket events, and testing checklist

## Implementation Completed

### New Procedures (5 new tRPC procedures)

#### T103: `reservations.getById` (Query, Public)
- Get a single reservation by ID
- Returns full reservation details with parsed table assignments
- Error: NOT_FOUND if reservation doesn't exist

#### T104: `reservations.checkAvailability` (Query, Public)
- Check table availability for a given date/time/party size
- Returns:
  - Available tables with capacity >= party size
  - Table combinations (2-table pairs) if no single table fits
  - Suggested alternative times (±30, ±60 min) if not available
- Used for both availability checking and booking recommendations
- Considers 90-minute reservation duration for conflict detection

#### T105: `reservations.update` (Mutation, Staff/Manager)
- Update pending reservation details (date, time, party size, customer info, notes)
- Can only update reservations with "Pending" status
- Validates new date/time within operating hours
- Updates only provided fields, preserves others

#### T106: `reservations.delete` (Mutation, Staff/Manager)
- Delete pending reservations (hard delete)
- Can only delete reservations with "Pending" status
- Confirmed/Seated/Cancelled reservations cannot be deleted
- Returns deletion confirmation with timestamp

#### T107: `reservations.reassignTables` (Mutation, Staff/Manager)
- Reassign tables for a confirmed reservation
- Validates new tables don't conflict with other reservations at overlapping times
- Returns error CONFLICT if tables are double-booked
- Useful for changing table assignments after confirmation

### Helper Functions (3 new utility functions)

#### getReservationEndTime
- Calculates reservation end time from start time
- Default duration: 90 minutes
- Used for overlap detection

#### timeRangesOverlap
- Checks if two time ranges overlap
- Used to detect table conflicts between reservations
- Handles proper boundary comparisons

#### isWithinOperatingHours (already existed, now used by new procedures)
- Validates if a date/time falls within configured operating hours
- Checks if day is closed (holidays)
- Returns validation status with reason for failures

### Database Queries Enhanced
- All procedures use Drizzle ORM with proper type safety
- Efficient conflict detection using existing reservation queries
- Table availability filtering by capacity constraints
- Time overlap calculations for 90-minute reservation durations

## Key Features

### Table Availability Logic
- Checks confirmed/seated reservations for date ± 90 minutes
- Filters available tables by party size capacity
- Suggests table combinations (2-table pairs) for larger groups
- Provides alternative time slots if no availability

### Reservation Lifecycle Management
- Pending reservations can be updated or deleted
- Confirmed reservations can have tables reassigned
- All operations preserve referential integrity
- Status transitions validated (Pending → update/delete only)

### Error Handling
- Comprehensive Zod input validation
- Business logic validation (dates, times, status transitions)
- Conflict detection for table bookings
- Clear error messages for API consumers

## Testing Coverage

All new procedures should be tested for:
- Happy path scenarios (valid inputs)
- Error cases (invalid dates, times, status mismatches)
- Conflict detection (double-booking prevention)
- Table combination suggestions
- Alternative time recommendations
- Authorization checks (staff/manager only where required)

## Files Modified

1. **apps/server/src/api/routers/reservations.ts**
   - Added import for `tables` schema
   - Added 3 helper functions
   - Added 5 new tRPC procedures (T103-T107)
   - Updated router documentation

2. **specs/002-advanced-ops-management/addendum/table-and-reservation-crud.md** (NEW)
   - Complete CRUD specification for reservations
   - Detailed procedure documentation with input/output schemas
   - Validation rules and error codes
   - Testing checklist

## Related Procedures (Already Implemented)
- `reservations.create` - Create new reservation (public)
- `reservations.list` - List reservations with filters (staff/manager)
- `reservations.confirm` - Confirm pending reservation (staff/manager)
- `reservations.decline` - Decline pending reservation (staff/manager)
- `reservations.markSeated` - Mark confirmed as seated (staff/manager)
- `reservations.markNoShow` - Mark confirmed as no-show (staff/manager)
- `reservations.cancel` - Cancel reservation (public)
- `reservations.suggestAlternativeTimes` - Get alternative time slots (public)
- `reservations.getOperatingHours` - Get restaurant hours (public)
- `reservations.updateOperatingHours` - Update hours config (manager)

## Next Steps

1. **Testing**: Write comprehensive test suite for new procedures
2. **Frontend**: Implement UI components for:
   - Reservation details view
   - Availability checking
   - Reservation update form
   - Table reassignment interface
3. **Integration**: Link reservations with order creation when seating
4. **WebSocket**: Broadcast reservation updates to staff dashboard
5. **Documentation**: Update API docs with new procedures

## Status
✅ Specification complete
✅ Backend implementation complete
⏳ Testing pending
⏳ Frontend pending
⏳ Integration testing pending
