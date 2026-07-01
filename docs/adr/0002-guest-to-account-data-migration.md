---
status: accepted
---

# Guest→Account data migration policy

When a Guest signs into an Account, their local data should be savable — but data must never cross-contaminate between accounts. We resolve this with a single `MigrationPolicy` (`preserve` | `clear`) applied atomically on every Principal transition: `preserve` re-owns the Guest's unowned rows (`user_id IS NULL → userId`, marked `dirty` to re-sync) and is **only** valid for guest→account; every other transition (account→account, account→guest, sign-out, or a declined merge) uses `clear`, which wipes local data.

## Considered options

- **Always merge local data into the target account** — rejected: signing into account B on a device that last held account A's (or another guest's) data would silently absorb it into B.
- **Always clear on any identity change** — rejected: it throws away a Guest's work the moment they create an account, which is the one case where keeping the data is the whole point.
- **Field-level / id-based reconciliation across accounts** — rejected as overkill for a single-user app (see [ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)).

## Consequences

- The merge is **opt-in and device-scoped**: the "Merge guest data" toggle is shown only to Guests, with the hint to enable it only on your own device — on a shared device a Guest's data must not flow into someone else's Account.
- Safety is enforced in depth: `preserve` for any non-guest→account shape **throws** instead of falling back to a destructive default, and migration touches only `user_id IS NULL` rows, so an Account's rows are never re-owned by another. The transition runs in one SQLite transaction, so a mid-way failure leaves the local DB untouched.
- Declining the merge (or switching between accounts) **discards** the local data by design; the data still lives on its own account's remote and returns on next sync there.
- The merge is **purely additive** — everything is keyed by `uuid`, with no name-based reconciliation. Merging into an Account that already holds the same data (most visibly the Exercise catalog: a guest "Bench Press" plus an account "Bench Press") produces **duplicate rows**. This is accepted: it is never data loss, and Workouts/Sets are dated events that rarely collide. De-duplicating overlapping Exercises is deferred to a future maintenance feature rather than attempted automatically during the merge.
