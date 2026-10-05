# UI/UX professionalization plan

Status: **executed** on branch `feat/ui-professionalization` (slices 0–3 and 5–8; slice 4 reduced to aligning the existing timer, see owner decision 4).
Owner feedback (2026-10-05): the UI feels overloaded. It should feel utilitarian, useful and professional.
Evidence base: [docs/research/ui-ux-inspiration.md](../research/ui-ux-inspiration.md), with sources for every pattern, and the screen audit below, captured on the Android emulator.

## North star

**A training logbook, not a dashboard of cards.** The app is used mid-set, one-handed, with sweaty hands. Every screen has one obvious primary action, and data sits in dense, aligned rows.

"Professional" means fewer *kinds* of things on a screen, not fewer numbers (see the Garmin Connect counter-lesson in the research, §0).

Principles we hold every screen to:

1. **One primary action per screen.** It uses the accent colour; everything else is neutral (HIG Buttons, M3 FAB).
2. **Rows over cards.** Use grouped list sections with hairline separators. A Card only for a genuinely standalone object, never as a default wrapper.
3. **Progressive disclosure.** Show the frequent things; push the rest one level down. At most two levels (NN/g).
4. **No chip walls.** Five options or fewer → segmented control. More → a row that opens a picker sheet (M3, HIG Pickers).
5. **One sheet at a time** (HIG Sheets). No confirm dialogs rendered as top-of-screen toasts.
6. **Quiet feedback.** No success toast for routine actions (adding a set, saving). Feedback appears in place: the row updates, a check animates.
7. **Gym-proof.** Tap targets of at least 48 dp. Tabular numerals for weights, reps and timers. Dark mode tuned to #121212 with desaturated accents.

## Audit of the current UI (2026-10-05, Android, light and dark)

| Screen | What makes it feel overloaded |
|---|---|
| **Workout dashboard** | Five stacked equal-weight cards (week, Plans, start, last workout, muscle balance). The primary action, Start, is the third card. Filler copy ("Ready to crush your goals today?"). Last workout duplicates History. Muscle balance is low-value at the top level. |
| **Start sheet** | Reasonable. It duplicates the dashboard Plans card. |
| **Workout session** | Empty state is a dashed box with filler copy. Header has four bare icon buttons (timer, finish flag, delete, back), and delete sits next to finish. Every set needs FAB → modal sheet → pick exercise → type → Add. A success toast fires on every set. No previous-performance hint. |
| **Log-set sheet** | Exercise picker list, inputs, drop-set section and footer all in one sheet. Picker rows show a "–" placeholder stat. The keyboard toolbar covers the Add button. |
| **Exercise library** | One big card per row with a camera placeholder and a drag handle. No search and no filters. Import/export icons sit in the header with equal weight to everything else. |
| **Exercise form** | About eight wrapping chip sections (primary muscle, secondary muscles, equipment) in one long scroll. Photo is a large dashed box. The core fields are lost in the selection UI. |
| **Exercise detail** | Labelled fields stacked as text, then a chart. No PR / summary hierarchy. |
| **Plan editor** | Two cards. The whole library is shown as a checklist instead of "the plan's exercises + Add". |
| **History** | One card per workout, showing only date and time: no exercises, sets or volume. Calendar is a separate screen, with Sunday as the first day while the dashboard week starts on Monday (inconsistent; cs locale expects Monday). |
| **Settings** | Language with flag emoji; Appearance as three rows; Account. Acceptable, but loose. |
| **Global** | Confirm dialogs render as toasts at the top of the screen, far from the thumb. Success toasts for routine actions. Border plus radius on almost every container. Primary green is used for buttons, links, tags, chips and success alike, so it signals nothing. |

## Target experience, screen by screen

Each item lists the pattern and its source section in the research doc.

### 1. Workout tab (home), research §1–2
- **Top: one start/resume module.**
  - When idle: a "Start workout" primary button, with up to three plan rows under it (name · exercise count · muscle groups), plus "Free workout".
  - While a workout runs: a high-contrast resume bar "Resume · 00:42 · 12 sets" that is also pinned on other tabs.
  - The separate Plans card and the start sheet merge into this module. Plan management moves to a "Plans" row → plans screen.
- **Then: a compact week strip** with the streak folded in as one label ("3 this week · 5-week streak").
- **Then: last workout as a single row** that links to its detail.
- **Muscle balance moves to History → Stats.** Optionally a one-line "Least trained this week: Back" row stays.
- **Cut:** filler copy, duplicated stats, link-only cards.

### 2. Live workout, research §3. This is the biggest UX win
- **Inline set rows per exercise:** `SET | PREVIOUS | KG | REPS | ✓`.
  - Rows are pre-filled from the previous performance of that Exercise, so a typical set is one tap on ✓. Tapping PREVIOUS copies it.
  - The bodyweight timer, cardio time and distance columns follow the existing PrimaryMetric / `setInputLayout` rules.
