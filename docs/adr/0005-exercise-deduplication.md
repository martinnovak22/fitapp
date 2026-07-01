---
status: accepted
---

# Exercise de-duplication as a review step in the guest→account sign-in flow

[ADR-0002](0002-guest-to-account-data-migration.md) makes guest→account merge purely additive and uuid-keyed, knowingly producing duplicate Exercises (a guest "Bench Press" plus an account "Bench Press") and deferring de-duplication "to a future maintenance feature." This is that feature. We resolve it as a **review step in the guest→account sign-in flow**: right *after* the atomic Principal Transition commits, if duplicate Exercises exist, the user is shown a per-group review screen and merges each *confirmed* Duplicate Group onto a Survivor.

## Decisions

- **Trigger: the guest→account sign-in flow, after the transition commits — not inside it, and not a standalone action.** The review runs only when a preserve migration just re-owned the guest's rows and detection finds Duplicate Groups. It cannot run *inside* the Principal Transition, because ADR-0002 makes that one atomic SQLite transaction and a review list needs a human in the loop — a transaction cannot pause for confirmation. So detection + review + merge run as a follow-on step after the transition has committed.
- **Always a review list; never auto-merge.** Detection is a pure, no-mutation function; merge executes only on per-group user confirmation. The survivor is pre-selected but user-overridable, and a user override is authoritative.
- **Skippable.** Skipping a group leaves its duplicates in place (never data loss, per ADR-0002) and sign-in completes regardless. Nothing is forced at a sensitive moment.
- **Match key: normalized name only, diacritic-folded.** `trim` → collapse internal whitespace → `toLowerCase` → Unicode NFD + strip combining marks (Czech accent folding). ExerciseType and muscle_group are review-time hints, **not** part of the key. Folding affects matching only — never stored data.
- **Survivor selection is a deterministic heuristic over same-principal rows**, priority: oldest `created_at` → most referencing Sets → `synced` over unsynced → lowest `uuid`. The survivor's own fields are kept untouched; duplicates are soft-deleted via the Deletion Tombstone path; their Sets are re-pointed onto the survivor and marked `dirty`.

## Considered options

- **A standalone, re-runnable maintenance action (e.g. in Settings).** This was the original decision here; superseded. It would also catch duplicates from non-sign-in sources (two devices seeding the same Exercise via sync, a manual typo). Rejected in favour of the simpler surface: the owner wants dedup to happen only as part of the guest→account merge, accepting that other-source duplicates are never offered for cleanup.
- **Auto-merge exact post-normalization name matches** — rejected: the match key is deliberately aggressive (diacritic-folded, type-agnostic), and merging re-points Sets, so a wrong merge corrupts training history, not just a label. A human is always the final gate.
- **Run dedup inside the Principal Transition** — rejected: the transition is one atomic SQLite transaction; a review list cannot pause it for confirmation. Hence the post-commit follow-on step above.
- **Include type/muscle_group in the match key** — rejected: a stricter key leaves *more* real duplicates unmatched, the opposite of the goal; mismatched type on the same movement should still surface for review.

## Consequences

- By the time the review runs, the preserve migration has already re-owned the guest's rows (`user_id IS NULL → userId`), so every row in a Duplicate Group is a same-principal row — there is no Account-vs-Guest distinction to select a survivor on. Survivor selection is purely the heuristic above.
- **Duplicates from sources other than guest→account are never cleaned up** — there is no standalone action. Accepted, because ADR-0002 guarantees duplication is never data loss.
- Re-pointing Sets and soft-deleting duplicates marks rows `dirty` and writes Tombstones, propagating through the normal Outbox; this rides on last-writer-wins ([ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)) and does not fight it.
- Workouts and Sets are **not** matched independently (dated events rarely collide); Sets re-point implicitly when their Exercise merges. Workout collapse is out of scope unless exact-duplicate workouts prove to be a real problem.
