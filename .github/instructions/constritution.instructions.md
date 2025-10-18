---
applyTo: "**"
---

<!--
═══════════════════════════════════════════════════════════════════════════════
SYNC IMPACT REPORT - Constitution Update
═══════════════════════════════════════════════════════════════════════════════
Version Change: 0.0.0 → 1.0.0
Bump Rationale: Initial release establishing foundational governance and principles

Sections Added:
  - I. Test-Driven Development (TDD-First)
  - II. Code Quality Standards
  - III. User Experience Consistency
  - IV. Performance Requirements
  - V. Type Safety & Reliability
  - Technical Standards section
  - Development Workflow section

Templates Status:
  ✅ .specify/templates/plan-template.md - Compatible (Constitution Check section aligns)
  ✅ .specify/templates/spec-template.md - Compatible (Requirements section aligns)
  ✅ .specify/templates/tasks-template.md - Compatible (Test-first phases align with TDD)
  ⚠ .github/prompts/*.md - Review recommended for TDD workflow enforcement

Follow-up TODOs:
  - None - all placeholders resolved

═══════════════════════════════════════════════════════════════════════════════
-->

# Learn-BetterT Constitution

## Core Principles

### I. Test-Driven Development (TDD-First) — NON-NEGOTIABLE

**Red-Green-Refactor Cycle MUST be strictly enforced:**

- Tests MUST be written BEFORE implementation code
- Tests MUST fail initially (Red phase)
- Implementation MUST make tests pass (Green phase)
- Code MUST be refactored for quality while keeping tests green (Refactor phase)
- No feature development begins without corresponding test cases
- Tests MUST be independently executable and not depend on execution order

**Rationale**: TDD ensures code correctness, prevents regressions, documents intended behavior, and enables confident refactoring. The Better-T-Stack architecture demands reliable type-safe interactions between client and server layers, which TDD validates continuously.

### II. Code Quality Standards

**Quality gates that MUST be satisfied:**

- TypeScript strict mode MUST be enabled (`"strict": true` in tsconfig.json)
- Zero TypeScript compilation errors tolerated in production code
- Linting (ESLint) and formatting (Prettier) MUST pass without warnings
- Code coverage MUST be tracked with minimum 80% coverage for business logic
- Code MUST follow project conventions for monorepo packages and workspace structure
- Cyclomatic complexity MUST remain below 10 per function; exceptions require documented justification
- Dependencies MUST be managed through workspace catalog in root package.json

**Rationale**: The Better-T-Stack leverages TypeScript's type system for end-to-end safety. Quality standards ensure this safety is maintained across the monorepo, from database schema (Drizzle) through API (tRPC) to UI (React + TanStack Router).

### III. User Experience Consistency

**UX principles that MUST guide all interface development:**

- UI components MUST use shadcn/ui library for consistency
- Theme switching (light/dark mode) MUST be supported across all interfaces
- Loading states MUST provide visual feedback (skeletons, spinners) within 200ms
- Error messages MUST be user-friendly, actionable, and never expose implementation details
- Forms MUST provide inline validation with clear error indicators
- Navigation MUST maintain type-safe routing through TanStack Router
- Responsive design MUST support mobile, tablet, and desktop viewports
- Authentication flows MUST be intuitive and consistent (Better-Auth patterns)

**Rationale**: Users interact with multiple surfaces (web app at port 3001, API responses, authentication flows). Consistency reduces cognitive load and builds trust. The Better-T-Stack's type-safe routing and component library enable enforcing these standards systematically.

### IV. Performance Requirements

**Performance thresholds that MUST be met:**

- API endpoint response time p95 MUST be under 200ms for standard operations
- Database queries MUST use indexed fields; full table scans require justification
- Bundle size for web app MUST remain under 500KB (initial gzip)
- Time to Interactive (TTI) MUST be under 3 seconds on 3G connections
- tRPC procedures MUST use batching for multiple related queries
- React component re-renders MUST be minimized through proper memoization
- Bun runtime optimizations MUST be leveraged (avoid Node.js-specific patterns)

**Rationale**: The Better-T-Stack is chosen for performance (Bun runtime, Hono server, Drizzle ORM). These benchmarks ensure architectural choices translate to measurable user experience improvements.

### V. Type Safety & Reliability

**Type safety requirements that MUST be enforced:**

- All API endpoints MUST define tRPC procedures with Zod schemas
- Database schema MUST be defined in Drizzle with exported TypeScript types
- No `any` types permitted without explicit `@ts-expect-error` with justification
- API contracts MUST be validated at runtime using Zod schemas
- Authentication state MUST be type-safe through Better-Auth types
- Router paths MUST be type-checked through TanStack Router's generated types
- Environment variables MUST be validated and typed (no process.env access without validation)

**Rationale**: The Better-T-Stack's primary value proposition is end-to-end type safety. From database → API → UI, types flow automatically. Breaking this chain negates the stack's core benefit and introduces runtime errors.

## Technical Standards

**Technology Stack Requirements:**

- **Runtime**: Bun 1.3.0+ MUST be used for all workspaces
- **Framework**: Hono 4.8+ for server, React 18+ with TanStack Router for web client
- **Database**: SQLite/Turso with Drizzle ORM MUST manage all persistence
- **API Layer**: tRPC 11.5+ MUST mediate all client-server communication
- **Authentication**: Better-Auth 1.3+ MUST handle all auth flows
- **UI Components**: shadcn/ui with Tailwind CSS MUST be used for all UI elements
- **Monorepo**: Bun workspaces MUST organize code into apps/ and packages/

**Workspace Organization:**

- `apps/web` - Frontend React application (port 3001)
- `apps/server` - Backend Hono + tRPC server (port 3000)
- `packages/api` - Shared tRPC router definitions and business logic
- `packages/auth` - Authentication configuration and utilities
- `packages/db` - Database schema, migrations, and query functions

**Security Standards:**

- Authentication tokens MUST use httpOnly cookies
- API endpoints MUST validate user permissions through Better-Auth context
- User input MUST be sanitized and validated server-side via Zod
- Secrets MUST be stored in .env files (never committed) and validated at startup
- CORS MUST be configured explicitly; no wildcard origins in production

## Development Workflow

**Pre-Implementation Phase:**

1. Feature specification MUST be created using `.specify/templates/spec-template.md`
2. Implementation plan MUST be generated using `.specify/templates/plan-template.md`
3. Constitution Check gate MUST pass before any code is written
4. User stories MUST be prioritized (P1, P2, P3...) and independently testable

**Implementation Phase:**

1. Feature branch MUST be created following pattern: `###-feature-name`
2. Tests MUST be written first and confirmed failing (Red phase)
3. Implementation MUST make tests pass (Green phase)
4. Code MUST be refactored while maintaining passing tests (Refactor phase)
5. Type errors MUST be resolved before committing
6. Lint and format checks MUST pass before pushing

**Review & Merge Phase:**

1. Pull requests MUST include test coverage report
2. All CI checks MUST pass (types, tests, lints)
3. Code reviewer MUST verify TDD cycle was followed
4. Manual testing MUST verify user stories work as specified
5. Database migrations MUST be reviewed for destructive operations

**Quality Gates (enforced in CI):**

- `bun check-types` - No TypeScript errors
- `bun test` - All tests passing
- `bun lint` - No linting errors
- `bun test:coverage` - Minimum 80% coverage on new code
- `bun build` - Successful production build

## Governance

**Constitution Authority:**

- This constitution supersedes all other development practices and conventions
- All code changes MUST comply with core principles
- Complexity that violates principles MUST be justified in implementation plan under "Complexity Tracking" section

**Amendment Process:**

- Amendments require documented proposal with rationale
- Version MUST be incremented per semantic versioning:
  - **MAJOR**: Removing/redefining core principles
  - **MINOR**: Adding new principles or sections
  - **PATCH**: Clarifications, wording fixes, non-semantic refinements
- Templates MUST be updated to reflect constitutional changes
- Active feature work MUST complete migration plan before amendments take effect

**Compliance & Enforcement:**

- All pull requests MUST pass Constitution Check as defined in implementation plans
- Code reviews MUST verify adherence to TDD workflow
- Performance benchmarks MUST be validated for features affecting API or rendering
- Tooling MUST enforce quality gates (TypeScript strict mode, linting rules, test coverage)

**Development Guidance:**

- For runtime development assistance, refer to project README.md and docs/
- For specification workflow, use `.specify/templates/` and `.github/prompts/speckit.*.prompt.md`
- For architectural decisions, consult this constitution and feature specs in `/specs/`

**Version**: 1.0.0 | **Ratified**: 2025-10-17 | **Last Amended**: 2025-10-17