- **Exercise blocks:** "Add exercise" is a row at the end of the list, opening the unified picker (§4). For a Planned Workout it offers the plan's exercises first. The FAB goes away.
- **Set types:** drop set / pyramid becomes a set-type marker in the SET column ("D"). Its SubSets expand under the row.
- **Rest timer:** one slim bar above the bottom inset, `−15 · 1:24 · +15 · Skip`. It auto-starts on ✓; the standalone timer modal becomes secondary.
- **Header:** title, elapsed time, and **Finish** (trailing). Delete and timing edits move into a ⋯ overflow menu.
- **Finish:** confirmation if sets are unchecked, then a summary sheet (duration, sets, volume, PRs, "Save as plan" for a free workout).
- **Drafts:** unchecked rows need a decision.
  - Either they live in UI state only and only ✓ persists a Set, so the schema is unchanged.
  - Or they persist as drafts so an app kill doesn't lose them.
  - Decide at kickoff: the first is cheaper, the second more robust.

### 3. Exercise form, research §5
- **Name** (large field) and a **photo thumbnail** (small, tap to add or replace) at the top.
- **Type** as a segmented control: Weight / Bodyweight / Cardio. The bodyweight Reps/Timer mode is a second segmented control shown only for Bodyweight.
- **A grouped list section of rows, each with its value on the right and a chevron:**
  - Primary muscle › *Biceps*
  - Other muscles › *Forearms, Front delts*
  - Equipment › *Dumbbells*
- **Each row opens the shared selection sheet** (§5): search, sections by Muscle Group, checkmarks; single select closes on tap.
- **Delete** is a destructive text button at the bottom in edit mode, not a header icon.

### 4. Unified exercise picker, research §4
- **One component**, used by the live workout ("Add exercise"), the plan editor and, as a mode, the library.
- **Layout:** search on top, then one row of filter chips (Muscle ▾, Equipment ▾). Rows show name · "muscle · equipment" and an optional last-performance stat.
- **Selection:** multi-select with a sticky "Add (n)" button.
- **Planned Workout:** shows the plan's exercises as the first section.

### 5. Shared primitives that replace ad-hoc UI
`ListSection` + `ListRow` (inset grouped, hairline separators, value + chevron, 48 dp minimum height), `SegmentedControl`, `SelectSheet` (single/multi, search, sections; built on the existing sheet motion), `ExercisePicker` (above), `SetRow`, `RestTimerBar`, `TopBar` actions with an overflow menu, `ConfirmDialog` (a centred or bottom action sheet, replacing confirm-as-toast), `StatRow`.

### 6. Exercise library and detail, research §6
- **Library:** search plus Muscle/Equipment filters at the top. Rows are compact list rows (thumbnail 40 dp, name, "muscle · equipment"). Drag-to-reorder moves behind an "Edit order" mode, and import/export behind a ⋯ menu.
- **Detail:**
  - A header with the name and "muscle · equipment".
  - A PR line (best set, estimated 1RM or best duration per PrimaryMetric).
  - One chart with a metric switcher and a time range.
  - Then history rows (date · best set · sets). Edit sits in the header.

### 7. Plans, research §2
- **Plans list screen:** rows of name · count · muscle groups.
- **Plan editor:** a name field, then the plan's exercises as rows (swipe or ⋯ to remove), plus "+ Add exercises" opening the picker. The owner chose earlier that plans are unordered membership (ADR-0006). Keep that; ordering is out of scope.
- **"Save as plan"** from a finished free workout.

### 8. History, research §7
- A **List | Calendar** segmented control on one screen, replacing the separate calendar route.
- **Week starts on Monday** everywhere (cs and en-GB convention; the dashboard already does).
- **List rows:** date, plan name, duration, sets, volume, and the top three exercises. Tapping opens the workout detail, which uses the same layout as the live workout in read-only mode, with editing behind ⋯.
- **Stats:** muscle balance (horizontal bars), weekly volume and streak live here.

### 9. Empty states and onboarding, research §8
- Each empty state is one line plus one action ("No exercises yet · Add exercise"). No dashed boxes, no motivational filler copy.
- Onboarding stays short. Teach in context: for example, the first set row shows a one-time hint "Tap ✓ to log".

### 10. Visual foundations, research §9–10
- **Type scale:** about four roles (Title, Headline, Body, Caption) on the existing `FontSize`/`FontWeight` tokens, plus a `numeric` style with tabular figures for every number in sets, timers and stats.
- **Colour:** one accent (current green) used only for the primary action, completed ✓ and selection. Links and secondary actions use neutral text.
  - Fix dark-mode emphasis levels (87/60/38 %) and check 4.5:1 contrast.
  - Keep #121212 as the dark background, the same token the app uses today.
