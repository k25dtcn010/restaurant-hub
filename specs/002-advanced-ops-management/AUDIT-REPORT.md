# Implementation Plan Audit Report

**Date**: 2025-10-18  
**Feature**: 002-advanced-ops-management  
**Auditor**: GitHub Copilot  
**Status**: 🟡 NEEDS IMPROVEMENT

---

## Executive Summary

The implementation plan is **well-structured** with clear phases, dependencies, and user stories. However, there are **critical gaps in task sequencing and cross-references** that could lead to confusion during implementation. The plan would benefit from:

1. ✅ **Strengths**: Clear phase separation, parallel task identification, comprehensive coverage
2. ⚠️ **Weaknesses**: Missing cross-references to implementation details, incomplete TDD guidance, vague "extend" tasks
3. 🎯 **Priority Fix**: Add explicit references to contracts, data-model, and quickstart in each task

---

## Detailed Findings

### 1. Cross-Reference Gaps 🔴 CRITICAL

**Problem**: Tasks reference files to modify but don't point to WHERE to find the implementation details.

**Example from Phase 3 (US1 - Modifiers)**:

```markdown
❌ CURRENT (T021):

- [ ] T021 [P] [US1] Implement modifiers.list procedure in packages/api/src/routers/modifiers.ts with Zod input schema (availableOnly: boolean) and output schema

✅ SHOULD BE:

- [ ] T021 [P] [US1] Implement modifiers.list procedure in packages/api/src/routers/modifiers.ts
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.list" for full Zod schemas
  - **Test First**: Write integration test in `packages/api/tests/integration/modifiers.test.ts` (Red phase)
  - **Logic**: Query `modifiers` table with `WHERE isAvailable = true` filter when `availableOnly = true`
  - **Validation**: Should return array of modifier objects ordered by `id ASC`
```

**Impact**: Developers must hunt through multiple files to understand what to implement.

**Recommendation**: Add subsections to EVERY backend task with:

- `Contract`: Link to specific section in contracts/\*.md
- `Test First`: Where to write the test (TDD requirement)
- `Data Model`: Link to relevant table in data-model.md (if applicable)
- `Logic`: Brief implementation hint

---

### 2. Vague "Extend" Tasks 🟡 MEDIUM

**Problem**: Tasks like "Extend dishes.ts" don't specify WHAT to add or HOW to integrate.

**Examples**:

```markdown
❌ T007: Extend packages/db/src/schema/dishes.ts with columns: isHidden, isRecommended, isChefSpecial, orderPriority

✅ SHOULD SPECIFY:

- [ ] T007 Extend dishes schema in packages/db/src/schema/dishes.ts
  - **Add Columns**:
    - `isHidden: boolean().notNull().default(false)` - Soft delete flag
    - `isRecommended: boolean().notNull().default(false)` - Show thumbs-up badge in menu
    - `isChefSpecial: boolean().notNull().default(false)` - Show star badge in menu
    - `orderPriority: integer().notNull().default(0)` - Kitchen sorting (higher = cook first)
  - **Data Model Reference**: See `data-model.md` § 4.1 "Dish Extensions"
  - **Migration**: After adding, run `bun run db:generate` to create migration
```

**Impact**: Ambiguity about exact field definitions, defaults, and constraints.

**Recommendation**: Expand all "extend" tasks with explicit field definitions from data-model.md.

---

### 3. Missing TDD Workflow Details 🟡 MEDIUM

**Problem**: Constitution requires TDD, but tasks don't explicitly include test creation steps.

**Example from Phase 3**:

````markdown
❌ CURRENT:

- [ ] T021 [P] [US1] Implement modifiers.list procedure

✅ SHOULD INCLUDE TDD CYCLE:

- [ ] T021-RED [US1] Write FAILING test for modifiers.list procedure
  - **File**: packages/api/tests/integration/modifiers.test.ts
  - **Test Case**:
    ```typescript
    test("modifiers.list with availableOnly=true returns only available modifiers", async () => {
      // Arrange: Seed 5 modifiers (3 available, 2 unavailable)
      // Act: Call modifiers.list({ availableOnly: true })
      // Assert: Expect 3 modifiers returned, all with isAvailable=true
    })
    ```
  - **Expected**: Test should FAIL (procedure not implemented yet)

