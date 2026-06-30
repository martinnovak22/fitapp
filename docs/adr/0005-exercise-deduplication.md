---
status: accepted
---

# Exercise de-duplication as a standalone, review-gated maintenance action

[ADR-0002](0002-guest-to-account-data-migration.md) makes guest→account merge purely additive and uuid-keyed, knowingly producing duplicate Exercises (a guest "Bench Press" plus an account "Bench Press") and deferring de-duplication "to a future maintenance feature." This is that feature. We resolve it as a **standalone, user-initiated, re-runnable maintenance action** — **Exercise De-duplication** — that detects Duplicate Groups and merges each *confirmed* group onto a Survivor. It is **decoupled from the Principal Transition** and **never runs automatically**.

## Decisions

- **Match key: normalized name only, diacritic-folded.** `trim` → collapse internal whitespace → `toLowerCase` → Unicode NFD + strip combining marks (Czech accent folding). ExerciseType and muscle_group are review-time hints, **not** part of the key. Folding affects matching only — never stored data.
- **Always a review list; never auto-merge.** Detection is a pure, no-mutation function; merge executes only on per-group user confirmation. The survivor is pre-selected but user-overridable, and a user override is authoritative.
- **Survivor selection is a deterministic heuristic over same-principal rows**, priority: oldest `created_at` → most referencing Sets → `synced` over unsynced → lowest `uuid`. The survivor's own fields are kept untouched; duplicates are soft-deleted via the Deletion Tombstone path; their Sets are re-pointed onto the survivor and marked `dirty`.

## Considered options

- **Auto-merge exact post-normalization name matches** — rejected: the match key is deliberately aggressive (diacritic-folded, type-agnostic), and merging re-points Sets, so a wrong merge corrupts training history, not just a label. A human is always the final gate.
- **Run dedup inside the Principal Transition (at sign-in).** Rejected: ADR-0002 makes the transition one atomic SQLite transaction applying the Migration Policy, and a review list needs a human in the loop — a transaction cannot pause for confirmation. Coupling would force either auto-merge (rejected) or breaking that atomicity. A standalone action also covers dupes from any source (LWW double-seed, manual typo), not just sign-in.
- **Include type/muscle_group in the match key** — rejected: a stricter key leaves *more* real duplicates unmatched, the opposite of the goal; mismatched type on the same movement should still surface for review.

## Consequences

- By the time the action runs, a preceding preserve migration has already re-owned the guest's rows (`user_id IS NULL → userId`), so every row in a Duplicate Group is a same-principal row — there is no Account-vs-Guest distinction to select a survivor on. Survivor selection is purely the heuristic above.
- Discovery is **manual for v1** — no post-merge nudge. A nudge is a candidate if duplicates prove common (mirroring the ADR-0004 posture).
- Re-pointing Sets and soft-deleting duplicates marks rows `dirty` and writes Tombstones, propagating through the normal Outbox; this rides on last-writer-wins ([ADR-0001](0001-last-writer-wins-sync-conflict-resolution.md)) and does not fight it.
- Workouts and Sets are **not** matched independently (dated events rarely collide); Sets re-point implicitly when their Exercise merges. Workout collapse is out of scope unless exact-duplicate workouts prove to be a real problem.