- **Containers:** fewer borders. Grouped sections use the surface colour with no outline; cards only where an object stands alone.
- **Spacing:** 16 dp page gutter, 8/12/16 rhythm inside rows, 48 dp minimum touch height.
- **Motion:** keep the existing Motion tokens.
  - ✓ tick about 100 ms, sheets 200–300 ms, nothing over 500 ms.
  - No motion on frequent interactions such as typing, and no list float-ins on revisit (already the rule).
  - Optional light haptic on ✓ only.

## Phasing

All slices go on one feature branch (`feat/ui-professionalization`), with one focused commit or a few logical commits per slice and a single PR at the end. Every slice:

- ships behind no flag;
- keeps `yarn check` green;
- is verified on the Android emulator (Pixel_9a) in light and dark;
- gets before/after screenshots in the PR description;
- uses the vocabulary skill for naming and copy;
- is validated with the validate-branch skill before the PR.

| # | Slice | Depends on | Notes |
|---|---|---|---|
| 0 | **Foundations:** `ListSection`/`ListRow`, `SegmentedControl`, `SelectSheet`, `ConfirmDialog`, `TopBar` overflow; numeric text style; accent-usage audit; drop routine success toasts | none | No screen changes besides the toast/confirm swap. Pure components get logic tests. |
| 1 | **Exercise form** → rows plus `SelectSheet` | 0 | Smallest visible win; replaces the chip walls the owner flagged. |
| 2 | **Unified ExercisePicker** (search, filters, multi-select), used by the plan editor | 0 | The plan editor becomes "plan's exercises + Add". |
| 3 | **Live workout: inline set rows**, previous performance, add-exercise row, overflow header, finish summary | 0, 2 | Biggest change. Needs a `getPreviousPerformance(exerciseId)` query and the draft decision (§2). Keep `setPayload`/`dropSet` logic and reuse its tests. |
| 4 | **Rest timer bar** auto-started by ✓ | 3 | Reuse `TimerProvider`. Android ongoing notification optional, as a follow-up. |
| 5 | **Workout tab** restructure (start/resume module, compact week, last-workout row) | 2 | Muscle balance moves out in slice 7. |
| 6 | **Library and detail** (search, filters, compact rows, edit-order mode, ⋯ menu; detail PR line plus chart switcher) | 0, 2 | |
| 7 | **History** List/Calendar toggle, Monday-first, richer rows, stats section with muscle balance | 0 | Removes the `calendar` route; update links. |
| 8 | **Empty states and polish pass** across all screens; dark-mode contrast check | all | Final sweep; screenshot every screen in both themes. |

Slices 1, 2 and 6 can be parallelised by separate agents in worktrees once slice 0 is merged into the branch.

## Constraints and guardrails
- **No data-model changes** unless a slice requires them (only slice 3 possibly does, for drafts). Any schema change follows the additive-migration and Supabase-first rules (ADR-0006, ADR-0007) and needs owner approval.
- **Domain language** follows CONTEXT.md (Workout, Set, Workout Template = "Plan" in the UI, Muscle, Equipment).
- **Motion** uses the shared tokens and wrappers (Motion.ts, `Appear`, `Collapsible`, `ListItemAppear`), with one layout owner per region.
- **Components** carry no external margins; parents space children with `gap`.
- **Android first.** Never edit sources with `sed -i` while Metro runs (it misses the change). Verify the served bundle before trusting an on-device check.
- **Copy** in both `en.json` and `cs.json`; locale parity tests must pass.

## Owner decisions (kickoff, 2026-10-05)
1. **Draft sets in the live workout:** stored in a device-local key-value store keyed by the Workout uuid. They survive an app kill, need no schema change and never sync. Only ✓ writes a real Set.
2. **Previous performance:** from the last finished Workout containing that Exercise, regardless of plan.
3. **Volume:** shown in history and the finish summary, counting `weight`-type Sets only (kg × reps). Bodyweight is not counted, because body weight is not stored.
4. **Rest timer:** first answered as one global default; later in the session the owner chose to leave the timer as it is (no rest bar, no auto-start on ✓), so slice 4 only aligned the existing timer with the shared sheet, segmented control and type.
5. **Start sheet:** folded fully into the Workout tab module ("Start workout" plus up to three plan rows, then "All plans ›"). The separate sheet goes away.

## Kickoff prompt for the new session

> Work on the UI/UX professionalization of fitapp per `docs/plans/ui-ux-professionalization.md` and the research in `docs/research/ui-ux-inspiration.md`. Branch `feat/ui-professionalization` already exists with these docs.
>
> 1. Ask me the open questions from the plan first.
> 2. Then execute the slices in order, starting with slice 0 (foundations).
> 3. For each slice:
>    - follow CLAUDE.md, `.claude/commit-style.md` and the memory rules;
>    - verify on the Android emulator (Pixel_9a) in light and dark, and post before/after screenshots;
>    - keep `yarn check` green;
>    - run the validate-branch skill before the final PR;
>    - use the vocabulary skill for naming and copy.
> 4. Don't push or merge until I approve.
