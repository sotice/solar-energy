# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sunshine is a solar energy monitoring and management platform consisting of **three subsystems**: a backend API, a frontend SPA, and a data simulation service. The system tracks solar unit performance, generates invoices, processes payments via Stripe, and detects anomalies in energy generation.

## Commands

### Backend (VoltVision-Backend — port 8000)

```bash
npm run dev          # Start dev with nodemon + ts-node
npm run dev:ngrok    # Expose localhost via ngrok (stripe webhook testing)
npm run build        # npm install + tsc compile
npm start            # node ./dist/index.js
npm run seed         # Seed DB with initial SolarUnit (ts-node)
```

### Data API (VoltVision-data-API — port 8001)

```bash
npm run dev          # Start dev with nodemon + ts-node
npm run dev:ngrok    # Expose localhost via ngrok
npm run build        # npm install + tsc compile
npm run seed         # Seed DB with initial SolarUnit
```

### Frontend (VoltVision-Frontend — port 5173)

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Architecture

### Three-Subsystem Data Flow

```
Sunshine-data-API (port 8001)     ← Generates simulated energy data every 10s
       ↓ fetch (scheduled)
Sunshine-Backend (port 8000)      ← Syncs records, runs anomaly detection
       ↓ JSON (REST)
Sunshine-Frontend (port 5173)     ← React SPA consuming the backend API
```

### Backend (Express.js v5 + TypeScript)

Clean architecture pattern with 4 layers:

- **`src/api/`** — Express routers + middleware (HTTP boundary)
  - Routes: `solar-unit`, `energy-generation-record`, `users`, `invoice`, `payment`, `anomalies`, `settings`, `webhooks`
  - Middleware: `authentication-middleware` (Clerk `getAuth`), `authorization-middleware` (admin role check), `sync-middleware`, `global-error-handling`, `logger`
- **`src/application/`** — Business logic (service functions, not classes)
  - Each domain concept has a corresponding file: `solar-unit.ts`, `invoice.ts`, `payment.ts`, `analytics.ts`, `anomaly.ts`, `weather.ts`, `settings.ts`
  - Background jobs: `sync-energy-generation-records.ts` (fetches from data-API, persists records, runs detection)
- **`src/domain/`** — Pure logic with no infrastructure imports
  - `types.ts` — Role type (`"admin" | "staff"`)
  - `dtos/solar-unit.ts` — Zod validation schemas (`CreateSolarUnitDto`, `UpdateSolarUnitDto`)
  - `errors/errors.ts` — Custom error classes: `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`
  - `services/anomaly-detector.ts` — Detection rules (zero-peak, data-spike)
- **`src/infrastructure/`** — External concerns (DB, scheduler, entities)
  - `db.ts` — MongoDB connection via Mongoose
  - `entities/` — 6 Mongoose models: `SolarUnit`, `User`, `Invoice`, `Anomaly`, `EnergyGenerationRecord`, `SystemSettings`
  - `scheduler.ts` — Daily cron to sync data (configurable via `SYNC_CRON_SCHEDULE`)
  - `seed.ts` — Creates initial solar unit `SU-0001`

### Data API (Express.js v5 + TypeScript)

Simulates solar panel generation data on a cron schedule (every 10 seconds by default for demo purposes). Key differences from the main backend:

- Has its **own** `EnergyGenerationRecord` schema with `serialNumber` (string) instead of the backend's `solarUnitId` (ObjectId)
- Generates data for **3 units**: `SU-0001`, `SU-0002`, `SU-0003`
- Uses a sine-wave production curve (wattage peaks at solar noon) with randomized anomalies: 5% cloud-drop chance, 1% spike chance
- The backend's sync job fetches from this API and transforms records into its own schema using `solarUnitId`

### Frontend (React 19 + Vite + Tailwind CSS v4)

Layout hierarchy (from router in `main.jsx`):

```
RootLayout (no wrapper)
  ├── MainLayout       → public pages (Home, Story, Contact Us)
  ├── ProtectedLayout  → guards /sign-in redirect
  │   └── DashboardLayout  → sidebar + content area
  │       ├── User routes (dashboard, anomalies, analytics, invoices, payment)
  │       └── AuthorizedLayout → admin role guard
  │           └── Admin routes (solar-units CRUD, settings, admin anomalies, invoices dashboard)
  └── Auth pages at /sign-in, /sign-up (outside MainLayout)
```

State management:

