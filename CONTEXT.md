# FitApp

A local-first fitness tracker: workouts and exercises are recorded into an on-device SQLite database and optionally synced to a remote account (see [ADR-0003](docs/adr/0003-local-first-architecture.md)). This glossary fixes the domain language so code and copy stay consistent.

## Language

**Workout**:
A single training instance owned by a principal — has a date, optional start/end time, and a set of recorded Sets.
_Avoid_: Session (a Workout is never a "Session"), training, log entry

**Active Workout**:
A Workout in the `in_progress` state — the one currently being built. Becomes a plain Workout once finished.
_Avoid_: Active Session, current session

**Auth Session**:
The authenticated login state of a principal (Supabase auth). The only concept the word "Session" may refer to.
_Avoid_: using bare "Session" for a Workout

**Set**:
One recorded entry within a Workout for a given Exercise (e.g. "Set 1"), carrying its own metrics and position.
_Avoid_: entry, rep set

**SubSet**:
A nested layer inside a Set (stored in the Set's `sub_sets`), used to express multi-stage efforts within a single Set.
_Avoid_: drop, mini-set

**Drop Set / Pyramid Set**:
Not distinct entities — both are simply a Set containing multiple SubSets. They differ only in how the user fills them in (descending vs ascending load); the data layer stores them identically with no type discriminator.
_Avoid_: treating these as typed set variants

**Exercise**:
A named movement a user records Sets against (e.g. "Bench Press"), owned by a principal and carrying an ExerciseType.
_Avoid_: movement, lift

**ExerciseType**:
The stored kind of an Exercise — one of `weight`, `bodyweight`, `bodyweight_timer`, `cardio`. Determines the PrimaryMetric.
_Avoid_: exercise kind, category

**Tracking Mode**:
The user-facing reps-vs-timer toggle shown only for Bodyweight exercises; it selects between the `bodyweight` (reps) and `bodyweight_timer` (timer) ExerciseTypes. Not stored separately and not a synonym for ExerciseType as a whole.
_Avoid_: using "Tracking Mode" for weight/cardio or as a stored field

**PrimaryMetric**:
The derived headline metric of an Exercise — one of `weight`, `reps`, `distance`, `duration` — computed from ExerciseType. Drives which inputs a Set shows and how the best Set is chosen.
_Avoid_: main metric, dominant (when referring to the metric itself)

**Principal**:
The current identity that owns local data and drives sync. Has one of four modes: `guest`, `account`, `signed-out`, `local`. Distinct from the Auth Session (the login mechanism).
_Avoid_: user (when you mean the owning identity), current user

**Guest**:
A Principal with no account (`user_id IS NULL`) that still syncs to an anonymous remote identity.
_Avoid_: anonymous user, local user

**Account**:
A Principal backed by a signed-in user, scoped by a real `user_id`.
_Avoid_: registered user, member

**Signed-out**:
The non-syncing Principal mode when remote is available but no one is logged in.

**local (legacy mode)**:
A non-syncing Principal mode forced by the build-time env toggle `EXPO_PUBLIC_DATA_MODE=local`; predates accounts and is unused in the shipping (`remote`) config. Functionally equivalent to **Signed-out**.
_Avoid_: relying on this as a distinct runtime state — it is a dormant build mode

**Principal Transition**:
An atomic change of Principal (guest↔account, account switch, sign-out). Applies a Migration Policy and runs in a single SQLite transaction. See [ADR-0002](docs/adr/0002-guest-to-account-data-migration.md).

**Migration Policy**:
How a Principal Transition treats existing local data — `preserve` (re-own the Guest's unowned rows into the new Account) or `clear` (wipe local data). `preserve` is valid only for guest→account.
_Avoid_: merge strategy

**Merge guest data**:
The user-facing label for choosing the `preserve` Migration Policy when a Guest signs into an Account. Opt-in and device-scoped.
_Avoid_: treating this as a separate mechanism from the Migration Policy

**Sync Status**:
The per-row lifecycle state of an Exercise/Workout/Set/Tombstone: `dirty` (local change awaiting push) → `synced` (acknowledged by remote); on failure `failed` (retryable, capped at 5 attempts) → `blocked` (terminal, given up on). `local` is a legacy initial state (pre sync-metadata backfill) and a retirement candidate.
_Avoid_: confusing with the app-level sync indicator (see below)

**Outbox**:
The queue of rows eligible to push — those whose Sync Status is `dirty` or `failed`. `blocked` and `synced` rows are excluded. The give-up rule that parks rows as `blocked` is [ADR-0004](docs/adr/0004-outbox-give-up-policy.md).
_Avoid_: queue, push list

**Deletion Tombstone**:
A record that an entity was deleted, kept so the deletion propagates to remote after the local row is gone.
_Avoid_: delete marker, gravestone

**Sync State**:
The singleton row tracking the syncing process itself — `is_syncing`, `outbox_size`, `blocked_size`, `last_success_at`, `last_error`.
_Avoid_: sync status (that is the per-row term)

## Relationships

- A **Workout** has many **Sets**
- A **Set** belongs to one **Exercise** and has zero or more **SubSets**
- Every **Workout**, **Exercise**, and **Set** is owned by a **Principal** (`user_id` = the Account's id, or NULL for a Guest)

## Example dialogue

> **Dev:** "When a Guest signs in and there's already data on the account, does the **Merge guest data** toggle overwrite it?"
> **Domain expert:** "No. Merge picks the `preserve` **Migration Policy**, which only re-owns the Guest's unowned rows (`user_id IS NULL`) into the **Account** and marks them `dirty`. The account's own rows are never touched — and account→account always `clear`s, so one account's data can't leak into another."
>
> **Dev:** "A Set keeps failing to push — is it still in the **Outbox**?"
> **Domain expert:** "Once its **Sync Status** flips to `blocked` (terminal, after 5 failed attempts), no — the Outbox only holds `dirty` and `failed` rows. It shows up in `blocked_size` on the **Sync State** instead."

## Flagged ambiguities

- "Session" was used for three things: an in-progress **Workout** (`activeSession`, `finishSessionConfirm` copy), the **Auth Session** (Supabase login), and UI edit state (`useWorkoutSession`, `WorkoutSessionScreen`). Resolved: the entity is always **Workout**; "Session" is reserved for the **Auth Session**. The `useWorkoutSession`/`WorkoutSessionScreen` names predate this resolution — treat as legacy aliases, not a domain entity.
- "local" names two unrelated things: the legacy **Principal** mode and a row's `sync_status = 'local'` (the pre-sync initial row state). Both are legacy/retirement candidates. Different axes — identity vs row sync state.
- "sync status" names two unrelated things: the per-row **Sync Status** (`dirty`/`synced`/`failed`/`blocked`) and the app-level `SyncStatusState` indicator (idle/syncing) shown in the UI. Different axes — row state vs process state.
- The `SyncStatus` type at `src/db/sync.ts` omits `'blocked'`, even though `'blocked'` is a live persisted row state used throughout `syncService.ts`. The type is out of date — fix candidate.
