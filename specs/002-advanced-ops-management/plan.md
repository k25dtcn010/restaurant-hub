# Implementation Plan: Advanced Operations Management

**Branch**: `002-advanced-ops-management` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-advanced-ops-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature extends the RestaurantHub MVP with advanced menu management (modifiers, categories, variants, flags), table reservations, and shift/session management. The implementation will add new database entities for modifiers, categories, variants, reservations, shifts, and operating hours while maintaining full type safety through Drizzle ORM schemas, tRPC procedures with Zod validation, and React UI components. The approach follows the Better-T-Stack pattern: database schema → API contracts → UI components, with TDD-first implementation for all business logic.

## Technical Context

**Language/Version**: TypeScript 5.8+ with strict mode enabled  
**Primary Dependencies**: Bun 1.3.0, Hono 4.8+, tRPC 11.5+, Drizzle ORM, Better-Auth 1.3+, React 18, TanStack Router  
**Storage**: SQLite/Turso with Drizzle ORM migrations  
**Testing**: Bun test runner, tRPC testing utilities, React Testing Library  
**Target Platform**: Web (Linux server via Bun runtime, modern browsers for client)  
**Project Type**: Web monorepo (apps/server + apps/web + shared packages)  
**Performance Goals**: API p95 < 200ms, UI TTI < 3s on 3G, bundle < 500KB gzipped  
**Constraints**: Type-safe end-to-end (DB → API → UI), TDD-first, 80% test coverage  
**Scale/Scope**: Single restaurant, 50+ tables, 100+ dishes, 200+ modifiers, 50 reservations/day

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Test-Driven Development (TDD-First)

- ✅ **PASS** - All business logic (modifiers, categories, variants, reservations, shifts) will follow Red-Green-Refactor cycle
- ✅ **PASS** - Database schema changes will have corresponding migration tests
- ✅ **PASS** - tRPC procedures will have integration tests before implementation
- ✅ **PASS** - UI components will have React Testing Library tests for user interactions

### II. Code Quality Standards

- ✅ **PASS** - TypeScript strict mode already enabled in tsconfig.json
- ✅ **PASS** - All new schemas will use Drizzle ORM with full type inference
- ✅ **PASS** - 80% test coverage target for new routers and business logic
- ✅ **PASS** - No complexity violations expected; business logic remains straightforward CRUD with validation

### III. User Experience Consistency

- ✅ **PASS** - All new UI components will use existing shadcn/ui library (forms, tables, dialogs, badges)
- ✅ **PASS** - Dark/light mode support via existing ThemeProvider
- ✅ **PASS** - Loading states via existing Loader component patterns
- ✅ **PASS** - Form validation via Zod schemas with inline error display
- ✅ **PASS** - TanStack Router for all new routes (menu-management, reservations, shifts)

### IV. Performance Requirements

- ✅ **PASS** - Database indexes on foreign keys (dish_id, modifier_id, reservation date/time)
- ✅ **PASS** - tRPC batching for loading modifiers + categories + variants for menu display
- ✅ **PASS** - Optimistic updates for hiding/showing menu items
- ✅ **PASS** - WebSocket notifications for reservation confirmations (reuse existing pattern from kitchen orders)

### V. Type Safety & Reliability

- ✅ **PASS** - All schemas defined in Drizzle with exported TypeScript types
- ✅ **PASS** - All new tRPC procedures with Zod input/output schemas
- ✅ **PASS** - No `any` types; all entity relationships properly typed through Drizzle relations
- ✅ **PASS** - Better-Auth context for role-based access (Manager-only for menu management, Staff for reservations)

**Gate Status**: ✅ ALL GATES PASSED - No constitutional violations. Proceed to Phase 0.

---

### Post-Design Re-Evaluation (After Phase 1)

**Re-checked**: 2025-10-18

All constitutional requirements validated against completed design artifacts:

- ✅ **data-model.md**: 11 new tables + 3 extended tables, all with Drizzle ORM schemas and full type safety
- ✅ **contracts/**: 4 new tRPC routers with comprehensive Zod input/output schemas
- ✅ **quickstart.md**: Clear testing checklist covering all user stories with TDD approach
- ✅ **research.md**: Technical decisions documented with performance optimizations (indexes, batching)

**No new violations introduced during design phase.** Ready for Phase 2: Task Breakdown (via `/speckit.tasks` command).

## Project Structure

### Documentation (this feature)

```
specs/002-advanced-ops-management/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── modifiers-router.md
│   ├── categories-router.md
│   ├── reservations-router.md
│   └── shifts-router.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web monorepo structure (Better-T-Stack)
apps/
├── server/
│   └── src/
│       ├── index.ts                    # Main server entry point
│       ├── websocket.ts                # WebSocket server (existing, extend for reservations)
│       └── rate-limit.ts               # Rate limiting (existing)
├── web/
│   └── src/
│       ├── components/
│       │   ├── modifier-selector.tsx   # NEW: Select modifiers for dish
│       │   ├── category-manager.tsx    # NEW: Manage menu categories
│       │   ├── variant-editor.tsx      # NEW: Define dish variants
│       │   ├── reservation-form.tsx    # NEW: Public reservation form
│       │   ├── reservations-board.tsx  # NEW: Staff reservations dashboard
│       │   ├── shift-control.tsx       # NEW: Start/end shift controls
│       │   └── dish-editor.tsx         # EXTEND: Add modifiers, categories, variants
│       ├── routes/
│       │   ├── menu-management.tsx     # EXTEND: Add category & modifier management
│       │   ├── reservations.tsx        # NEW: Reservations management page
│       │   └── shifts.tsx              # NEW: Shift management page
│       └── utils/
│           └── trpc.ts                 # tRPC client config (existing)

packages/
├── api/
│   └── src/
│       └── routers/
│           ├── modifiers.ts            # NEW: Modifier CRUD + availability
│           ├── categories.ts           # NEW: Category CRUD + ordering
│           ├── reservations.ts         # NEW: Reservation lifecycle
│           ├── shifts.ts               # NEW: Shift management
│           ├── dishes.ts               # EXTEND: Add variants, flags, hiding
│           └── orders.ts               # EXTEND: Handle modifiers in order items
├── db/
│   └── src/
│       ├── schema/
│       │   ├── modifiers.ts            # NEW: modifiers, modifierGroups tables
│       │   ├── categories.ts           # NEW: categories, dishCategories tables
│       │   ├── variants.ts             # NEW: dishVariants table
│       │   ├── reservations.ts         # NEW: reservations, operatingHours tables
│       │   ├── shifts.ts               # NEW: shifts, shiftStaff tables
│       │   ├── dishes.ts               # EXTEND: Add isHidden, orderPriority, isRecommended, isChefSpecial
│       │   └── order-items.ts          # EXTEND: Add specialRequest, orderItemModifiers join table
│       └── migrations/
│           └── 0002_advanced_ops.sql   # Migration for all new tables + columns
└── auth/
    └── src/
        └── index.ts                    # Better-Auth config (existing, no changes)

tests/
├── integration/
│   ├── modifiers.test.ts               # NEW: Modifier workflows
│   ├── categories.test.ts              # NEW: Category workflows
│   ├── reservations.test.ts            # NEW: Reservation lifecycle tests
│   └── shifts.test.ts                  # NEW: Shift management tests
└── unit/
    ├── modifier-validation.test.ts     # NEW: Modifier group constraints
    └── reservation-validation.test.ts  # NEW: Date/time validation
```

**Structure Decision**: Web monorepo structure selected. This feature extends the existing Better-T-Stack architecture without introducing new apps or packages. All new functionality fits cleanly into existing workspace structure: database schema in `packages/db`, API routers in `packages/api`, UI components in `apps/web`. No new packages required.

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

**No violations detected.** All requirements align with constitutional principles. The feature adds new entities and workflows but maintains the established Better-T-Stack patterns (Drizzle ORM → tRPC → React) without introducing architectural complexity.
