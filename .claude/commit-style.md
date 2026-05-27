# Commit Message Style

Format used in this repo. Follow it for every commit you create.

## Shape

```
<type>(<scope>): <imperative title in lowercase>

- <bullet, one per sentence>
- <bullet>

- <new bullet group after a topic shift>

Closes #<N>. Refs PRD #<N>.
```

## Rules

### Subject line

- Type and scope follow Conventional Commits: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`. Scope is the module or area: `sync`, `principal`, `auth`, `db`, `history`, etc.
- After the colon, prefer lowercase first letter for the rest of the title: `feat(sync): unified write seam` not `feat(sync): Unified write seam`. Class and module names keep their natural casing.
- Imperative mood: `add X`, `route Y through Z`, `drop dead table`. Not `added`, `adds`, `adding`.
- Under ~70 characters. If you need more, the second clause belongs in the body, not the title.

### Body

- **Always bullets, never prose paragraphs.** One sentence per bullet. Long compound sentences stay in one bullet — do not sub-bullet inline em-dash lists like "guest→account, account↔account, account→guest".
- Bullet capitalization: prefer lowercase first letter where possible. When the bullet naturally opens with a proper noun, class name, or module name (e.g. `SyncStatus`, `useAuth`, `RemoteWriter`), keep its natural casing.
- **Blank line between bullet groups when the topic shifts.** Bullets that share a topic stay together; a meaningful shift gets a blank line. Don't separate every bullet.
- Wrap at a comfortable width but don't fight the editor. Mid-bullet line breaks are tolerated.

### Trailers

- `Closes #N.` and `Refs PRD #N.` live on a single non-bulleted line at the bottom, separated from the body by a blank line.
- **No `Co-Authored-By: Claude` trailer.** Authorship is in `git log` already; the trailer adds noise.
- Other trailers (`Fixes #N`, `See #N`) follow the same single-line discipline.

## Examples

Good:

```
feat(sync): unified write seam via executeWriteTransaction

- The remaining un-transactional sync writes — updateSyncState and Outbox ack/fail — now go through executeWriteTransaction.
- SQLite has exactly one writer; a concurrent user-update + sync-ack on the same row produces a consistent final state.
- UnifiedWriteSeam test asserts the invariant.

Closes #6. Refs PRD #1.
```

Good (topic shift gets a blank line):

```
feat(sync): ack-on-persistence and batched parent ID lookups

- RemoteWriter pairs each upsert response with its request by uuid; if the server returns nothing, the Outbox sees a structured failure instead of a silent ack.
- RemoteIdResolver batches parent uuid→id lookups once per cycle.
- RemoteAdapter is the only seam to Supabase; FakeSupabaseAdapter plays the same role in tests.

- Introduces PushPipeline as the push half of SyncCycle.

Closes #5. Refs PRD #1.
```

Bad (prose paragraph, capitalized after colon, co-author trailer):

```
feat(sync): Unified Write Seam

The remaining un-transactional sync writes now go through
executeWriteTransaction. SQLite has exactly one writer. The
UnifiedWriteSeam test asserts the invariant.

Closes #6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
