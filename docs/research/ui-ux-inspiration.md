# UI/UX research for the fitapp professionalization

Research date: 2026-10-05. Scope: established strength-training apps (Hevy, Strong, Fitbod, JEFIT, Liftosaur, Boostcamp), broader fitness apps (Apple Fitness, Google Fit, Garmin Connect), Material Design 3, Apple HIG, and NN/g.

**How to read this.** Each claim links its source. Quotes are under 15 words. Lines tagged **Recommendation for fitapp** are my own synthesis and are not claims made by the source. Where I could not confirm a detail from a primary source, I say so.

**Source caveats.**
- The m3.material.io and Apple HIG pages render client-side. I read Apple HIG through Apple's own JSON content endpoint, which has the same text as the page. For Material 3 I used Google's official `material-components-android` docs on GitHub, the Android Developers Compose docs, and Google's dark-theme codelab.
- Hevy's and Fitbod's Zendesk help centres returned 403 to the fetcher. For Hevy I used the feature pages on hevyapp.com instead.

---

## 0. Cross-cutting principles (the "why" behind most of the patterns)

- **Put the most important thing at the top and leading edge.** Apple HIG Layout says to "place the most important items near the top" ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)).
- **Use progressive disclosure.** Too many choices make information harder to find, so HIG recommends disclosure, menus or nested views to cut what is shown at first ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)).
  - NN/g: "Initially, show users only a few of the most important options" ([NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)).
  - NN/g also notes that whatever appears on the first screen tells users it is important. It recommends at most 2 disclosure levels and using frequency of use to choose what stays visible.
- **Dashboards are for glancing, not exploring.** NN/g: dashboards give "at-a-glance information on which users can act quickly" ([NN/g Dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)).
  - Encode numbers with **length or 2D position**, so use bars and lines.
  - Avoid pie and donut charts, gauges and 3D. Don't rely on colour alone to show categories.
- **Don't add decoration during a workout.** HIG Workouts: avoid "information that's not relevant" during a session ([HIG Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts)).
  - Show an active session with a distinct look.
  - Make the controls large and easy to find.
  - Show a summary at the end, and discard sessions that are extremely short.
