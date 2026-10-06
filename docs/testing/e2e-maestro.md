# End-to-end tests (Maestro)

A small [Maestro](https://maestro.mobile.dev) suite drives the main flow on an Android emulator: a new guest logs a workout from an empty library and finds it on the dashboard and in History. It catches what the unit suite cannot see: navigation, dialogs, focus and keyboard, and data surviving an app restart.

It runs locally only. It is not part of CI, because an Android emulator in GitHub Actions is slow and flaky.

## What it covers

| Flow | Checks |
|---|---|
| `01-first-workout` | Guest start, onboarding skip, creating an exercise from the empty picker, two sets and a drop set, the summary volume, the dashboard recap, the History list and detail |
| `02-finish-guards` | Finish on an empty workout offers Discard; Cancel keeps it; an unchecked row is named and dropped; a discarded workout leaves no trace |
| `03-resume-and-edit` | A running workout and its unchecked rows survive an app restart; an edit to a logged set typed right before Finish is saved |

Sync, sign-in and photos are out of scope; see [the sync checklist](./sync-lifecycle-checklist.md).

## Running it

Prerequisites: the Maestro CLI (`curl -fsSL "https://get.maestro.mobile.dev" | bash`), Java 17, and a running Android emulator with its system language set to English (the flows match English copy, and a fresh install follows the device language).

```bash
yarn e2e --build
```

builds a release APK (no Sentry events, no source-map upload), installs it on the emulator and runs the suite. Later runs on the same build skip `--build`:

```bash
yarn e2e
```

`--repeat N` runs the suite N times in a row, to check a change for flakiness.

The script picks the first running emulator, or the one in `E2E_DEVICE`. It refuses a physical device: every flow starts by clearing the app's data.

## Writing flows

- Select elements by their accessibility label or visible text, the way a screen-reader user would find them. A failing selector often means a missing or wrong label in the app.
- Use a `testID` only where text cannot tell elements apart. For example, the confirm dialog's buttons have `confirm-dialog-confirm` and `confirm-dialog-cancel`, because its backdrop is also a "Cancel" button.
- Shared steps live in `.maestro/subflows/`; only `.maestro/flows/` runs as tests.