- **Redux Toolkit + RTK Query** — API client (`query.js`) with auto-generated hooks for all backend endpoints. Cache tags: `SolarUnits`, `Users`, `Invoices`, `Anomalies`, `Settings`
- **Zustand** — Theme store (daisyUI theme switching, persisted to localStorage)
- **Redux UI slice** — dashboard tab selection state

Key shared components:

- `AppSidebar` — Sidebar navigation component using shadcn/ui `SidebarProvider`
- `components/ui/` — Reusable UI primitives (button, card, input, select, tooltip, dialog, etc.)
- `components/ui/charts/` — Recharts-based chart components (e.g., `AreaChart`)
- `lib/anomalyDetection.js` — Client-side anomaly detection utility (window average and absolute threshold methods)

## Key Technologies & Integrations

- **Authentication**: Clerk (@clerk/express, @clerk/clerk-react) with JWT session claims for role-based access
- **Payments**: Stripe (embedded checkout, webhooks) — `apiVersion: "2025-11-17.clover"`
- **Database**: MongoDB with Mongoose ODM (two separate databases: main backend + data-API)
- **Weather Data**: Open-Meteo API (free, no API key required; hardcoded Colombo, Sri Lanka coordinates)
- **Frontend State**: Redux Toolkit + RTK Query (API) + Zustand (theme)
- **UI Framework**: Tailwind CSS v4 + Radix UI primitives + DaisyUI themes + shadcn/ui components
- **Charts**: Recharts (line charts, area charts, pie charts)
- **Animations**: AOS (Animate On Scroll) — initialized in `main.jsx`
- **Forms**: react-hook-form + @hookform/resolvers + Zod
- **Routing**: react-router v7
- **Notifications**: react-toastify
- **Scheduling**: node-cron for background jobs (both backend and data-API)

## Global Type Augmentation

The backend's `global.d.ts` extends Clerk's `CustomJwtSessionClaims` with a `metadata.role` field (`"admin"`). This is used by `authorization-middleware.ts` to check admin access.

## Custom Domain Error Classes

All defined in `src/domain/errors/errors.ts`:

- `NotFoundError` — Resource not found (returns 404 via global handler)
- `ValidationError` — Invalid input data
- `UnauthorizedError` — Not authenticated
- `ForbiddenError` — Not authorized (wrong role)

The `global-error-handling-middleware.ts` catches these and returns appropriate HTTP status codes.

## Express Middleware Ordering (Critical)

The `index.ts` order is strict — violations break Stripe webhooks or Clerk auth:

1. CORS + Logger
2. Clerk webhooks router (`/api/webhooks/clerk` — raw body)
3. Stripe webhook (`/api/stripe/webhook` — `express.raw()` BEFORE `express.json()`)
4. **Clerk middleware** (`clerkMiddleware()`) — must be before API routes using `getAuth()`
5. `express.json()` body parser
6. API routers (solar-units, invoices, payments, anomalies, settings, etc.)
7. Analytics routes (weather, capacity-factor)
8. Global error handler

## Environment Variables

### Backend (.env)

```
MONGODB_URL=mongodb://...
CLERK_SECRET_KEY=sk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
FRONTEND_URL=http://localhost:5173
SYNC_CRON_SCHEDULE=0 0 * * *  # Optional, defaults to midnight
PORT=8000  # Optional
DATA_API_URL=http://localhost:8001/api  # Used by sync job
```

### Data API (.env)

```
MONGODB_URL=mongodb://...                     # Can be same or different DB
SOLAR_UNIT_SERIAL=SU-0001                      # Default unit serial
ENERGY_CRON_SCHEDULE=*/10 * * * * *            # Every 10s for demo
PORT=8001
```