- **Decluttering is a real trend in this category.**
  - JEFIT moved swap, notes and superset into a three-dots menu so the "workout space got more expansive" ([JEFIT update](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)).
  - Liftosaur redesigned its workout screen to declutter it, expanding the current set so it can be read from a distance ([Liftosaur workout screen](https://www.liftosaur.com/features/workout-screen)).
- **Counter-lesson: don't trade away density for air.** Garmin Connect v5 moved to big cards and lots of whitespace, and users complained that "less information fits on the screen at once" ([Gadgets & Wearables](https://gadgetsandwearables.com/2024/04/24/garmin-connect-new-look/)). DC Rainmaker's walkthrough comments include "too much empty space, low density of data" ([DC Rainmaker](https://www.dcrainmaker.com/2024/01/garmin-connect-through.html)).
  - **Recommendation for fitapp:** professional means fewer *kinds* of things on a screen, not fewer numbers. Keep dense, aligned data rows, and remove decorative containers and duplicated stats.

---

## 1. Home / dashboard information hierarchy

### What the best apps do

**Hevy** splits "do" from "review".
- The **Workout tab** is the launchpad: "+ Start Empty Workout" at the top, then the routines list grouped in folders, with a folder icon beside the start button ([Hevy routines](https://www.hevyapp.com/features/gym-routines/), [Hevy start empty](https://www.hevyapp.com/features/start-empty-workout/)).
- Statistics live one level deeper, under **Profile → Statistics / Calendar** ([Hevy training chart](https://www.hevyapp.com/features/training-chart/), [Hevy gym progress](https://www.hevyapp.com/features/gym-progress/)).
- The Home tab is a social feed, which is not relevant to a group of four friends.

**Strong** has the same split. The Start Workout tab holds the empty workout plus templates ([Strong first workout](https://help.strongapp.io/article/229-my-first-workout), [Strong templates](https://help.strongapp.io/article/105-about-templates)). Analytics sit on a **Profile dashboard of widgets** that users add, reorder by long-press and drag, or remove ([Strong Profile Widgets](https://help.strongapp.io/article/239-profile-widgets)).
- The **Workouts per Week** widget has a goal target, which makes consistency a single bar chart.

**Apple Fitness (iOS 18+)**: the user can add, swap, reorder and remove the Summary cards through "Edit Summary" ([Apple Support](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios)).

**Google Fit** shows one hero: two rings (Steps and Heart Points), with smaller secondary metrics below. Tapping a metric opens a Day/Week/Month graph, and a single **+ FAB** adds an activity or starts tracking ([9to5Google](https://9to5google.com/2018/08/22/hands-on-google-fit-redesign/)).

**Garmin Connect** has a fixed four-section order: latest or planned activity → "In Focus" tiles → "At a Glance" tiles → plans and challenges. "Edit My Day" at the bottom lets users hide and reorder cards ([DC Rainmaker](https://www.dcrainmaker.com/2024/01/garmin-connect-through.html), [Garmin blog](https://www.garmin.com/en-CA/blog/general/unlocking-the-potential-of-garmin-connect/)).

**Liftosaur** keeps a compact **week strip** at the top: filled circles mark workout days and today has a border. Below it is one week-summary card with volume, sets and PRs; the deeper breakdowns sit behind "Show More" ([Liftosaur history](https://www.liftosaur.com/features/workout-history)).

### Why it works

There is one primary action (start or resume) and one glanceable status (this week), and everything analytical is one tap away. This is progressive disclosure driven by frequency of use ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)).

### Recommendation for fitapp (dashboard)

**Primary, top of the screen**
- One **start/resume card**.
  - While a session is active it becomes a high-contrast "Resume · 00:42:10 · 12 sets" bar.
  - Otherwise it reads "Start workout", with the last-used plan as a one-tap secondary option.

**Secondary**
- The **week strip**, with the streak folded into it as one label, e.g. "3 this week · 5-week streak". Hevy treats a streak as consecutive weeks with at least one session ([Hevy gym progress](https://www.hevyapp.com/features/gym-progress/)).
- **Last workout** as a single compact row (name, date, duration, sets) that links to its detail.

**Tertiary (move or demote)**
- **Muscle balance**: either move it to History/Stats, or keep it as a collapsed row that shows only the top imbalance. If it stays, use horizontal bars, which encode length; that matches NN/g.
- **Plans/Templates card**: move it into the start-workout sheet and its own screen. Hevy and Strong both show plans next to "Start", not as a separate dashboard card.

**Cut**
- Duplicated stats, such as the streak shown both in the strip and in a separate tile.
- Decorative headers.
- Any card whose only content is a link.

---

## 2. Starting a workout, routines/plans and the routine editor

**Start flow**
- Strong: "Empty Workout" or a "Workout Template (Routine)" ([Strong](https://help.strongapp.io/article/229-my-first-workout)).
- Hevy: two taps from the Workout tab ([Hevy](https://www.hevyapp.com/features/start-empty-workout/)).
- JEFIT added direct "Start Workout" access from My Plans to reduce friction ([JEFIT](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)).

**Routines list**
- Hevy groups routines in **folders** (for example PPL or 5×5); routines can be dragged between folders and shared ([Hevy routines](https://www.hevyapp.com/features/gym-routines/)).
- Strong lets you **save a finished workout as a template** from History ([Strong templates](https://help.strongapp.io/article/105-about-templates)). This is the lowest-effort way to create a plan.

**Routine editor**
- Hevy: name field at the top, then exercise blocks with target sets, reps and load and a rest time per exercise. A **three-dots menu per exercise** holds superset and notes. Exercises can be added, removed, swapped or reordered, and the same editor is used during live workouts ([Hevy routines](https://www.hevyapp.com/features/gym-routines/)).
- Hevy shows the **PREVIOUS column only during a live workout**, not in the routine editor ([Hevy previous values](https://www.hevyapp.com/features/track-exercises/)). This keeps the editor lean.
- Liftosaur uses long-press and drag to reorder. Selecting an exercise brings up an **action dock**: a pencil opens an editor sheet, and three dots offer duplicate, swap or delete ([Liftosaur program editor](https://www.liftosaur.com/features/program-editor)).

### Recommendation for fitapp (start and plans)

- **Start sheet.** Two large rows: "Empty workout", then the list of plans, each with a subtitle such as "6 exercises · last done Tue". It should be a modal bottom sheet, which M3 describes as an alternative to menus and dialogs on mobile ([M3 BottomSheet](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md)).
- **Plan editor.** Show the *selected* exercises as an ordered, reorderable list, and put a "+ Add exercises" row that opens the shared exercise picker (section 4).
  - The current design, a searchable checklist of every exercise grouped by muscle, makes the user read the whole library to edit a plan. Liftosaur and Hevy both show the plan's contents and open a picker separately.
- **"Save as plan"** on the finish summary and on workout detail, following Strong.

---

## 3. Live workout logging and set entry

### Layouts in the market

**Inline set table (Hevy, Strong, Fitbod)**
- Each exercise is a card with a header row of columns: **SET | PREVIOUS | KG | REPS | ✓** ([Hevy track workouts](https://www.hevyapp.com/features/track-workouts/)).
- "+ Add Set" sits under the rows, swiping a row left deletes it, and "+ Add Exercise" is at the bottom of the scroll.
- Strong and Fitbod are the same in essence: add set, enter weight and reps, tick the checkbox, swipe to delete ([Strong](https://help.strongapp.io/article/229-my-first-workout), [Fitbod editing](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod)).
- Strong also supports **drag to reorder exercises**.

**Focused current set (Liftosaur)**
- A horizontal **thumbnail strip** of exercises runs across the top, with progress like `2/5` and checkmarks.
- Below it, one exercise card at a time; you swipe between them.
- The **current set is expanded**, with big Reps and Weight fields and a large checkmark. Other sets collapse to rows.
- Under the active set: **Last, Best and Same-day** results, each with its date ([Liftosaur workout screen](https://www.liftosaur.com/features/workout-screen)).

### Previous-performance hints

- In Hevy the PREVIOUS column shows values like "45kg x 9". **Tapping it copies the values into the set** ([Hevy previous values](https://www.hevyapp.com/features/track-exercises/)).
  - A setting chooses between the last time the exercise was done anywhere and the last time within the same routine ([Hevy settings](https://www.hevyapp.com/features/workout-settings/)).
- When you add an exercise you have done before, Hevy pre-fills the previous sets, weight and reps ([Hevy start empty](https://www.hevyapp.com/features/start-empty-workout/)).

### Set types

- Hevy: tap the **set number** to choose W (warm-up), D (drop set) or F (failure). The letter then replaces the number in the SET column; drop sets show a blue "D" ([Hevy set types](https://www.hevyapp.com/features/workout-set-types/)).
- This shows drop sets without adding a separate control.

### Rest timer

- Completing a set (✓) **starts the rest timer automatically**. This is true in Hevy, Strong and Liftosaur ([Hevy](https://www.hevyapp.com/features/track-workouts/), [Liftosaur](https://www.liftosaur.com/features/workout-screen)).
- Hevy's controls are **±15 s and Skip**, also available in its live activity / lock-screen widget, from which sets can be completed ([Hevy live activity](https://www.hevyapp.com/features/live-activity/)).
- JEFIT uses **one timer panel** that switches to rest after a set, with "no simultaneous displays", and keeps the timer visible when the keyboard is open ([JEFIT](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)).

### Header

- Hevy: stopwatch, volume and sets in a top bar, with **Finish at the top right** ([Hevy](https://www.hevyapp.com/features/track-workouts/)).
- Liftosaur: the header has the elapsed time and pause/play. Notes and muscle info are in a kebab menu ([Liftosaur](https://www.liftosaur.com/features/workout-screen)).

### Finish flow

- Hevy: Finish opens a save-and-review screen (name, notes, photo) ([Hevy](https://www.hevyapp.com/features/track-workouts/)).
- Strong saves immediately, and incomplete exercises are fine ([Strong](https://help.strongapp.io/article/229-my-first-workout)).
- Liftosaur **warns about incomplete sets**, then shows a summary: time, volume, sets and reps, the exercises, a muscle breakdown and new PRs ([Liftosaur](https://www.liftosaur.com/features/workout-screen)).
- HIG says to provide a summary at the end and to discard extremely brief sessions ([HIG Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts)).

### Numeric input

- Show the right keyboard type and use a number formatter ([HIG Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)).
- NN/g: steppers suit **small changes from a sensible default**, need targets of at least about 1 cm, and should be paired with direct typing ([NN/g steppers](https://www.nngroup.com/articles/input-steppers/)).
  - This fits weight and reps, which usually change only slightly from the previous set.

### Recommendation for fitapp (session)

- **Move set entry from the modal to inline rows.** The current FAB plus bottom-sheet logger makes every set modal.
  - Inline rows: `SET | PREV | KG | REPS | ✓`, pre-filled from the previous session, so a typical set costs one tap on ✓.
  - Keep a sheet only for the rarer edits: cardio fields (time and distance), notes, and changing the set type.
- **Drop sets** become a set-type letter in the SET column, following Hevy.
- **Rest timer:** one slim bar pinned above the bottom inset, showing `−15 · 1:24 · +15 · Skip`. It starts on ✓ and is the only timer shown. Mirror it in an Android ongoing notification, the equivalent of Hevy's live activity.
- **FAB:** keep at most one. M3 says the FAB is "the primary action of a screen" ([M3 FAB](https://github.com/material-components/material-components-android/blob/master/docs/components/FloatingActionButton.md)).
  - In a session the primary action is completing sets, so "Add exercise" works better as an end-of-list row, as in Hevy, than as a FAB that covers the last row.
- **Finish** goes in the top app bar, trailing edge. It opens a summary (duration, sets, volume, PRs, "Save as plan"), with a confirmation if sets are unchecked.

---

## 4. Exercise picker

- **Hevy**: search bar, then **two filter buttons: "All Equipment" and "All Muscles"**. Rows have a thumbnail, the name and the muscle, and you can add **several exercises at once** ([Hevy exercise library](https://www.hevyapp.com/features/exercise-library/)).
  - The same picker is used from the routine editor, the live workout and Profile → Exercises ([Hevy custom exercises](https://www.hevyapp.com/features/custom-exercises/)).
- **Liftosaur**:
  - Search matches name *and* equipment, so `incline dumbbell` finds "Incline Bench Press, Dumbbell".
  - One filter button shows the count of active filters, with "Sorted by" and "Filters" summarised under the search bar.
  - Equipment filters show only gear your gym has.
  - Muscles can be filtered by group or by individual muscle.
  - Multi-select uses circles and a sticky "Add to this workout (2)" button.
  - "Similar muscles" sorting is used when swapping ([Liftosaur exercise library](https://www.liftosaur.com/features/exercise-library)).
- **M3 chips**: filter chips "use tags or descriptive words to filter content"; a chip group can be one horizontally scrolling line ([M3 Chip](https://github.com/material-components/material-components-android/blob/master/docs/components/Chip.md)).
- **Recents.** I could not confirm from a primary source that Hevy or Strong has a dedicated "Recent" section in the picker. Hevy does pre-fill history when you add a known exercise.
  - **Recommendation for fitapp:** a "Recent" group at the top while the search is empty is low-cost and useful for four users with stable routines.

**Recommendation for fitapp (picker):** one picker component reused in three places: session add, plan editor, and the library.
- **Top:** a search field.
- **Below it:** one horizontally scrolling line of filter chips, "Muscle ▾" and "Equipment ▾"; each opens a single-select list in a sheet.
- **List:** a "Recent" group, then A–Z. Each row is a two-line item: name, then "Chest · Barbell".
- **Bottom:** multi-select, with a sticky "Add (3)" button.

---

## 5. Create/edit exercise form

**Fields in the market**
- Hevy's custom exercise fields: image, name, equipment, primary muscle, secondary muscles, exercise type ([Hevy custom exercises](https://www.hevyapp.com/features/custom-exercises/)).
- Hevy's types include weight & reps, bodyweight reps, weighted or assisted bodyweight, duration, and distance & duration ([Hevy bodyweight types](https://help.hevyapp.com/hc/en-us/articles/38386262243223-Bodyweight-Exercises-in-Hevy-Bodyweight-vs-Assisted-vs-Weighted)).
- I could not confirm from a primary source exactly how Hevy and Strong render these pickers.

**What the design systems say**
- **Row-and-picker forms suit long lists.** HIG recommends pickers for medium-to-long lists with predictable order ([HIG Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)). HIG Lists: a disclosure indicator reveals the next level ([HIG Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)).
  - The resulting pattern: a grouped list of rows ("Primary muscle · Chest ›"), each opening a list.
- **Segmented control for the type.** M3 segmented buttons suit up to 5 options; "for more than five items, use chips" ([Android segmented button](https://developer.android.com/develop/ui/compose/components/segmented-button)).
  - HIG: no more than about 5 segments on iPhone, and noun labels ([HIG Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)).
  - Weight / Bodyweight / Cardio fits that. Reps vs Timer is a second, conditional 2-segment control.
- **Muscles and equipment.** The muscle taxonomy has well over 5 options. M3 chips can be multi-select, but a chip wall that wraps across many rows is the "overloaded" look.
  - **Recommendation for fitapp:**
    - Primary muscle: a row that opens a single-select list.
    - Secondary muscles: a row whose value is a summary ("Triceps, Front delts"). It opens a multi-select checklist in a sheet, grouped by muscle group.
    - Equipment: a single-select row.
  - This keeps the form to about 6 rows on one screen.
- **Sheet discipline.** HIG says to show one sheet at a time and to close the first before opening another ([HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)). On Android, open the muscle list as a *full-screen* destination, or replace the sheet's contents; do not stack a sheet on a sheet.
- **Buttons.** In iOS sheets, Cancel goes on the leading edge and Done/Save on the trailing edge ([HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)). On Android, Save goes in the top app bar or as one full-width filled button.
- **Photo.** A small leading thumbnail row ("Add photo"), not a large hero.

---

## 6. Exercise library and exercise detail

- **Strong exercise detail** has four tabs ([Strong exercise detail](https://help.strongapp.io/article/237-about-exercise-detail), [Strong records](https://help.strongapp.io/article/216-exercise-records-screen)):
  - **About:** instructions.
  - **History:** every workout with the exercise.
  - **Charts:** varies by exercise type.
  - **Records:** all-time bests, best per rep count and a predicted best; limited to sets of 12 reps or fewer to avoid inflated estimated 1RMs.
- **Hevy exercise detail** has Summary, History and How-to tabs ([Hevy gym performance](https://www.hevyapp.com/features/gym-performance/)).
  - Summary has separate graphs for heaviest weight, 1RM, best-set volume, session volume and most reps, with ranges of 30 days, 3 months, 1 year and all time. Set records are listed per rep target.
  - "Tap any record to see the workout where it occurred".
- **Liftosaur exercise screen**: muscle info (target and synergist), PRs (Max Weight and Max 1RM, each with the set and date behind it), history filters and a graph ([Liftosaur exercise library](https://www.liftosaur.com/features/exercise-library)).

**Recommendation for fitapp (library and detail)**
- **Library list:** a two-line row: name, then "Primary · Equipment".
  - Reordering should be an explicit "Edit/Reorder" mode, which HIG notes iOS requires before selecting table items ([HIG Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)), not always-on drag handles.
  - Put CSV import/export in the overflow menu.
- **Detail:**
  - Header: name plus a muscle/equipment line.
  - **A one-line PR summary** ("Best 100 kg × 5 · e1RM 112 kg").
  - One line chart, with a segmented time range of up to 4 segments.
  - The history list below.
  - Show a single chart with a metric switcher, not five charts.

---

## 7. History and calendar

- **Liftosaur**: history is a reverse-chronological feed of cards ([Liftosaur history](https://www.liftosaur.com/features/workout-history)).
  - Each card has the date and day name, **one row per exercise** with its sets, a trophy for PRs, and a footer with time, weight, sets and reps.
  - The week strip at the top opens a month calendar with per-month counts ("12 workouts · 3 PRs").
- **Hevy calendar**: workout days are highlighted, it can be viewed by month, year or multiple years, the weekly streak is at the top, and tapping a day opens the workout ([Hevy gym progress](https://www.hevyapp.com/features/gym-progress/)).
- **Google Fit Journal**: grouped by day, with per-day totals as headers ([9to5Google](https://9to5google.com/2018/08/22/hands-on-google-fit-redesign/)).

**Recommendation for fitapp (history)**
- Put a segmented control in the app bar, `List | Calendar`; HIG endorses this for switching between related subviews ([HIG Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)).
- List: sticky month headers with a count, and each workout row shows its name, date, duration and a top-3 exercise summary.
- Calendar: dots on workout days; tapping a day filters the list below.
- Workout detail follows the session layout in read-only form, with Edit in the overflow menu.

---

## 8. Empty states and onboarding

- **NN/g** says an empty state should do three jobs: communicate status, teach in context, and give a direct pathway to the key task. Never leave it blank ([NN/g Empty states](https://www.nngroup.com/articles/empty-state-interface-design/)).
- **HIG Onboarding** ([HIG Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)):
  - Teach by doing.
  - Prefer context-specific tips to a single tour, and make any tutorial optional.
  - "Postpone nonessential setup flows"; provide sensible defaults.
- **Liftosaur's first run** ([Liftosaur first run](https://www.liftosaur.com/features/first-run-and-settings)):
  - Units → gym equipment → plates → choose a program, or "run ad hoc workouts".
  - Contextual tours on the workout screen and editors until you have finished 4 workouts, replayable from "?" icons.

**Recommendation for fitapp (empty states)**
- First launch: ask only for units, then land on the dashboard.
- Empty states, one line plus one button:
  - No workouts: "No workouts yet" · Start workout.
  - No plans: "Save a workout as a plan, or create one" · New plan.
  - Empty session: "Add your first exercise" · Add exercise.
- No illustrations bigger than the button, and no multi-slide carousel.

---

## 9. Typography, spacing, density, colour and dark mode (gym context)

### Tap targets

- M3 / Android: at least **48×48 dp**, about 9 mm, with **8 dp** between targets ([M3 accessibility structure](https://m3.material.io/foundations/designing/structure); summarised from the search snippet because the page is client-rendered).
- HIG: at least **44×44 pt** ([HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- NN/g steppers: about 1 cm ([NN/g](https://www.nngroup.com/articles/input-steppers/)).
- A practitioner's gym-app write-up uses 48 px minimum targets, everything important in thumb reach, and haptics "so you get confirmation even with sweaty hands" ([OpenTrainer, DEV](https://dev.to/magnificode/building-opentrainer-real-time-workout-tracking-with-convex-and-nextjs-59h4)). This is a secondary source.
- **Recommendation for fitapp:** make the ✓ and the weight/reps cells at least 48 dp tall, and put primary actions in the bottom half.

### Type

- M3 type scale: Display / Headline / Title / Body / Label. Display is for "short, important text or numerals" ([Material 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)).
- HIG Typography ([HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography)):
  - Avoid light weights.
  - Minimise the number of typefaces.
  - Build hierarchy with weight, size and colour.
  - Support Dynamic Type and larger text sizes.
- **Recommendation for fitapp:**
  - One family, about 4 roles: screen title, section title, body, label.
  - Use **tabular (monospaced) numerals** for timers and set tables so digits don't jitter. This one is my inference.
  - Render the rest timer and current-set numbers at Headline or Display size.

### Lists and density

- M3 lists are one-, two- or three-line items: "Keep items short and easy to scan" ([M3 List](https://github.com/material-components/material-components-android/blob/master/docs/components/List.md)).
- HIG Lists: keep row text succinct; the grouped style uses headers and space to separate groups ([HIG Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)).
- HIG Layout: use alignment and indentation for hierarchy, and group related items with negative space or separators ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)).
- **Recommendation for fitapp:** prefer full-width list rows with hairline dividers or grouped sections to "card in card" layouts. Use one 4/8 dp spacing scale, consistent with your memory note that parents own spacing through `gap`.

### Top app bars

- M3: use the *small* app bar for dense layouts; medium/large flexible bars "emphasize the headline" and collapse on scroll; lift-on-scroll elevates the bar when content is behind it ([M3 TopAppBar](https://github.com/material-components/material-components-android/blob/master/docs/components/TopAppBar.md)).
- **Recommendation for fitapp:** a large title on the four root tabs that collapses on scroll, and a small bar on every inner screen and in the session.

### Colour and dark mode

- Material dark theme ([Google codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme)):
  - Use **#121212 dark grey, not pure black**.
  - **Desaturate** accent colours, because saturated colours "vibrate" on dark.
  - Show elevation with lighter surfaces.
  - Text emphasis is 87%, 60% and 38%.
- M3 replaces overlays with tonal **surface-container** roles (lowest → highest) ([Flutter ColorScheme](https://api.flutter.dev/flutter/material/ColorScheme-class.html), [M3 elevation](https://m3.material.io/styles/elevation/applying-elevation)).
- HIG Dark mode ([HIG Dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)):
  - Use semantic colours.
  - Contrast of at least 4.5:1, and strive for 7:1 on small text.
  - Avoid an app-only appearance toggle.
- HIG Buttons: use **style, not size**, to mark the preferred choice, and keep the number of prominent buttons small ([HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- **Recommendation for fitapp:**
  - One accent colour, reserved for the primary action and completed state (✓ filled).
  - Neutral surfaces everywhere else.
  - Semantic red only for destructive actions.
  - Muscle-group colour coding only where it carries meaning, such as balance bars, and never as the only cue ([NN/g Dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)).

---

## 10. Motion and micro-interactions

- **HIG Motion** ([HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)):
  - "Add motion purposefully".
  - Keep feedback brief and precise.
  - **Avoid motion on frequent interactions.**
  - Let people cancel animations, and make motion optional (Reduce Motion).
- **M3 motion** ([M3 Motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)):
  - Standard easing is `cubic-bezier(0.2, 0, 0, 1)`; emphasized easing is for expressive moments.
  - Short durations are 50–200 ms and medium 250–400 ms, and duration grows with distance.
  - Patterns:
    - Container transform: card → detail, FAB → sheet.
    - Shared axis: steps and parent/child.
    - Fade-through: tab switches.
    - Fade: dialogs, menus and snackbars.
- **NN/g** ([NN/g Animation duration](https://www.nngroup.com/articles/animation-duration/)):
  - About 100 ms for simple feedback such as checkboxes, 200–300 ms for modals, and avoid going over 500 ms.
  - Ease-out on enter, ease-in on exit.
  - Respect reduce-motion.
- **HIG Haptics** ([HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)):
  - Use system patterns consistently.
  - "Avoid overusing haptics"; prefer short haptics for discrete events.
  - Make them optional.
- **Example of a celebratory moment done well:** Google Fit's rings morph into an octagon once, when the goal is hit ([9to5Google](https://9to5google.com/2018/08/22/hands-on-google-fit-redesign/)).

**Recommendation for fitapp (motion)**
- Set ✓: about 100 ms fill plus a light haptic.
- Rest-timer end: a single stronger haptic plus sound, both optional.
- New PR: a brief badge on the summary only, not mid-set confetti.
- Sheets: about 250–300 ms with standard easing.
- List insert or remove: about 150–200 ms height and opacity.
- No looping or decorative motion.
- Map these to your existing Motion tokens and Appear/Collapsible/ListItemAppear wrappers rather than adding new ones.

---

## Anti-patterns that make fitness apps feel overloaded

1. **Every set entered through a modal.** A sheet opened for each set multiplies taps.
   - Market leaders use inline set rows pre-filled from last time, so a set is one tap on ✓ ([Hevy](https://www.hevyapp.com/features/track-exercises/), [Strong](https://help.strongapp.io/article/229-my-first-workout)).
   - OpenTrainer reduced logging to adjusting the weight and tapping "Log Set" ([DEV](https://dev.to/magnificode/building-opentrainer-real-time-workout-tracking-with-convex-and-nextjs-59h4)).
2. **Secondary actions on the main surface.** Swap, notes and superset shown as inline buttons; JEFIT moved them into a three-dots menu ([JEFIT](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)).
3. **Several timers or panels at once.** JEFIT explicitly moved to a single panel with "no simultaneous displays" ([JEFIT](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)).
4. **A dashboard that is a stack of equal-weight cards.** If nothing is primary, nothing is primary. NN/g: what is on the first screen signals importance, so cut to the frequent items ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)).
5. **Analytics during the session.** HIG: avoid non-relevant information during a workout ([HIG Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts)). Hevy hides PREVIOUS outside live sessions ([Hevy](https://www.hevyapp.com/features/track-exercises/)), and by the same logic you hide extras where they do not belong.
6. **Chip walls for long taxonomies.** More than 5 options, wrapping over many rows, for single choices.
   - Use segmented buttons for 5 or fewer ([Android](https://developer.android.com/develop/ui/compose/components/segmented-button)), and pickers or lists for long sets ([HIG Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)).
7. **Stacked sheets.** A sheet that opens another sheet. HIG: "Display only one sheet at a time" ([HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)).
8. **Many prominent or filled buttons per screen, or several FABs.** HIG: keep prominent buttons few, and distinguish them by style, not size ([HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)). M3: the FAB is the screen's single primary action ([M3 FAB](https://github.com/material-components/material-components-android/blob/master/docs/components/FloatingActionButton.md)).
9. **Pie, donut and gauge charts and colour-only encoding** in summaries. NN/g recommends bars and lines ([NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)).
10. **Over-animation and haptics on every tap.** HIG: avoid motion on frequent interactions and avoid overusing haptics ([HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [HIG Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)).
11. **Oversized cards and whitespace that hide data.** This is the over-correction: Garmin Connect v5 users complained about scrolling to see what used to be at a glance ([Gadgets & Wearables](https://gadgetsandwearables.com/2024/04/24/garmin-connect-new-look/)).
12. **Saturated colours and pure white on pure black** in dark mode. They "vibrate" and cause eye strain ([Google codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme)).
13. **Duplicated information.** The same metric (streak, set count, volume) appears in several places on one screen. This is my synthesis, an application of NN/g's point that what appears signals importance.

---

## Source index

**Products**
- Hevy:
  - [track workouts](https://www.hevyapp.com/features/track-workouts/)
  - [previous values](https://www.hevyapp.com/features/track-exercises/)
  - [settings](https://www.hevyapp.com/features/workout-settings/)
  - [routines](https://www.hevyapp.com/features/gym-routines/)
  - [start empty](https://www.hevyapp.com/features/start-empty-workout/)
  - [exercise library](https://www.hevyapp.com/features/exercise-library/)
  - [custom exercises](https://www.hevyapp.com/features/custom-exercises/)
  - [set types](https://www.hevyapp.com/features/workout-set-types/)
  - [live activity](https://www.hevyapp.com/features/live-activity/)
  - [performance](https://www.hevyapp.com/features/gym-performance/)
  - [progress/calendar](https://www.hevyapp.com/features/gym-progress/)
  - [muscle chart](https://www.hevyapp.com/features/training-chart/)
- Strong:
  - [first workout](https://help.strongapp.io/article/229-my-first-workout)
  - [templates](https://help.strongapp.io/article/105-about-templates)
  - [exercise detail](https://help.strongapp.io/article/237-about-exercise-detail)
  - [records](https://help.strongapp.io/article/216-exercise-records-screen)
  - [profile widgets](https://help.strongapp.io/article/239-profile-widgets)
- Liftosaur:
  - [workout screen](https://www.liftosaur.com/features/workout-screen)
  - [history](https://www.liftosaur.com/features/workout-history)
  - [exercises](https://www.liftosaur.com/features/exercise-library)
  - [program editor](https://www.liftosaur.com/features/program-editor)
  - [first run](https://www.liftosaur.com/features/first-run-and-settings)
- JEFIT: [workout tab / logging redesign](https://www.jefit.com/jefit-news-product-updates/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens/)
- Fitbod: [editing workouts](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod), [recovery](https://fitbod.me/blog/muscle-recovery/)
- Boostcamp: only reviews were found, so it is not used for layout claims ([BarBend](https://barbend.com/boostcamp-review/))
- Apple Fitness: [Summary](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios)
- Google Fit: [9to5Google redesign](https://9to5google.com/2018/08/22/hands-on-google-fit-redesign/)
- Garmin Connect: [DC Rainmaker](https://www.dcrainmaker.com/2024/01/garmin-connect-through.html), [Gadgets & Wearables](https://gadgetsandwearables.com/2024/04/24/garmin-connect-new-look/), [Garmin blog](https://www.garmin.com/en-CA/blog/general/unlocking-the-potential-of-garmin-connect/)

**Design systems**
- Material 3 / Android:
  - [BottomSheet](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md)
  - [Chip](https://github.com/material-components/material-components-android/blob/master/docs/components/Chip.md)
  - [FAB](https://github.com/material-components/material-components-android/blob/master/docs/components/FloatingActionButton.md)
  - [TopAppBar](https://github.com/material-components/material-components-android/blob/master/docs/components/TopAppBar.md)
  - [List](https://github.com/material-components/material-components-android/blob/master/docs/components/List.md)
  - [Motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)
  - [Segmented button](https://developer.android.com/develop/ui/compose/components/segmented-button)
  - [M3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
  - [Dark theme codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme)
  - [Touch targets](https://m3.material.io/foundations/designing/structure)
- Apple HIG:
  - [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
  - [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
  - [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
  - [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
  - [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)
  - [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)
  - [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)
  - [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
  - [Dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
  - [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
  - [Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
  - [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
  - [Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts)

**UX research**
- NN/g:
  - [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  - [Dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)
  - [Empty states](https://www.nngroup.com/articles/empty-state-interface-design/)
  - [Steppers](https://www.nngroup.com/articles/input-steppers/)
  - [Animation duration](https://www.nngroup.com/articles/animation-duration/)
- Practitioner: [OpenTrainer (DEV)](https://dev.to/magnificode/building-opentrainer-real-time-workout-tracking-with-convex-and-nextjs-59h4)
