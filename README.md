# Cardiology Scheduler

A web-based scheduling system for managing cardiology provider assignments across inpatient consultations, echo labs, stress testing, and other services. Built for the Mount Sinai cardiology department.

## Features

### Provider Scheduling
- Drag-and-drop calendar for assigning providers to services by day and time block (AM/PM)
- Service-specific capability matching (Echo, Stress, Nuclear, Inpatient, Consults, Precepting)
- Room allocation tracking
- Bulk assignment and bulk schedule operations
- Reusable weekly schedule templates with alternating pattern support (A-B, A-A-B-B, etc.)

### PTO Management
- PTO request submission with approval workflow (pending, approved, denied)
- Leave types: vacation, maternity, medical, personal, conference
- PTO balance tracking per provider per year
- Automatic weekend exclusion from PTO day counts
- Conflict detection with existing assignments and cascade deletion
- Team PTO calendar for visibility

### Availability Rules
- Per-provider allow/block rules by day of week, service, and time block
- Enforcement levels: **hard** (prevents assignment) or **warn** (allows with warning)

### Echo / Testing Lab Schedule
- Separate scheduling system for echo technicians and rooms
- Room categorization (CVI, Fourth Floor Lab) with capacity tracking
- Echo-specific templates and PTO management

### Reporting
- General statistics, provider workload, service coverage, room utilization
- PTO summaries and provider availability planner
- Custom report builder with flexible filtering, grouping, and column selection

### Admin Features
- Provider, service, and user CRUD
- Role-based access control (see [User Roles](#user-roles))
- Change history with undo/redo
- Sandbox environment for testing changes before publishing
- Holiday management with inpatient-service exceptions

## User Roles

| Role | Access |
|------|--------|
| **Super Admin** | Full access to all features and settings |
| **Scheduler (Full)** | Edit all schedules and services |
| **Scheduler (Limited)** | Edit specific assigned services only |
| **Provider** | View own schedule, submit PTO requests |
| **Viewer** | Read-only access to schedules |

Anonymous (unauthenticated) users can view the calendar. A login modal appears on demand for actions that require authentication.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router) with React 19
- **Language:** TypeScript
- **Database:** [Supabase](https://supabase.com) (PostgreSQL)
- **Styling:** Tailwind CSS with [shadcn/ui](https://ui.shadcn.com) components
- **Drag & Drop:** @dnd-kit
- **Auth:** Session-based with bcryptjs password hashing and httpOnly cookies
- **Data Import:** XLSX (Excel file reading)

## Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Set up the database

Run the SQL setup scripts in your Supabase SQL Editor in order:

1. `scripts/setup-database.sql` -- core schema (providers, services, assignments)
2. `supabase/pto-requests-setup.sql` -- PTO request tables
3. `supabase/pto-balance-setup.sql` -- PTO balance tracking
4. `supabase/provider-leaves-setup.sql` -- provider leave records
5. `supabase/change-history-setup.sql` -- undo/redo history
6. `supabase/holidays-setup.sql` -- holiday table
7. `supabase/holidays-seed.sql` -- seed holiday data
8. `supabase/templates-setup.sql` -- schedule templates
9. `supabase/echo-schedule-setup.sql` -- echo lab schedule tables
10. `supabase/echo-templates-setup.sql` -- echo templates
11. `supabase/rbac-migration.sql` -- role-based access control
12. `supabase/sandbox-setup.sql` -- sandbox environment

Or run the combined setup:

```bash
# Outputs full SQL to console -- paste into Supabase SQL Editor
node scripts/setup-database.js
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the scheduler.

### 5. Import data (optional)

Import providers and schedules from Excel files:

```bash
node scripts/import-providers.js
node scripts/import-schedule.js
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run import-schedule` | Import schedule data from Excel |

## Project Structure

```
app/
  page.tsx                  Main calendar page
  dashboard/                Dashboard view
  data/                     Data management
  pto-requests/             PTO request pages
  providers/                Provider detail pages
  echo/                     Echo/Testing schedule pages
  statistics/               Statistics views
  admin/                    Admin panel
    providers/              Provider management
    services/               Service management
    templates/              Schedule templates
    pto-requests/           PTO approval
    reports/                Reporting interface
    users/                  User management
    echo/                   Echo tech/room management
  api/                      API routes (~48 endpoints)
    auth/                   Login, logout, session
    assignments/            Schedule assignment CRUD
    providers/              Provider data
    services/               Service management
    templates/              Template CRUD and application
    pto/                    PTO creation/deletion
    pto-requests/           PTO request workflow
    availability/           Availability rule checking
    echo-*/                 Echo lab endpoints
    day-metadata/           Day notes and room metadata
    holidays/               Holiday management
    reports/                Report generation
    admin/                  Undo/redo, bulk operations
    sandbox/                Sandbox environment
  components/               React components
    MainCalendar.tsx        Core scheduling calendar
    layout/                 App shell (sidebar, login modal)
    admin/                  Admin-specific components
    calendar/               Assignment modals
    reports/                Report builder
    modals/                 Shared modals
  contexts/                 React contexts (Auth, Admin)
lib/
  types.ts                  TypeScript type definitions
  supabase.ts               Supabase client
  auth.ts                   Auth utilities
  availability.ts           Availability rule checking
  holidays.ts               Holiday management
  ptoCalculation.ts         PTO day calculation logic
  ptoCascade.ts             PTO cascade deletion
  utils.ts                  General utilities
components/ui/              Shared shadcn/ui components
supabase/                   SQL migration and setup scripts
scripts/                    Node.js setup and import scripts
```

## Deployment

The project is configured for deployment on [Vercel](https://vercel.com):

1. Connect your GitHub repository to Vercel.
2. Set the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel dashboard.
3. Deploy. Vercel will run `next build` automatically.

## License

Private -- not licensed for redistribution.