### Frontend (.env)

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:8000/api          # Optional, defaults to localhost:8000
```

## Data API → Backend Sync Flow

1. Data-API cron generates energy records every 10s for `SU-0001`, `SU-0002`, `SU-0003`
2. Backend sync job (`sync-energy-generation-records.ts`) fetches new records from data-API per solar unit, transforms `serialNumber` → `solarUnitId`, and inserts them into the backend's `EnergyGenerationRecord` collection
3. After inserting each batch, it runs `detectAnomalies()` from `domain/services/anomaly-detector.ts`
4. Sync can be triggered:
   - Automatically via cron (default midnight)
   - Manually via `POST /api/anomalies/trigger-scan`
   - By uncommenting the startup sync call in `index.ts`

## Domain Logic

### Solar Units

- Statuses: `ACTIVE`, `INACTIVE`, `MAINTENANCE`
- Linked to users via `userId` (MongoDB ObjectId, resolved from Clerk userId)
- Admin routes use `authorizationMiddleware`; user route (`/me`) uses `syncMiddleware`
- Admin CRUD populates user data via Mongoose `.populate("userId", "firstName lastName email")`

### Anomaly Detection

**Server-side** (in `domain/services/anomaly-detector.ts` — runs during sync):

- **Zero Production**: Near-zero output during peak sun hours (10 AM - 2 PM) → Critical severity
- **Data Spike**: Output > 100 kWh in one hour → Warning severity (possible sensor error)

**Client-side** (in `lib/anomalyDetection.js` — runs in browser for chart overlays):

- **Window Average**: Detects records deviating >40% from the rolling average (Underperformance)
- **Absolute Threshold**: Detects records below minimum kWh threshold (System Failure)

### Invoices & Payments (Stripe Embedded Checkout)

1. Invoice is generated from energy records (last 30 days, Wh → kWh)
2. User requests payment → backend creates Stripe Checkout Session (embedded mode)
3. Stripe returns `client_secret` → frontend mounts Stripe Elements
4. After payment, Stripe calls webhook → backend updates invoice to `PAID`
5. Frontend polls `/payments/session-status` for confirmation
6. Payment statuses: `PENDING`, `PAID`, `FAILED`

### Clerk Webhooks

The `webhooks.ts` router handles three Clerk events:

- `user.created` — Creates a local `User` record from Clerk user data (firstName, lastName, email, clerkUserId)
- `user.updated` — Syncs role changes from Clerk public metadata
- `user.deleted` — Removes the local User record

### System Settings

Singleton pattern via `SystemSettings` Mongoose model: `appName`, `maintenanceMode`, `emailNotifications`, `logRetentionDays`. Admin-only CRUD via `/api/settings`.

## API Routes

| Route | Auth | Method | Description |
| ----- | ---- | ------ | ----------- |
| `/api/solar-units` | Admin | GET/POST | Admin CRUD (with user population) |
| `/api/solar-units/me` | User | GET | Current user's solar unit (with sync) |
| `/api/solar-units/:id` | Admin | GET/PUT/DELETE | Single unit CRUD |
| `/api/energy-generation-records/solar-unit/:id` | User | GET | Energy data (optional `groupBy=date`, `limit`) |
| `/api/users` | Public | GET | All users list |
| `/api/invoices` | User | GET | Current user's invoices |
| `/api/invoices/generate` | User | POST | Manually trigger invoice generation |
| `/api/invoices/admin/all` | Admin | GET | All invoices (with user populates) |
| `/api/invoices/admin/:id/status` | Admin | PATCH | Update payment status |
| `/api/payments/create-checkout-session` | User | POST | Create Stripe embedded checkout |
| `/api/payments/session-status` | User | GET | Poll Stripe session status |
| `/api/stripe/webhook` | Public | POST | Stripe event webhook |
| `/api/anomalies/my-unit` | User | GET | Current user's anomalies (with status/severity filter) |
| `/api/anomalies/analytics/:id` | User | GET | Anomaly stats (summary, distribution, trends) |
| `/api/anomalies/:id/resolve` | User | PATCH | Mark anomaly as RESOLVED |
| `/api/anomalies/trigger-scan` | User | POST | Manually trigger sync + anomaly scan |
| `/api/anomalies/admin/all` | Admin | GET | All anomalies (with nested user populate) |
| `/api/settings` | Admin | GET/PUT | System settings |
| `/api/webhooks/clerk` | Public | POST | Clerk user lifecycle events |
| `/api/weather` | Public | GET | Open-Meteo weather (Colombo) |
| `/api/analytics/capacity-factor/:id` | User | GET | Daily capacity factor (30-day) |

## Router Route Ordering (Express v5)

Express v5 no longer matches routes the same way as v4. **Specific routes must be registered before parameterized ones** (e.g., `/me` before `/:id`). This is already handled in `solar-unit.ts`:

1. `/me` first
2. `/` second
3. `/:id` last

## Development Notes

- Backend runs on port 8000, data-API on port 8001, frontend on port 5173
- nodemon uses `ts-node -T` (`-T` skips type checking for faster restarts)
- Start all three services for a full development experience
- Stripe webhooks require a public URL — use `npm run dev:ngrok` or Stripe CLI `stripe listen --forward-to localhost:8000/api/stripe/webhook`
- Weather API uses hardcoded coordinates (Colombo, Sri Lanka)
- The `sync-middleware.ts` triggers an on-demand data sync before returning the user's solar unit data
- ngrok config is expected in `ngrok.yml` in each service directory
