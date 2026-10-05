---
status: accepted
---

# Exercises are soft-deleted locally so their Sets stay in history

Deleting an Exercise used to hard-`DELETE` the local row. `sets.exercise_id` is declared `ON DELETE CASCADE` and foreign keys are on, so this silently wiped every Set of that Exercise from every past Workout, and the delete dialog promised the opposite. Devices pulling the deletion did the same.

The server never lost anything, because the tombstone push only sets `exercises.deleted_at`. But devices could not pull those Sets back: a Set whose Exercise isn't local is held back, which also froze the sets pull cursor.

## Decisions

- **Exercises are soft-deleted on the device**, both for a local delete and when a deletion is pulled. The row stays with `deleted_at` set and a Deletion Tombstone is still recorded for sync.
  - Readers that list Exercises (`getAll`/`getById`, so the list, pickers, Workout Templates via `resolveMembers`, CSV export and dedup) already filter `deleted_at IS NULL`.
  - Workout history (`getSets`) does not filter them, so past Sets keep their Exercise name and stay editable. New Sets can't be added to a deleted Exercise.
- **Only Exercises change.** Workouts, Sets and Workout Templates keep their hard delete. A deleted Workout's Sets *should* go with it.
- **No resurrection.** While its tombstone is unpushed, a soft-deleted Exercise is not revived by the live-rows pull. Afterwards, last-writer-wins applies: an older remote copy stays deleted, and a newer remote edit brings it back ([ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)).
- **One-time recovery.** Schema v7 resets the sets and exercise-deletion pull cursors once.
  - Re-pulling deletions inserts remotely deleted Exercises as soft-deleted rows, and the full sets re-pull then links the Sets the old cascade removed.
  - The sets pull skips (instead of holding back) Sets whose Workout is deleted, so it can't stall the cursor again.

## Considered options

- **Drop the `ON DELETE CASCADE` and keep hard deletes.** Rejected. Sets would point at an id with no row, so history would lose the Exercise's name, and every join would need to tolerate an orphan.
- **Delete Sets along with the Exercise on purpose, and fix the dialog copy.** Rejected. Workout history is the core value of the app, and one mistaken delete would erase it on every device.

## Consequences

- Soft-deleted Exercise rows stay on the device indefinitely. That is a small cost for four users.
- Exercises delete through `softDeleteExercise`. The older `softDeleteById` still hard-deletes the other entities despite its name, which predates this ADR.
- Sets that were never pushed before the old cascade removed them can't be recovered, because the server never had them.
- [ADR-0005](0005-exercise-deduplication.md)'s merged-away duplicates now go through the same soft delete.
