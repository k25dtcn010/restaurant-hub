# RestaurantHub MVP

A lightweight restaurant management platform built with the Better-T-Stack, enabling customer self-service ordering via QR codes and comprehensive order lifecycle management for staff.

## Features

### Customer Experience

- **QR Code Ordering** - Scan table QR code to browse menu and place orders
- **Real-Time Menu** - View available dishes with automatic stock availability
- **Order Tracking** - Track order status from submission to completion
- **Menu Customization** - Add modifiers to dishes for personalized orders
- **Category Browsing** - Browse menu by organized categories

### Staff Management

- **Kitchen Dashboard** - Real-time order board with status management
- **Serving Queue** - Priority-based serving workflow with notifications
- **Inventory Management** - Track ingredient stock with low-stock alerts
- **Menu Management** - Create and edit dishes with recipes (Manager only)
- **Payment Processing** - Simple cash payment recording
- **Shift Management** - Track staff shifts and operating sessions

### Advanced Operations Management

- **Modifiers & Customization** - Add customizable modifiers to menu items (e.g., "Extra Cheese +$2", "No Onions")
  - Create modifier groups with selection constraints (min/max selections)
  - Flexible pricing adjustments (positive or negative)
  - Availability toggling for modifiers
- **Menu Categories** - Organize dishes into hierarchical categories
  - Drag-and-drop reordering for display priority
  - Hide/show categories from customer view
  - Icon/emoji support for visual organization
- **Dish Variants** - Support multiple sizes and options per dish
  - Define variants with individual pricing (e.g., Small/Medium/Large)
  - Variant-specific availability management
- **Temporary Visibility Control** - Hide menu items without deletion
  - Quick hide/show toggle for seasonal items
  - Separate hidden items view for easy management
- **Menu Flags** - Highlight special dishes
  - Recommended items badge (👍)
  - Chef's Special marker (⭐)
  - Kitchen priority ordering
- **Shift & Session Management** - Track restaurant operations
  - Start/end shift tracking with duration monitoring
  - Multi-staff shift assignments
  - Shift summary with order counts and revenue
  - Warning alerts for long-running shifts (>12 hours)

### Technical Stack

- **TypeScript 5.7+** - Full type safety from database to UI
- **Bun 1.3+** - Fast runtime and package manager
- **Hono 4.8+** - Lightweight, performant server framework
- **tRPC 11.5+** - End-to-end type-safe APIs with Zod validation
- **React 18** - Modern UI with TanStack Router
- **Drizzle ORM** - TypeScript-first database toolkit
- **Better-Auth 1.3+** - Role-based authentication
- **shadcn/ui** - Beautiful, accessible UI components
- **WebSocket** - Real-time notifications for kitchen and serving staff

## Getting Started

### Prerequisites

- Bun 1.3.0 or higher
- Node.js 18+ (for compatibility)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/k25dtcn010/restaurant-hub.git
cd restaurant-hub
```

2. Install dependencies:

```bash
bun install
```

3. Setup environment variables:

```bash
# Copy example env files
cp apps/server/.env.example apps/server/.env
```

4. Initialize database:

```bash
# Push schema to database
bun db:push

# Seed test data (30 tables, 15 dishes, 20 ingredients, 3 users)
cd packages/db && bun run src/seed.ts
```

### Development

Start all services in development mode:

```bash
bun dev
```

Or start services individually:

```bash
# Frontend only (port 3001)
bun dev:web

# Backend only (port 3000)
bun dev:server
```

Access the application:

- **Web App**: http://localhost:3001
- **API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000/ws

### Test Credentials

```
Manager:
  Email: admin@restauranthub.com
  Password: password123

Kitchen Staff:
  Email: chef@restauranthub.com
  Password: password123

Waiter:
  Email: waiter@restauranthub.com
  Password: password123
