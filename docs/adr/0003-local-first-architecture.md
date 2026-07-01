---
status: accepted
---

# Local-first architecture: SQLite is the source of truth

On-device SQLite is the system of record. Every read and write hits SQLite directly and synchronously — the UI never waits on the network. A remote (Supabase) is an **optional** mirror that a background sync reconciles into and out of via a push Outbox and a pull cursor. The app is fully usable with no account (a Guest syncs anonymously).

> Note: this originally described a build-time `EXPO_PUBLIC_DATA_MODE=local` toggle that disabled remote entirely. That toggle and the dormant `local` Principal mode it drove have since been removed; remote is always available in the shipping configuration. The local-first guarantees above (synchronous SQLite reads/writes, offline usability) are unchanged.

## Considered options

- **Remote-first** (Supabase is the source of truth, device caches reads) — rejected: the core flow is logging Sets mid-workout, often on gym wifi or no signal. Making that path depend on a round-trip would make the app feel broken exactly when it's in use.
- **Offline-only** (no remote at all) — rejected: gives up cross-device continuity and off-device backup, which an Account is meant to provide.

## Consequences

- Writes can happen offline on multiple devices, so conflicts are possible — resolved by last-writer-wins (see [ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)).
- Every syncable row carries a stable `uuid` and sync metadata (`sync_status`, timestamps, attempts); local integer ids are device-local and never travel.
- There are effectively two convergence paths (push Outbox, pull cursor) that must agree; the sync engine, not the UI, owns that complexity.
- Every query is **principal-scoped** (`user_id = ?` or `IS NULL`) so a Guest's and an Account's data never bleed together on a shared device.
