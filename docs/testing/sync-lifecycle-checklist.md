# On-device sync lifecycle checklist

Manual regression pass for the sync layer (issue #55). Run it on a physical Android device — the regressions this catches (native SQLite crashes, AppState races, real network flapping) do not reproduce in the unit suite or reliably on iOS simulators.

Tooling decision: a written checklist, deliberately. The flows below need real camera hardware, OS-level airplane mode, and two physical devices; a Maestro/Detox suite covering them would be expensive to keep honest and was rejected as over-engineering.

**When to run:** before a release that touched `src/data/sync/`, `src/db/`, or the photo flows. Takes ~20 minutes with two devices (A and B) signed into the same account.

**Setup:** debug or release build of current master on both devices, a test account, network you can toggle (airplane mode works).

## 1. Fresh login hydration

1. On device A with existing synced data (a few workouts with sets, an exercise with a photo): sign out, then sign back in.
2. ☐ The dashboard shows a full-screen centered spinner — not an empty state, not a partial week strip — until the first sync cycle finishes.
3. ☐ After the spinner: last-workout recap and muscle balance render populated (sets arrived, not just workouts).
4. ☐ Exercise photos appear within a few seconds of the dashboard settling (background hydration).
5. Kill and relaunch the app. ☐ The dashboard renders local data instantly — no hydration spinner on a warm start.

## 2. Offline mutations → reconnect push

1. Enable airplane mode. Create a workout, add sets to it, edit an existing set, create an exercise.
2. ☐ All edits apply instantly in the UI; the sync banner shows a failure/offline state, not a crash.
3. Kill and relaunch the app while still offline. ☐ The edits are all still there.
4. Disable airplane mode and wait for the next cycle (or background/foreground the app).
5. ☐ The banner clears; on device B, all the offline edits arrive on its next pull.

## 3. Camera open during an active sync cycle

The historical crash: opening the camera backgrounds the app while sync statements are in flight, and an eager connection close crashed natively.

1. On device A, get a sync cycle running (easiest: reconnect right after step 2 so a push+pull is in flight), then immediately open Add Exercise → take photo.
2. ☐ No crash, no sync-failed banner caused by the camera alone.
3. Take the photo, save the exercise. ☐ The photo shows on the exercise; no orphaned banner state.
4. Deny camera permission once and retry. ☐ The permission toast shows; no crash.

## 4. Sign-out mid-cycle

1. On device A, queue several offline edits (airplane mode), then reconnect and immediately sign out while the push is running.
2. ☐ The app lands on the login wall once — no double navigation, no replayed login entrance animations.
3. Sign back in with the same account. ☐ The previously dirty rows push on the first cycle; device B converges to the same state (per ADR 0001, last-writer-wins).

## 5. Cross-device photo sync

1. On device A, create an exercise with a camera photo. Wait for a sync cycle.
2. ☐ Device B shows the photo after its next pull (background download — may lag the row by a few seconds).
3. On device A, replace the photo. ☐ Device B swaps to the new photo after its next pull; the old image does not linger.
4. On device A, remove the photo (save without it). ☐ Device B drops the photo.
5. On device A, delete the exercise. ☐ It disappears from device B; no broken image placeholders anywhere.

## 6. Reinstall self-heal

1. On device A, uninstall and reinstall the app, sign in.
2. ☐ Hydration pull rebuilds the data; exercise photos re-download (first hydration pass repairs missing files).
3. ☐ Subsequent cycles are quiet — no repeated re-downloads (steady-state hydration matches nothing).

## Recording results

Note the date, build, and devices at the top of a pass; file any failure as a `bug` issue referencing the checklist section number.
