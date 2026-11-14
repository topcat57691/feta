# FETA

**Family Everything Tracker App** — the calm state of your household at a glance.

FETA is deliberately not a conventional chore app. The wall display answers **“what is the state of everything?”** while the phone answers **“what changed?”**.

## Current POC

- React + Vite + TypeScript.
- Responsive phone UI plus a dedicated `/display` wall view.
- Local-storage repository for now; the UI is isolated from persistence so a real database can replace it later.
- Per-person 4-digit PINs and a lightweight admin PIN.
- People: availability, presence, self-reported capacity, daily wellbeing/basic checks.
- Household flows: dishwasher and laundry as state machines.
- Jobs: session, counted and fixed-calendar behaviours.
- Automatic cadence learning with a manual override model.
- “Left it too long” feedback excludes misleading session intervals from learning.
- Calm attention ranking rather than overdue/red-list behaviour.
- Household timeline: recently completed work ← **NOW** → next-up expectations.
- Installable PWA shell with basic offline caching.
- Cloudflare Workers static-assets configuration ready for Workers Builds.

## Run locally

```bash
npm install
npm run dev
```

Useful routes:

- `/me` — fast personal updates.
- `/house` — responsive household overview.
- `/display` — always-on wall display.
- `/admin` — PIN-protected setup.

The demo household uses PIN `1234` for all people. The admin PIN is created the first time Admin is opened.

## Quality

```bash
npm run typecheck
npm test
npm run build
```

## Cloudflare Workers Builds

The repository contains `wrangler.jsonc` for a static React SPA. In Cloudflare use:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Preview command:** `npx wrangler preview`
- **Production branch:** `main`
- **Preview builds:** enabled

The production deploy is intentionally held until the app exists on `main`.

## Persistence direction

`src/repositories/household.repository.ts` is the persistence boundary. The POC uses `localStorage`; a later Supabase/D1 implementation can replace it without pushing database calls through pages and components. Device identity is stored separately from household state by design.
