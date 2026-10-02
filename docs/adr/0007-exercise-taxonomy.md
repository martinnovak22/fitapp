---
status: accepted
---

# Exercise taxonomy: Muscles and Equipment as fixed keys, derived from legacy text at read time

`exercises.muscle_group` was free text, and real data mixed Czech and English, spelling variants and lists: `hrudnik` / `hrudník` / `chest`, `záda` / `back`, and `prsa, triceps, rameno`. Filters, sections and the dashboard's muscle balance could not count by it reliably. We replace it with a fixed taxonomy along two independent axes, so that strength, bodyweight, machine and cardio Exercises can all be described without over-modelling.

## Decisions

- **Muscles are two-level: Muscle Group → specific Muscle**, defined once in code (`src/domain/exerciseTaxonomy.ts`) with localized labels.
  - A group key is itself a valid Muscle ("legs in general"). That is how coarse legacy values map without guessing.
  - Groups with nothing finer (chest, full body, cardio) are just their group.
- **An Exercise has one required primary Muscle and optional secondary Muscles.** The Muscle Group is derived from the primary one; secondary Muscles are descriptive and do not count towards the group balance.
- **Equipment is a second, optional axis.** It is independent of ExerciseType: ExerciseType says what gets recorded (weight, reps, time, distance); Equipment says what the Exercise is performed with.
- **Storage:** new columns `primary_muscle` (key), `secondary_muscles` (JSON array locally, `jsonb` remotely) and `equipment` (key). Unknown keys are ignored when read, but kept in storage (see below).
- **No data migration.** Exercises saved before the taxonomy keep their `primary_muscle` NULL.
  - Readers go through `resolveExerciseMuscles`. It uses the explicit keys when they are present; otherwise it maps the legacy `muscle_group` text with one alias table (first recognized entry → primary, the rest → secondary).
  - The raw legacy text is never overwritten until the user saves the Exercise.
- **Older clients keep working, and their edits win.** On save, the new client also writes the derived group key into `muscle_group`. Clients that don't know the new columns ignore them, and their upserts leave them untouched.
  - A taxonomy-aware client *always* writes that mirror. So a `muscle_group` that doesn't match the primary's group can only be a later edit by an older client. Readers then fall back to the legacy text, so that edit is shown instead of silently lost.
- **Unknown keys are kept, not dropped.** Values written by a newer client (keys this one doesn't know) are stored raw and pushed back unchanged. Only readers narrow them (`asMuscleKey`, `asEquipment`).
  - A reorder or any other edit that doesn't touch the taxonomy never erases them. The exercise form sends Muscles and Equipment only when the user changed them.
  - Changing them on purpose replaces them, which is intended.
- **The v6 upgrade resets the Exercises pull cursor once.** Rows pulled before the columns existed then receive the keys other devices set. Without the reset, the next local write would push nulls over them.
- **CSV import never makes an Exercise less specific.** A re-import matches by name, type and Muscle identity: a group matches its own Muscles, but two different specific Muscles don't match.
  - It never replaces explicit Muscles with their coarser group.
  - A row naming the same primary without secondaries keeps the existing secondaries. A row that lists secondaries replaces them.
- **De-duplication back-fills Muscles only into a survivor that has none.** A survivor that resolves to a Muscle, including one an older client just edited, keeps it.

## Considered options

- **Backfill the new columns in a migration** (SQL on Supabase, or locally followed by a push).
  - Local backfill plus push would bump `updated_at` on every Exercise. Under last-writer-wins ([ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)), a device holding a stale copy could then overwrite a newer edit made on another device.
  - A server-side backfill would duplicate the alias table in SQL, and would still bump `updated_at` (pulled over unsynced local edits) unless it ran with triggers disabled.
  - Read-time derivation gives the same result with zero rows touched.
- **Free-text but normalized**: rejected. It cannot express "triceps belongs to arms", and new spellings keep appearing.
- **User-defined muscles/equipment as a synced entity**: rejected for now as over-modelling for four users. The registry is code, so adding a key is a one-line change plus its labels.
- **Reuse the `muscle_group` column for the primary key**: rejected. Old clients write free text into it, so the column would mix two vocabularies.

## Consequences

- Every reader of an Exercise's Muscles or group must use `resolveExerciseMuscles` / `resolveExerciseMuscleGroup`, never `muscle_group` directly.
- An Exercise whose legacy text doesn't map (none in production at the time of writing) reads as unclassified until edited. The form then requires a primary Muscle.
- The Supabase migration only adds nullable columns.
