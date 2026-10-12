# fitapp

[![CI](https://github.com/martinnovak22/fitapp/actions/workflows/ci.yml/badge.svg)](https://github.com/martinnovak22/fitapp/actions/workflows/ci.yml)
![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native 0.81](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57?logo=sqlite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-sync-3FCF8E?logo=supabase&logoColor=white)

A local-first fitness tracker built with Expo and React Native. It stores everything in SQLite on the device and can optionally sync to Supabase.

## What it does

- Log a workout set by set for weight, cardio, bodyweight or timed exercises, with drop sets as stages inside a set.
- Keep an exercise library with types, muscle groups, photos and a progress chart per exercise.
- Save plans (named exercise lists) and start a workout from one.
- Browse past workouts as a list, a calendar or stats (streak, weekly volume, muscle balance).
- Use the app as a guest, or sign in to sync with a Supabase account; guest data can merge into the account.
- Switch between English and Czech.

## Stack

Expo SDK 54, React Native 0.81, expo-router 6, expo-sqlite 16, Supabase (auth and sync), i18next 25, Vitest 4 (unit tests), Maestro (e2e), TypeScript 5.9.

## Quick start

Prerequisites: Node 22, Yarn 4 (via Corepack), Android Studio with a running emulator.

```sh
git clone https://github.com/martinnovak22/fitapp.git
cd fitapp
corepack enable
yarn install
cp .env.example .env   # optional: fill in the Supabase values to enable sync
yarn android           # builds the native debug app, installs it and starts Metro
```

Without Supabase values the app runs in guest mode only. See [.env.example](./.env.example) for the variable names.

After the first build, `yarn start` is enough to start Metro for the installed app.

## Scripts

| Script | What it does |
|---|---|
| `yarn check` | Runs Biome, ESLint, Vitest, `tsc` and the fallow dead-code check. Run it before you push. |
| `yarn test` | Runs the Vitest suite in Node against an in-memory SQLite. |
| `yarn e2e` | Runs the Maestro suite on an Android emulator (`--build` builds a release APK first). |
| `yarn bundle:android` | Bundles the app for Android with Hermes to catch broken imports and assets. |
| `yarn doctor` | Runs expo-doctor to check native module versions against the Expo SDK. |

CI runs the same checks on every pull request, except `e2e`.

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md): setup details, project structure, architecture and workflow.
- [CONTEXT.md](./CONTEXT.md): the domain glossary. Use its terms in code and issues.
- [docs/adr/](./docs/adr/): architecture decisions, such as last-writer-wins sync and guest-to-account migration.
- [docs/testing/](./docs/testing/): the [Maestro e2e guide](./docs/testing/e2e-maestro.md) and the manual [sync lifecycle checklist](./docs/testing/sync-lifecycle-checklist.md).
- [docs/agents/](./docs/agents/): conventions for AI agents (issue tracker, triage labels, domain docs).
