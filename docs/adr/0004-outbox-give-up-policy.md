---
status: accepted
---

# Outbox give-up policy: parking rows as `blocked`

A push that fails is retried, but a row is not retried forever. `classifyFailure` (`src/data/sync/Outbox.ts`) parks a row as `blocked` immediately on a `permanent-rejection` (the server refusing the data with a 4xx), and parks transient failures (`network-error`, soft rejections, `missing-parent`, etc.) as `failed` — retried each cycle up to `MAX_SYNC_ATTEMPTS` (5) — after which they too become `blocked`. Blocked rows are excluded from the Outbox and surfaced only as a quiet `blocked_size` count on the Sync State.

## Considered options

- **Retry forever** — rejected: a poison row (one the server will always reject) would re-fail every cycle, wasting battery and network and potentially wedging the Outbox behind it indefinitely.
- **Hard-delete a row that won't sync** — rejected: that is silent data loss; the user's local row is still valid even if it can't reach the remote.
- **Surface a blocking error UI** — rejected: too aggressive for a background process. A quiet count lets the user notice without interrupting a workout.

## Consequences

- A blocked row stops syncing **silently** — only the `blocked_size` count reflects it; there is no per-row error surfaced to the user today.
- Recovery is implicit: editing the row re-marks it `dirty` and re-enters the Outbox. There is no explicit "retry blocked rows" action yet — worth adding if blocked rows turn out to be common.
- `permanent-rejection` blocks on the first failure rather than after 5, because retrying data the server has definitively rejected is pure waste.
