# FETA — Family Everything Tracker App

A calm family dashboard built with React Native + Expo. It is designed to work both as a phone app and as an always-on browser/TV display.

## What is in the MVP

Three screens only:

1. **Who’s here?** — add household members, choose who is active, optionally choose who is making updates.
2. **Family Overview** — active people, availability/energy, daily habits, household flows, Next up, and relative “last done” memory.
3. **Update** — quick tabs for Me, Habits, Flows, and Next up.

There is deliberately **no authentication**. State is always cached locally with AsyncStorage (IndexedDB on web). When Supabase environment variables are configured, every family device also shares the same household state, so updates from a parent phone appear on the wall display. If remote sync is unavailable, the app keeps working locally and shows its sync state in the UI.

Daily habits and lightweight health checks reset automatically when the calendar day changes, including while an always-on display stays open. Household flows and Next up persist.

## Household flow model

FETA treats repetitive jobs as states rather than overdue chores:

- **Dishwasher:** clear → filling → ready to run → running → clean / needs emptying → clear.
- **Laundry:** clear → washing → ready to dry → drying → ready to put away → clear.
- **Kitchen:** clear → dinner finished / needs reset → clear. Marking dinner finished also moves a clear dishwasher into “filling”, because dinner normally creates dishes.

Finishing a flow records who completed it and when, which powers the **Last done** relative timeline bars.

## Run locally

Expo SDK 57 requires a modern Node version (Node 22.13+ is the safe baseline).

```bash
npm install
npm run web
```

For native development:

```bash
npm run android
npm run ios
```

You can also scan the QR code from `npm start` with a compatible Expo Go client.

## Shared household sync

The app works without any cloud setup, but local-only mode cannot share updates between devices. To make phones and the wall display stay in sync:

1. Create a Supabase project.
2. Apply `supabase/migrations/20260912230000_household_state.sql`.
3. Copy `.env.example` to `.env`.
4. Fill in the Supabase URL and anon key.
5. Generate a long random UUID/secret for `EXPO_PUBLIC_FETA_HOUSEHOLD_ID` and use the **same value on every family device/deployment**.
6. Restart Expo so the `EXPO_PUBLIC_*` variables are bundled.

The household ID is used as a no-login household token. The migration’s RLS policies only expose the row whose ID matches the `x-household-token` request header. Use a long random value and do not commit your real `.env` file.

Sync polls approximately every five seconds and local changes are pushed after a short debounce. This is intentionally simple for a single-family MVP; a later authenticated/event-based model can replace it without changing the screens.

## Checks

Before committing dependency changes:

```bash
npx expo install --check
npm run typecheck
npx expo export --platform web --output-dir dist
```

The GitHub Actions workflow runs those checks on every pull request.

## Product rules

- Surface the **next useful action**, not a giant chore backlog.
- Calm language: no streak shame, red overdue banners, or nagging.
- One-tap updates wherever possible.
- Shared habits for everyone in the MVP; per-person customisation comes later.
- The overview is the primary big-screen experience; the Update screen is the phone-friendly remote control.

## Likely next steps

Calendar/meal integrations, configurable flows and habits, richer “last done” thresholds, event-based conflict-free sync, and a dedicated wall-display mode can all be layered on without changing the MVP information architecture.
