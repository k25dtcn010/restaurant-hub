# Bun Check Types Errors

## Overview

Running `bun check-types` shows multiple TypeScript errors in both web and server apps.

## Main Issue Categories

### 1. Web App Errors

- Many properties of type `{}` (empty object) don't have expected properties (length, map, forEach, etc.)
- Untyped `data` from API calls (marked as 'unknown')
- Missing module paths (@/auth, @/api/context, @/api/routers)
- ReactNode assignment issues with unknown types

### 2. Server App Errors

- seed-advanced-ops.ts: Type 'string | undefined' not assignable to type 'string' (3 errors)
- auth-integration.test.ts: Possibly undefined variables (table, ingredient, dish, waiterCaller)
- category-workflow.test.ts: Possibly undefined result and unused dishCategories

## Starting Point

The most critical issue seems to be the untyped data from API calls in the web app. This cascades into many property access errors.