```

## Project Structure

```
restaurant-hub/
├── apps/
│   ├── web/              # Frontend React application
│   │   ├── src/
│   │   │   ├── routes/   # File-based routing (TanStack Router)
│   │   │   ├── components/
│   │   │   └── utils/
│   │   └── package.json
│   └── server/           # Backend Hono server
│       ├── src/
│       │   ├── index.ts  # Server entry point
│       │   └── websocket.ts
│       └── package.json
├── packages/
│   ├── api/              # tRPC routers and business logic
│   │   ├── src/
│   │   │   ├── routers/  # API endpoints
│   │   │   └── context.ts
│   │   └── tests/        # API tests
│   ├── auth/             # Better-Auth configuration
│   │   └── src/
│   └── db/               # Database schema and migrations
│       ├── src/
│       │   ├── schema/   # Drizzle schema definitions
│       │   └── seed.ts   # Test data seeder
│       └── drizzle.config.ts
├── docs/                 # Documentation
│   ├── api-reference.md
│   └── websocket-protocol.md
├── specs/                # Feature specifications
│   └── 001-restaurant-hub-mvp/
└── package.json
```

## Available Scripts

### Development

- `bun dev` - Start all applications in development mode
- `bun dev:web` - Start only the frontend (port 3001)
- `bun dev:server` - Start only the backend (port 3000)

### Build

- `bun build` - Build all applications for production
- `bun check-types` - Check TypeScript types across all packages

### Database

- `bun db:push` - Push schema changes to database
- `bun db:generate` - Generate migration files
- `bun db:migrate` - Run database migrations
- `bun db:studio` - Open Drizzle Studio (database GUI)

### Testing

- `bun test` - Run all tests
- `bun test packages/api` - Run API tests only
- `bun test:coverage` - Run tests with coverage report

## Architecture

### Database Schema

20+ entities with full type safety:

**Core MVP Entities:**

- **User** - Authentication and role-based access
- **Table** - Restaurant tables with QR codes
- **Dish** - Menu items with pricing
- **Ingredient** - Inventory items with stock levels
- **Recipe** - Dish-to-ingredient relationships
- **Order** - Customer orders with lifecycle tracking
- **OrderItem** - Individual dish quantities
- **OrderStatusHistory** - Audit trail
- **Payment** - Transaction records

**Advanced Operations Entities:**

- **Modifier** - Customizable add-ons with price adjustments
- **ModifierGroup** - Groups of modifiers with selection constraints
- **DishModifier** - Dish-to-modifier assignments
- **OrderItemModifier** - Selected modifiers per order item
- **Category** - Menu organization categories
- **DishCategory** - Dish-to-category assignments
- **DishVariant** - Size/option variants per dish
- **Shift** - Staff shift tracking
- **ShiftStaff** - Staff assignments to shifts
- **Reservation** - Table reservations (future)
- **OperatingHours** - Restaurant schedule (future)

### API Endpoints

9 tRPC routers with comprehensive validation:

**Core Routers:**

- **tables** - QR code validation and table management
- **dishes** - Menu CRUD with recipe management, variants, and flags
- **orders** - Order lifecycle from creation to completion
- **inventory** - Stock management with alerts
- **payments** - Cash payment processing

**Advanced Operations Routers:**

- **modifiers** - Modifier and modifier group management
- **categories** - Category organization and visibility
- **shifts** - Shift tracking and session management
- **reservations** - Table reservation system (future)

See [docs/api-reference.md](./docs/api-reference.md) for complete API documentation.

### Real-Time Communication

WebSocket connections with role-based event routing:

- **Kitchen** - Receives NEW_ORDER events
- **Serving** - Receives ORDER_READY notifications
- **Manager** - Monitors all events

See [docs/websocket-protocol.md](./docs/websocket-protocol.md) for protocol details.

## User Roles

| Role              | Permissions                                                         |
| ----------------- | ------------------------------------------------------------------- |
| **Manager**       | Full access to all features including menu and inventory management |
| **Kitchen Staff** | Update order status (Pending → In Kitchen → Ready to Serve)         |
| **Waiter**        | Create orders, mark served/paid, process payments                   |
| **Customer**      | View menu and place orders via QR code (unauthenticated)            |

## Development Workflow

### TDD-First Approach

This project follows strict Test-Driven Development:

1. Write tests first (Red phase)
2. Implement to pass tests (Green phase)
3. Refactor while keeping tests green (Refactor phase)

Test coverage goal: 80% minimum for business logic.

### Code Quality Standards

- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Zero TypeScript compilation errors in production
- All tRPC inputs validated with Zod schemas

### Constitution

See [.github/instructions](./. github/instructions) for the project constitution defining:

- TDD requirements
- Type safety standards
- Performance goals
- Security requirements

## Documentation

- [API Reference](./docs/api-reference.md) - Complete tRPC API documentation
- [WebSocket Protocol](./docs/websocket-protocol.md) - Real-time event specifications
- [MVP Specifications](./specs/001-restaurant-hub-mvp/) - Core feature requirements
- [Advanced Operations Specifications](./specs/002-advanced-ops-management/) - Modifiers, categories, variants, reservations, shifts
- [Quick Start Guide](./specs/001-restaurant-hub-mvp/quickstart.md) - Development workflow

## Performance Goals

- API response time p95 < 200ms
- Bundle size < 500KB gzipped
- Time to Interactive < 3s on 3G
- Real-time notifications < 5 seconds
- Support 20+ simultaneous table sessions

## Contributing

1. Follow TDD workflow (tests before implementation)
2. Ensure TypeScript strict mode passes
3. Maintain 80%+ test coverage
4. Run `bun check-types` and `bun test` before committing
5. Follow existing code patterns and conventions

## License

MIT

## Recent Updates

### Version 2.0 - Advanced Operations Management (2025-10-18)

Added comprehensive restaurant operations features:

- ✅ Modifiers system with flexible pricing
- ✅ Menu category organization
- ✅ Dish variants (sizes/options)
- ✅ Temporary visibility controls
- ✅ Menu flags (recommended, chef's special, priority)
- ✅ Shift and session management
- 🚧 Table reservations (in development)

### Version 1.0 - MVP Launch (2025-10-18)

Initial release with core features:

- QR code ordering system
- Kitchen and serving dashboards
- Inventory management
- Role-based authentication
- Real-time WebSocket notifications

---

**Built with** [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack)  
**Last Updated**: 2025-10-18