- [ ] T021-GREEN [US1] Implement modifiers.list to pass test
  - **File**: packages/api/src/routers/modifiers.ts
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.list"
  - **Implementation**: Query with Drizzle ORM, filter by isAvailable if requested
  - **Expected**: Test should PASS

- [ ] T021-REFACTOR [US1] Optimize modifiers.list query and add caching if needed
  - **Review**: Code quality, naming conventions, error handling
  - **Expected**: Tests still PASS
````

**Impact**: Developers may implement without tests (violates constitution).

**Recommendation**: Split each backend procedure task into RED-GREEN-REFACTOR subtasks.

---

### 4. Frontend Component Tasks Lack Design References 🟡 MEDIUM

**Problem**: Frontend tasks don't reference quickstart.md for UI/UX expectations.

**Example from Phase 3**:

```markdown
❌ CURRENT (T035):

- [ ] T035 [P] [US1] Create modifier management UI component apps/web/src/components/modifier-manager.tsx with list, create, edit, delete forms

✅ SHOULD REFERENCE:

- [ ] T035 [P] [US1] Create modifier management UI component apps/web/src/components/modifier-manager.tsx
  - **UI Reference**: See `quickstart.md` § A "Manager: Create Modifiers" for expected workflow
  - **Features**:
    - List view with columns: Name, Price Adjustment, Available Status, Actions
    - Create form: Name input, Price adjustment number input (+/- cents), Available toggle
    - Edit modal: Same fields as create, pre-populated with current values
    - Delete button: Confirm dialog with warning if modifier assigned to dishes
  - **Dependencies**: Uses shadcn/ui components (Table, Dialog, Form, Input, Switch)
  - **tRPC Calls**: modifiers.list, modifiers.create, modifiers.update, modifiers.delete
  - **Test**: User can create modifier, see it in list, edit name/price, toggle availability
```

**Impact**: UI may not match expected user workflows from spec.

**Recommendation**: Add UI Reference subsection to frontend tasks pointing to quickstart.md sections.

---

### 5. Dependency Sequencing Within User Stories 🟢 MINOR

**Problem**: Some tasks within a phase have implicit dependencies not called out.

**Example from Phase 3 (US1)**:

```markdown
❌ CURRENT ORDER:
T029: Implement modifiers.assignToDish procedure
T030: Implement modifiers.getByDish procedure
T031: Update orders.createOrder to accept modifiers

✅ CLEARER:
T029: Implement modifiers.assignToDish (PREREQUISITE for T038 - dish editor needs this)
T030: Implement modifiers.getByDish (PREREQUISITE for T039 - modifier selector needs this)
T031: Update orders.createOrder (DEPENDS ON T030 - must fetch modifiers first)
```

**Impact**: Developers may implement T031 before T030, causing integration issues.

**Recommendation**: Add inline dependency notes: "(DEPENDS ON: T030)" or "(BLOCKS: T038)".

---

### 6. Missing Validation/Checkpoint Tasks 🟡 MEDIUM

**Problem**: No explicit "validate integration" tasks between backend and frontend.

**Current Checkpoints**:

```markdown
✅ "Checkpoint": At this point, User Story 1 should be fully functional
```

**Should Add**:

```markdown
✅ "Checkpoint" + Validation Tasks:

- [ ] T045.1 [US1] Integration Test: End-to-end modifier workflow
  - Test: Manager creates modifier → assigns to dish → customer selects modifier → kitchen sees modifier
  - **Reference**: `quickstart.md` § A full walkthrough
  - **Success Criteria**: All 4 actors (manager, customer, kitchen, payment) see correct modifier data

- [ ] T045.2 [US1] Performance Test: Load 200 modifiers in modifier selector
  - **Benchmark**: Selector should render in < 200ms (per constitution)
  - **Fix if Slow**: Add pagination or virtualization

- [ ] T045.3 [US1] Type Safety Check: Run `bun run check-types` for modifiers router
  - **Expected**: Zero TypeScript errors in packages/api/src/routers/modifiers.ts
```

**Impact**: No clear validation that user story works end-to-end before moving to next story.

**Recommendation**: Add ".1, .2, .3" sub-tasks for each checkpoint with explicit validation criteria.

---

## Specific Recommendations by Phase

### Phase 1: Setup (T001-T013)

**Status**: 🟢 GOOD - Clear, actionable tasks

**Improvements**:

- T002-T006: Add note "See `data-model.md` for exact column definitions"
- T011: Add expected output: "Migration file should be named `0002_advanced_ops.sql`"
- T013: Add note "See `quickstart.md` § Setup for sample data requirements"

### Phase 2: Foundational (T014-T020)

**Status**: 🟡 NEEDS DETAIL

**Critical Issue**: Tasks say "empty procedures" but don't specify procedure signatures.

**Fix T014**:

```markdown
- [ ] T014 [P] Create tRPC router skeleton packages/api/src/routers/modifiers.ts
  - **Procedures to Add** (empty implementations, just return TODO error):
    - `list: publicProcedure.input(z.object({...})).query(...)` - See contracts/modifiers-router.md § list
    - `create: protectedProcedure.input(z.object({...})).mutation(...)` - See contracts/modifiers-router.md § create
    - `update, delete, listGroups, createGroup, updateGroup, deleteGroup, assignToDish, getByDish` - See contracts/modifiers-router.md
  - **Export**: Add `modifiers: modifiersRouter` to packages/api/src/index.ts appRouter
  - **Test**: Run `bun run dev` and verify tRPC panel shows new modifiers router
```

### Phase 3-8: User Stories (T021-T132)

**Status**: 🟡 NEEDS CROSS-REFERENCES

**Apply Template to ALL Tasks**:

