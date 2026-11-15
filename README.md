# FETA

**Family Everything Tracker App** — the calm state of your household at a glance.

FETA is deliberately not a conventional chore app. The wall display answers **“what is the state of everything?”** while the phone answers **“what changed?”**.

## Architecture

One small full-stack Cloudflare application:

- React + Vite + TypeScript.
- Cloudflare Worker for the `/api/*` routes.
- Cloudflare D1 (SQLite) as the shared household database.
- Cloudflare Vite plugin for local Worker/D1 development and production builds.
- No separate API service and no ORM.
- Device identity (“this is me”) stays in browser storage; household state is shared through D1.
- The wall display polls shared state every few seconds. This is intentionally simpler than adding a realtime service for a family-sized workload.

The UI remains feature-oriented: pages compose, features own behaviour, reusable UI stays generic, and the repository is the browser/data boundary.

## Product

- **Me** — availability, self-reported 1–5 capacity, daily checks, quick household actions.
- **House** — people first, gentle attention ranking, current household state.
- **Display** (`/display`) — dedicated always-on big-screen view.
- **Admin** — lightweight PIN-protected configuration.
- **Household rhythm** — recent completions and flow changes ← **NOW** → next-up expectations.
- Session jobs: one good go resets them.
- Counted jobs: each completion contributes to a learned rate.
- Calendar jobs: fixed schedule.
- Auto cadence writes to the same cadence value used everywhere else; editing it switches to Manual.
- “I left that too long” keeps history but prevents that interval teaching an undesirable cadence.
- Dishwasher and laundry are state machines, not overdue chores.

## PINs and database credentials

D1 is attached to the Worker using a Cloudflare binding, so **there is no database password to put in the app**.

Human PINs are deliberately lightweight 4-digit household PINs. Verification happens in the Worker. D1 stores only a random salt and a PBKDF2-SHA-256 hash (120,000 iterations); PIN hashes are never returned to the React app.

## One-time D1 setup

There is deliberately only **one hosted FETA database**. Local development uses Wrangler’s local D1 emulation.

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

### 2. Database binding

The D1 database already exists and is bound in `wrangler.jsonc` as:

```text
DB → feta
```

The committed database ID is `188a8e92-7d15-4d52-8168-58c24929dc26`.

### 3. Apply the schema

```bash
npm run db:migrate
```

This applies `db/migrations/0001_initial.sql`.

### 4. Deploy

```bash
npm run deploy
```

For Cloudflare Workers Builds, use:

- **Build command:** `npm run build`
- **Deploy command:** `npm run db:migrate && npx wrangler deploy`
- **Preview command:** `npx wrangler preview`
- **Production branch:** `main`


## Local development

Install dependencies:

```bash
npm install
```

Apply the migrations to the local D1 database:

```bash
npm run db:migrate:local
```

Run the full React + Worker + local D1 app with hot reload:

```bash
npm run dev
```

Useful routes:

- `/me`
- `/house`
- `/display`
- `/admin`

The empty database shows first-run household setup. The optional demo household uses PIN `1234` for its people.

## Quality

```bash
npm run typecheck
npm test
npm run build
```

GitHub Actions runs all three for pull requests and pushes to `main`.

## Data model

D1 currently contains:

- `households`
- `people`
- `daily_checks`
- `jobs`
- `job_events`
- `flow_states`
- `flow_events`

This is intentionally small and relational. Completion/event history is the evidence used for cadence learning and the household timeline.

## Operational scope

This is a family POC, not a multi-tenant SaaS. There is no dev/staging/prod database split, no user-account provider, and no separate API deployment. If FETA later becomes multi-household/public, authentication and household authorization should be revisited before expanding access.


## D1 deployment note

FETA deliberately does **not** require the Cloudflare Workers Builds token to run D1 administration commands.

The Worker checks for the v1 schema through its bound `DB` resource and creates the tables/indexes idempotently on the first API request when they are missing. This keeps the normal Workers Builds deploy token least-privileged.

The Cloudflare dashboard Deploy command may remain:

```bash
npm run db:migrate && npx wrangler deploy
```

The `db:migrate` script is intentionally a build-safe no-op; `db:migrate:remote` remains available for explicit manual Wrangler migrations when authenticated with D1 Write access.

Worker Previews use the same D1 database because this personal app intentionally has one hosted environment. Do not use a preview branch for destructive data testing.
