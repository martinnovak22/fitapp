# Contributing

## Overview

fitapp is an Expo (React Native) fitness-tracker that works **local-first** with optional remote sync. The stack:

- **Framework:** Expo SDK 54, React Native 0.81, Expo Router v6 (file-based routing)
- **Language:** TypeScript ~5.9
- **Database:** SQLite via `expo-sqlite` (local), Supabase (remote sync target)
- **UI:** No component library — bespoke components under `src/modules/core/components/`
- **Testing:** Vitest (pure data-layer tests), no RN runtime needed
- **Linting/formatting:** ESLint + Biome, formatted by Biome

## Prerequisites

- Node.js >= 18
- Yarn 4 (see `packageManager` in `package.json`)
- Expo CLI (`npx expo`)
- iOS: Xcode 16+ (macOS only)
- Android: Android Studio + Android SDK

## Setup

```sh
git clone <repo>
cd fitapp
yarn install
yarn start          # dev server
yarn ios            # iOS simulator
yarn android        # Android emulator
```

Copy `.env.example` if present, or create `.env` with Supabase credentials for remote sync.

## Project structure

```
app/                 # Expo Router file-based routes
  _layout.tsx         # Root layout (providers, splash screen)
  index.tsx           # Route /
  landing.tsx         # Route /landing
  (tabs)/             # Tab navigator group
    _layout.tsx       # Tab bar layout
    workout/          # Workout tab
    exercises/        # Exercises tab
    history/          # History tab
    settings/         # Settings tab
src/
  constants/          # Design tokens (Colors, Spacing, Typography, Radius)
  data/               # Data layer: sync engine, repositories, caching
    sync/             # Sync state machine, outbox, push/pull pipelines
    principal/        # Principal (user) transitions
    remote/           # Remote API adapters (Supabase)
    bootstrap.ts      # Data-layer initialization
  db/                 # SQLite client, queries, write queue
  modules/            # Feature modules (auth, core, timer, workout, exercises)
    core/             # Shared UI (components, hooks, utils)
  types/              # Shared type definitions
  utils/              # General utilities
  test/               # Test helpers (in-memory SQLite, fake Supabase)
docs/
  agents/             # AI-agent documentation (issues, triage, domain)
  adr/                # Architecture Decision Records
  testing/            # Testing guides
```

## Architecture

### Local-first

All reads hit SQLite directly. Writes go through a write queue (`src/db/writeQueue.ts`) that serialises transactions. The UI never waits on the network — remote sync is a background concern.

### Sync model

1. **Dirty tracking:** Every entity table has a `sync_status` column (`local | dirty | synced | failed | blocked`).
2. **Outbox:** The `deletion_tombstones` table and dirty rows form an outbox that the sync cycle drains.
3. **Push:** Rows are upserted to Supabase. Failures are retryable (`failed`) or terminal (`blocked`).
4. **Pull:** Remote rows newer than the local cursor are applied with last-writer-wins reconciliation (see `docs/adr/0001-last-writer-wins-sync-conflict-resolution.md`).
5. **Banner:** A `SyncStatusState` observable drives the `SyncStatusBanner` — idle, running, or failed.

### Routing

Expo Router maps `app/` files to routes. Each tab has its own `_layout.tsx` with a `<Stack>` navigator. Layouts export an `ErrorBoundary` to contain crashes within a single tab.

## Running tests

```sh
yarn test            # vitest run
yarn coverage        # vitest run --coverage
```

Tests live in `src/**/__tests__/*.test.ts` and run in a Node environment (no native runtime). Pure data-layer tests use an in-memory SQLite harness (`src/test/inMemorySqlite.ts`). Add new test files next to the module they cover.

## Linting and formatting

```sh
yarn lint            # ESLint
yarn biome:check     # Check formatting + lint
yarn biome:format    # Auto-format
```

## Type checking

```sh
yarn typecheck       # tsc --noEmit
```

## Full check

```sh
yarn check           # lint + test + typecheck
```

Run this before pushing to catch regressions.

## How to contribute

1. Create a feature branch from `main`.
2. Implement changes with tests where applicable.
3. Run `yarn check` to verify.
4. Open a pull request.

### Commit style

- Imperative lowercase title, no trailing period.
- Bulleted body — each bullet on its own physical line (GitKraken and GitHub both render soft-wraps, so hard-wrapping bullets shows as orphaned lines).
- Blank line between topic shifts.
- Reference issues via `Refs #N.` / `Closes #N.` on the final line.
- No `Co-Authored-By` trailer.

## Documentation

- **For humans:** This file and `docs/testing/`, `docs/ui-inventory.md`
- **For AI agents:** `docs/agents/`, `CLAUDE.md`, ADRs in `docs/adr/`