```markdown
- [ ] T### [P?] [Story] Task Title
  - **Purpose**: One-sentence what and why
  - **File**: Exact file path to modify
  - **References**:
    - Contract: `contracts/###-router.md` § Procedure Name (for backend tasks)
    - Data Model: `data-model.md` § Table Name (for schema tasks)
    - Quickstart: `quickstart.md` § Section Name (for validation)
  - **TDD Cycle** (backend only):
    - RED: Write failing test in `packages/api/tests/...`
    - GREEN: Implement to pass test
    - REFACTOR: Clean up while keeping tests green
  - **Implementation Notes**:
    - Key logic points (e.g., "Filter WHERE isAvailable=true")
    - Edge cases (e.g., "Return error if modifier assigned to dishes")
  - **Dependencies**: DEPENDS ON: [T###], BLOCKS: [T###]
  - **Validation**: How to manually test this works (1 sentence)
```

### Phase 9: Polish (T133-T143)

**Status**: 🟢 GOOD - Clear final tasks

**Improvements**:

- T138: Change from "Run full quickstart.md walkthrough" to checklist of specific scenarios
- T142: Add requirement to update feature list in copilot-instructions.md

---

## Prioritized Action Items

### 🔴 MUST FIX (Before Starting Implementation)

1. **Add Cross-References to All Backend Tasks (T021-T132)**
   - Every task touching `packages/api/src/routers/*.ts` must reference `contracts/*.md`
   - Every task touching `packages/db/src/schema/*.ts` must reference `data-model.md`
   - Format: "**Contract**: See `contracts/modifiers-router.md` § modifiers.list"

2. **Expand "Extend" Tasks (T007-T009, T019-T020)**
   - Specify exact column names, types, defaults, constraints from data-model.md
   - Add "After" step: Run migration generation command

3. **Add TDD Subtasks for Backend Procedures**
   - Split T021-T132 (backend tasks) into RED-GREEN-REFACTOR subtasks
   - Format: T021-RED, T021-GREEN, T021-REFACTOR

### 🟡 SHOULD FIX (For Developer Clarity)

4. **Add UI/UX References to Frontend Tasks**
   - Every task touching `apps/web/src/components/*.tsx` should reference `quickstart.md`
   - Show expected user workflow for that component

5. **Add Dependency Annotations**
   - Inline notes like "(DEPENDS ON: T030)" for tasks with implicit ordering
   - Mark blocking relationships: "(BLOCKS: T038)"

6. **Add Validation Sub-Tasks to Checkpoints**
   - After each user story, add .1, .2, .3 tasks for integration, performance, type-checking

### 🟢 NICE TO HAVE (Optional Quality Improvements)

7. **Add "Definition of Done" to Each Task**
   - E.g., "✅ Test passes, ✅ No TypeScript errors, ✅ Code reviewed"

8. **Create Implementation Examples**
   - Add 1-2 "reference implementation" tasks with full code snippets as templates

---

## Sample Improved Task Block

### ❌ BEFORE (Current State):

```markdown
### Implementation for User Story 1

**Backend: Modifier Management**

- [ ] T021 [P] [US1] Implement modifiers.list procedure in packages/api/src/routers/modifiers.ts with Zod input schema (availableOnly: boolean) and output schema
- [ ] T022 [P] [US1] Implement modifiers.create procedure in packages/api/src/routers/modifiers.ts with manager-only auth check and Zod validation
```

### ✅ AFTER (Improved with Cross-References):

````markdown
### Implementation for User Story 1

**Backend: Modifier Management**

#### T021: modifiers.list Procedure

**Test-Driven Implementation** (Constitution § I - TDD-First):

- [ ] T021-RED [P] [US1] Write FAILING test for modifiers.list
  - **File**: `packages/api/tests/routers/modifiers.test.ts`
  - **Test Case**:
    ```typescript
    describe("modifiers.list", () => {
      test("returns only available modifiers when availableOnly=true", async () => {
        // Arrange: Seed 5 modifiers (3 available, 2 unavailable)
        await db.insert(modifiers).values([
          { name: "Extra Cheese", priceAdjustment: 200, isAvailable: true },
          { name: "Bacon", priceAdjustment: 150, isAvailable: true },
          { name: "Avocado", priceAdjustment: 100, isAvailable: true },
          { name: "Olives", priceAdjustment: 50, isAvailable: false },
          { name: "Mushrooms", priceAdjustment: 75, isAvailable: false },
        ])
        // Act
        const result = await caller.modifiers.list({ availableOnly: true })
        // Assert
        expect(result).toHaveLength(3)
        expect(result.every((m) => m.isAvailable)).toBe(true)
      })
    })
    ```
  - **Expected**: Test FAILS (procedure not implemented)

- [ ] T021-GREEN [US1] Implement modifiers.list to pass test
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.list" for full input/output schemas
  - **Data Model**: Query `modifiers` table (see `data-model.md` § 1.1)
  - **Implementation**:
    ```typescript
    list: publicProcedure
      .input(z.object({ availableOnly: z.boolean().optional().default(false) }))
      .query(async ({ input }) => {
        const { availableOnly } = input;
        return await db.query.modifiers.findMany({
          where: availableOnly ? eq(modifiers.isAvailable, true) : undefined,
          orderBy: [asc(modifiers.id)],
        });
      }),
    ```
  - **Expected**: Test PASSES

- [ ] T021-REFACTOR [US1] Review and optimize modifiers.list
  - **Quality Checks**:
    - ✅ No TypeScript errors (`bun run check-types`)
    - ✅ No linting errors (`bun run lint`)
    - ✅ Performance < 200ms for 1000 modifiers (benchmark if needed)
  - **Expected**: Tests still PASS

#### T022: modifiers.create Procedure

- [ ] T022-RED [P] [US1] Write FAILING test for modifiers.create
  - **File**: `packages/api/tests/routers/modifiers.test.ts`
  - **Test Cases**:
    1. Manager can create modifier
    2. Non-manager gets UNAUTHORIZED error
    3. Duplicate name returns BAD_REQUEST
  - **Contract**: See `contracts/modifiers-router.md` § "modifiers.create"

- [ ] T022-GREEN [US1] Implement modifiers.create with auth
  - **File**: `packages/api/src/routers/modifiers.ts`
  - **Auth**: Use `protectedProcedure` with role check (see Better-Auth context)
  - **Validation**: Zod schema ensures name.length <= 100, priceAdjustment is integer
  - **Error Handling**: Catch unique constraint violation, return BAD_REQUEST

- [ ] T022-REFACTOR [US1] Review modifiers.create error messages
  - **UX**: Ensure error messages are user-friendly (per Constitution § III)
````

---

## Conclusion

**Overall Assessment**: The implementation plan has **strong structure** but **weak execution details**. The phases, dependencies, and user story organization are excellent. However, tasks lack the cross-references and step-by-step guidance needed for efficient implementation.

**Effort to Fix**: ~4-6 hours to add cross-references, TDD subtasks, and validation tasks to all 143 tasks.

**ROI**: HIGH - This upfront effort will save 10-20 hours of developer confusion, file hunting, and rework during implementation.

**Next Steps**:

1. Accept this audit report
2. Create `tasks-v2.md` with improved task format
3. Use improved format as template for future features
4. Update `.specify/templates/tasks-template.md` to include cross-reference requirements

---

**Audit Completed**: 2025-10-18  
**Recommendation**: 🟡 REVISE BEFORE IMPLEMENTATION
