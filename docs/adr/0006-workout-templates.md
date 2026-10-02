---
status: accepted
---

# Workout Templates as one synced row holding a list of Exercise uuids

Workouts used to be fully ad hoc: every Set offered the principal's whole Exercise list, which gets long. We add **Workout Templates**: named, reusable lists of Exercises (e.g. "Push A"). When you start a Workout you choose a **Planned Workout** (from a Template) or an **Unplanned Workout** (unchanged behaviour). A Planned Workout's exercise picker offers only that Template's Exercises.

## Decisions

- **A Template is membership, not a program.** It has a name and a set of Exercises. It has no order, no target sets/reps and no date. You still pick the order while training, and the picker keeps its current format.
- **Membership is stored on the Template row as a JSON array of Exercise uuids** (`workout_templates.exercise_uuids`: TEXT locally, `jsonb` remotely). There is no junction table.
- **A Workout records its Template by uuid** (`workouts.template_uuid`, nullable). `NULL` means an Unplanned Workout, which is what every pre-existing Workout becomes. The migration only adds things.
- **The link is write-once.** Nothing ever clears `template_uuid`, so the client pushes it only when it is set. A device whose copy of a Workout predates the link therefore cannot null out the server value. The v5 local upgrade also resets the Workouts pull cursor once, so Workouts pulled before the column existed get their link backfilled.
- **References are uuids, never local ids.** Local integer ids are device-specific: a pull inserts rows under different ids. Uuids are the same on every device, so neither reference needs the push-time parent-id resolution or pull-time cursor stalling that Sets need ([PushPipeline](../../src/data/sync/PushPipeline.ts), `pullSets`).
- **Dangling references are resolved when read, not cascaded.**
  - A deleted Exercise drops out of a Template because readers keep only uuids that still resolve to a live Exercise (`resolveMembers`). The stored array is not pruned on save. A uuid that does not resolve *here* may belong to an Exercise not yet pulled to this device, and pruning it would strip it from every device on the next push.
  - A deleted Template leaves its Workouts' `template_uuid` pointing at nothing, so those Workouts read as unplanned. History is never touched.
- **Exercise De-duplication re-points Template membership** onto the Survivor, the same way it re-points Sets ([ADR-0005](0005-exercise-deduplication.md)).
- **Picker contents for a Planned Workout:** the Template's live Exercises, plus any Exercise that already has a Set in this Workout, so editing an older Set still works after the Template changed. If that leaves nothing (every Template Exercise was deleted), the picker falls back to the full list rather than dead-ending.
- Templates are principal-owned and sync like every other entity: last-writer-wins ([ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)), Outbox, Deletion Tombstones, and guest→account re-ownership ([ADR-0002](0002-guest-to-account-data-migration.md)). They are not shared between Accounts.

## Considered options

- **A `workout_template_exercises` junction table.** This is the textbook relational shape, and it would let Postgres enforce foreign keys. We rejected it because the sync engine is per-entity. A junction row has two parents, so it would need its own Outbox variant, remote-id resolution against both parents, tombstones per membership change, and the held-back cursor logic `pullSets` needs for out-of-order parents. That is a lot of new failure surface for a list a single owner edits a few times a month. Whole-row last-writer-wins on a small array is the right granularity here.
- **Store local exercise ids in the array.** Rejected: ids differ per device, so membership would break on the first pull to another device.
- **Cascade deletes into Templates and Workouts.** Rejected: rewriting history Workouts would push a burst of dirty rows for no user-visible gain, and resolving at read time gives the same result.

## Consequences

- Postgres cannot enforce that `exercise_uuids` entries exist. Readers must tolerate unknown uuids, and they do by design.
- Two devices editing the same Template offline resolve whole-row (the last edit wins), not per membership change. This is acceptable for a single-owner list.
- Stale uuids of deleted Exercises stay in `exercise_uuids` indefinitely. This is harmless, because every reader resolves them away.
- **Deploy order:** the Supabase migration adding `workout_templates` and `workouts.template_uuid` must be applied before any client running this code syncs.
  - What still works: the client treats a missing `workout_templates` table as empty on pull, and omits a NULL `template_uuid` on push. Unplanned Workouts and every pull therefore keep working.
  - What gets parked: Template pushes and Planned Workout pushes are rejected and parked as `blocked` until the migration lands, and so are those Workouts' Sets after 5 `missing-parent` attempts. They can then be recovered with "Try again" ([ADR-0004](0004-outbox-give-up-policy.md)).
