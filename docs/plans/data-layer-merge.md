# Plan: data-layer merge & de-duplication

Status: **draft / not started**. Intended to be picked up in a fresh context. Read `CONTEXT.md` and `docs/adr/0001`–`0004` first.

## Progress

- ✅ Domain language fixed (`CONTEXT.md`) and the data/sync decisions recorded (ADR-0002 migration policy, ADR-0003 local-first, ADR-0004 outbox give-up).
- ✅ `'blocked'` added to the `SyncStatus` type (#61) — that folded-in cleanup is **done**; treat it as complete below.
- ✅ Open questions resolved and recorded ([ADR-0005](../adr/0005-exercise-deduplication.md), #63).
- ✅ Dormant `local` Principal mode removed (#64).
- ✅ **Phase 1 — Detection** shipped (#65): `findDuplicateExerciseGroups` + `normalizeExerciseName` in `src/data/dedup/exerciseDedup.ts`.
- ✅ **Phase 3 — Merge execution** shipped: `mergeDuplicateExercises` (re-point Sets → tombstone+delete duplicates, cascade-safe ordering), `getExerciseSetCounts`, and the `findDuplicateExercises` read side in `src/data/dedup/mergeExercises.ts`.
- ⬜ **Phase 2 — Review UI** — not started (needs design + Android verification).
- ⬜ **Phase 4 — Workout collapse** (stretch) — not started.

## Problem

Guest→Account migration is purely additive and keyed by `uuid` (see [ADR-0002](../adr/0002-guest-to-account-data-migration.md)). When a Guest who has built up data signs into an Account that **already holds data**, overlapping records are duplicated — most visibly the Exercise catalog ("Bench Press" ×2), but the same shape applies to the whole data layer. The original task scoped this to Exercises only; the decision now is to treat it as **one coherent data-layer merge problem** across Exercises, Workouts, and Sets, rather than a per-entity patch.

## Scope

Three entity types, each needing a different match strategy because each has a different natural identity:

| Entity | Natural identity for matching | Merge action on match | Notes / risk |
|---|---|---|---|
| **Exercise** | normalized `name` (+ optionally `muscle_group` / `type`) | keep one survivor, re-point its Sets, soft-delete the duplicate | Catalog overlap is the common case; name match is fuzzy → needs user confirmation |
| **Workout** | `date` + `start_time` (dated event) | likely **do not merge** — distinct events; only collapse exact duplicates | Two workouts same day are usually legitimate; high false-merge risk |
| **Set** | follows its parent (Workout + Exercise + `position`) | re-pointed implicitly when its Exercise/Workout is merged; not matched independently | Never match Sets standalone |

The hard part is **Exercises**; Workouts/Sets mostly ride along. A safe v1 may be "dedup Exercises, re-point Sets, leave Workouts untouched."

## Open questions (resolve before building)

1. ~~**Match key for Exercises**~~ — **RESOLVED:** normalized **name only**, with diacritic folding. Normalization = `trim` → collapse internal whitespace → `toLowerCase` → Unicode NFD + strip combining marks (Czech accent folding). `type`/`muscle_group` are **not** part of the key — they surface as hints/tie-breakers in the review UI. Aggressive matching is deliberate; the review list (Q2) catches over-matches. Folding affects matching only, never stored data.
2. ~~**Auto vs confirm**~~ — **RESOLVED:** always present a **review list**; never auto-merge, not even exact post-normalization matches. Rationale: the match key is deliberately aggressive (Q1), a name collision can be intentional, and merge re-points Sets (irreversible history change), so a human is always the final gate. Merge is a no-op unless the user confirms a group. Survivor pre-selected per Q4; type/muscle_group shown so a bad match is visible.
3. ~~**When does merge run**~~ — **RESOLVED:** a **standalone, re-runnable, principal-scoped maintenance action** with zero coupling to the Principal Transition. It *cannot* live inside the transition: ADR-0002 makes the transition one atomic SQLite transaction, and a review list (Q2) needs a human in the loop, which a transaction can't pause for. It also covers dupes from any source (LWW double-seed, manual typo), not just sign-in. Detection is pure over current-principal rows; the action runs it on demand and is idempotent. **v1: manual discovery — no post-merge nudge** (defer per the ADR-0004 "add it if it proves common" posture).
4. ~~**Survivor selection**~~ — **RESOLVED + re-framed.** The plan's "keep the Account's row" framing is void: by the time the standalone action runs (Q3), the preserve migration has already re-owned the guest's rows (ADR-0002: `user_id IS NULL → userId`), so every row in a group is a same-principal row — there is no Account-vs-Guest distinction left. Survivor = a **deterministic, user-overridable** pre-selection over same-principal rows, priority: (1) oldest `created_at` ("the original wins" — intuitive), (2) most referencing Sets, (3) `synced` over unsynced, (4) lowest `uuid` for test determinism. Survivor's own fields kept untouched; duplicates soft-deleted via the tombstone path; their Sets re-pointed onto the survivor. **A user override in the review UI is authoritative.**
5. **Sync interaction** — re-pointing Sets and soft-deleting duplicates must mark rows `dirty` and write Tombstones so the change propagates; must not fight last-writer-wins ([ADR-0001](../adr/0001-last-writer-wins-sync-conflict-resolution.md)).

## Approach (phased)

1. **Detection** — a pure function: given the current principal's rows, return groups of suspected-duplicate Exercises by normalized name. No mutation. Fully unit-tested.
2. **Review UI** — present duplicate groups; user picks survivor / confirms merge per group. Test the gesture/scroll flow on **Android**, not just iOS.
3. **Merge execution** — inside one `executeWriteTransaction` (mirror `src/data/principal/PrincipalTransition.ts`): re-point Sets (`UPDATE sets SET exercise_id = ?, updated_at = ?, sync_status = 'dirty' WHERE exercise_id = ?`), soft-delete duplicates via the existing tombstone path (`src/db/exercises.ts` / `src/db/sync.ts`), all principal-scoped.
4. **(Stretch) Workout collapse** — only if exact-duplicate workouts prove to be a real problem.

## Touch points

- `src/data/principal/PrincipalTransition.ts` — the atomic-transition pattern to mirror
- `src/db/exercises.ts`, `src/db/workouts.ts`, `src/db/sync.ts` — soft-delete + tombstone helpers
- `src/db/writeQueue.ts` — `executeWriteTransaction`
- `src/data/sync/syncService.ts` — how re-pointed/dirty rows push (uuid-keyed)

## Related cleanups to fold in

These live in the same auth/data layer and are cheaper to do alongside this work than separately:

- **Remove the dormant `local` Principal mode** — `isRemoteDataMode()` / `EXPO_PUBLIC_DATA_MODE=local` threads through ~8 files + 3 tests (`useAuth.tsx`, `principal.ts`, `SyncProvider.tsx`, `syncService.ts`, `authInitialization.ts`, `LoginModeSwitch.tsx`, `settings/index.tsx`). With remote always on, every `if (!isRemoteMode)` branch is dead and can be collapsed; drop `'local'` from `PrincipalMode`. Confirmed unused by the owner.
- **Retire the legacy `local` row `sync_status`** — pre-backfill initial state; verify no live writes still produce it before removing.
- ~~Add `'blocked'` to the `SyncStatus` type~~ — **done in #61**; `src/db/sync.ts` now includes `'blocked'`.

## Testing & rollout

- Unit-test detection and merge execution exhaustively (re-point, tombstone, dirty-marking, no-op when no dupes, principal scoping).
- Verify on Android.
- `yarn check` green; follow `.claude/commit-style.md` and the merge-commit branch workflow.
