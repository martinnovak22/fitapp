---
status: accepted
---

# Last-writer-wins conflict resolution in sync

When a pull brings down a remote row that also exists locally, the conflict is resolved by comparing `updated_at` timestamps — whole-row, last writer wins. The decision lives in `shouldSkipRemoteRow` (`src/data/sync/remoteRowReconcile.ts`), called from the exercises, workouts, and sets pulls in `src/data/sync/syncService.ts`.

The exact rule: the remote row is skipped only when the local row is unsynced (`sync_status` `dirty` or `failed`) **and** strictly newer than the remote `updated_at`. In every other case the remote row overwrites the local one — including when the local row is dirty but older, and on exact timestamp ties. There is no field-level merge; the losing side's row is replaced wholesale.

## Considered options

- **Field-level merge** — diff individual columns and combine both edits. Rejected: the entities are small (a set is weight/reps/position; a workout is times and a note), and most edits touch the fields that matter together, so a merged row is as likely to be nonsense as either original.
- **CRDTs** — conflict-free replicated types per field. Rejected: heavy machinery for a single-user app where conflicts require the same person editing the same row on two offline devices.
- **Server-side versioning / vector clocks** — track causality on the server and surface true conflicts. Rejected: needs schema and server logic we don't otherwise want, to solve a case we expect to be rare and low-stakes.

For a single-user fitness tracker, the worst outcome of LWW is losing one device's edit to a single workout row — annoying, recoverable by re-entering, never corrupting.

## Consequences

- Two devices editing the same row while offline is a silent-loss window: whichever side pushed last (or skipped the pull via the dirty-and-newer rule) wins, the other side's edit disappears with no warning.
- Correctness depends on device clocks being roughly sane; a device with a badly wrong clock can win (or lose) conflicts it shouldn't.
- Worth revisiting if the app grows shared data (coach/client, shared plans), multi-device becomes a primary workflow, or any entity gains fields where losing half an edit is costly.

## Sign-out racing an active push

A principal change mid-push (sign-out or account switch while the outbox is draining) aborts the cycle, leaving already-acked rows `synced` and the rest `dirty` — deliberately, with no rollback. This split state is benign and self-healing: the dirty rows persist in SQLite, sync does not run while signed out, and when the same account signs back in the outbox picks them up and the push converges. Any overlap with edits made on another device in the meantime resolves by the same last-writer-wins rule above, and other principals never see the rows because every query is principal-scoped. No reconciliation pass is needed (decided in issue #50).
