# FETA — Family Everything Tracker App

A calm, local-first family dashboard built with React Native + Expo. It is designed to work both as a phone app and as an always-on browser/TV display.

## What is in the MVP

Three screens only:

1. **Who’s here?** — add household members, choose who is active, optionally choose who is making updates.
2. **Family Overview** — active people, availability/energy, daily habits, household flows, Next up, and relative “last done” memory.
3. **Update** — quick tabs for Me, Habits, Flows, and Next up.

There is deliberately **no authentication and no backend**. State is persisted locally with AsyncStorage (IndexedDB on web). Daily habits and lightweight health checks reset automatically when the calendar day changes; household flows and Next up persist.

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

Before committing dependency changes, it is worth running:

```bash
npx expo install --check
npm run typecheck
```

## Product rules

- Surface the **next useful action**, not a giant chore backlog.
- Calm language: no streak shame, red overdue banners, or nagging.
- One-tap updates wherever possible.
- Shared habits for everyone in the MVP; per-person customisation comes later.
- The overview is the primary big-screen experience; the Update screen is the phone-friendly remote control.

## Likely next steps

Calendar/meal integrations, optional cloud sync, configurable flows and habits, richer “last done” thresholds, and a dedicated wall-display mode can all be layered on without changing the MVP information architecture.
