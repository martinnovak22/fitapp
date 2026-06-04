# UI Inventory

Evidence-based audit of design-token discipline across the app, to drive UI/UX
unification work. Scanned **82 source files** under `app/` and `src/` (tests,
constants, and theme files excluded from the "leak" counts).

Generated 2026-05-31.

## TL;DR

The foundation is already good: a real theme (`Colors` light/dark), a spacing
scale (`Spacing`), a `useTheme` hook adopted almost everywhere, and a set of core
primitives (`Button`, `Card`, `Typography`, `EmptyState`, `ScreenLayout`, …).

The unification gap is **not color and not spacing** — those are largely
respected. It is:

1. **Typography** — a `Typography` component exists but ~half the screens bypass it with inline `fontSize`/`fontWeight`, and the component itself uses magic numbers (no type-scale token).
2. **Border radius** — no token exists at all; 12 distinct radius values, pill shapes done 3 different ways.
3. **Buttons** — a core `Button` exists but raw `TouchableOpacity` is used in nearly twice as many files.

Fixing these three, in that order, unifies most of the visible inconsistency.

---

## 1. Color — ✅ healthy

- Theme defined in [Colors.ts](src/constants/Colors.ts): full light + dark, semantic names (`text`, `surface`, `primary`, `border`, …).
- `useTheme` adopted everywhere except **3 files**, likely intentional:
  - [landing.tsx](app/landing.tsx) — splash/marketing screen
  - [SyncStatusBanner.tsx](src/data/sync/SyncStatusBanner.tsx)
- **Raw color leaks: tiny.** 6 distinct hex literals, 4 rgba literals across 82 files:

  | value | count | likely intent |
  |-------|-------|---------------|
  | `#000` | 3 | shadow color |
  | `#00000066` / `#00000099` | 2 / 1 | scrim — should be `overlayScrim` token |
  | `#4ADE80` | 1 | a green not in palette |
  | `#B0382F` | 1 | a red not in palette |
  | `#607d8b` | 1 | a gray not in palette |
  | `rgba(255,255,255,0.08..0.18)` | 4 | hairline/overlay — overlaps `surfaceMuted` |

  **Action:** fold the 3 off-palette colors + scrims into `Colors.ts`. ~30 min, low risk. Not urgent.

## 2. Spacing — ✅ healthy

- Scale in [Spacing.ts](src/constants/Spacing.ts): `xs2:2 xs:4 sm:8 md:16 lg:24 xl:32 xl2:40 xxl:48`.
- **231 `Spacing.*` references** vs a handful of raw `padding`/`margin` numbers — most of which are `0` (12×, legitimate).
- Minor off-scale leaks: `6`, `10`, `15`, `20` appear a few times each (not on the 4/8/16/24 scale). Cosmetic; snap to nearest token opportunistically when editing a file. **Not worth a dedicated pass.**

## 3. Typography — ⚠️ primary gap

A `Typography` component exists ([Typography.tsx](src/modules/core/components/Typography.tsx)) with 5 variants: `Title`, `Subtitle`, `Label`, `Meta`, `Body`. But:

- **Adoption is split:** 11 files use `Typography`, **11 files still use raw `<Text>`** with inline styling.
- **69 inline `fontSize` literals** across **9 distinct sizes**: `10, 11, 12, 13, 14, 15, 16, 18, 20`. A type scale should have ~5–6.
- **53 inline `fontWeight` literals** across **5 variants**: `'500' '600' '700' '800' 'bold'` (`'700'` and `'bold'` are the same — pick one).
- **The component itself uses magic numbers**: `Label` hardcodes `fontSize:14/weight:'500'`, `Meta` hardcodes `fontSize:12`, while `Title`/`Subtitle` pull from `GlobalStyles` (24/18). There is **no `FontSize`/`FontWeight` token file** — so even the canonical path isn't token-backed.

**Files bypassing `Typography` with raw `<Text>`:**
`+not-found.tsx`, `ExercisePicker.tsx`, `SyncStatusBanner.tsx`, `WorkoutSetItem.tsx`, `LogSetModal.tsx`, `ExercisesListScreen.tsx`, `ScreenHeader.tsx`, `Button.tsx`, `EmptyState.tsx`, `ExerciseHistoryGraph.tsx`

**Action (highest leverage):**
1. Add a `Typography` token block to constants — `FontSize` (≈5 steps) + `FontWeight` (≈3 steps), collapsing the 9 sizes / 5 weights.
2. Rebuild the `Typography` component variants on those tokens.
3. Migrate the 11 raw-`<Text>` files to `Typography` variants, screen by screen.

## 4. Border radius — ⚠️ no token exists

- **12 distinct radius values:** `1, 2, 3, 4, 6, 8, 10, 12, 14, 20, 22, 100, 999`.
- "Pill / circle" expressed **3 ways**: `borderRadius: 100`, `999`, `22`.
- There is **no `Radius` constant** — every value is a magic number.

**Action:** add `Radius = { sm, md, lg, pill }` to constants (e.g. `4/8/12/9999`), then sweep. Pairs naturally with the typography pass. Medium effort, high visual payoff (card/button/input corners become consistent).

## 5. Buttons & pressables — ⚠️ duplication

- Core [Button.tsx](src/modules/core/components/Button.tsx) used in **8 files**.
- Raw `TouchableOpacity` used in **14 files**; raw `<Pressable>` in 3.

Some `TouchableOpacity` use is legit (list rows, icon taps). But action buttons re-implemented ad-hoc are a unification target.

**Action:** audit the 14 `TouchableOpacity` files; convert anything that's a labelled action button to core `Button`. Defer row/icon taps.

---

## Suggested sequence

| # | Work | Effort | Payoff | Risk |
|---|------|--------|--------|------|
| 1 | Typography tokens + rebuild component | M | High | Low |
| 2 | Migrate 11 raw-`<Text>` files to `Typography` | M | High | Low |
| 3 | Add `Radius` token + sweep | S–M | High | Low |
| 4 | Button consolidation (action buttons only) | M | Med | Med |
| 5 | Fold stray colors/scrims into `Colors` | S | Low | Low |
| 6 | Snap off-scale spacing opportunistically | — | Low | Low |

Steps 1–3 are where "the app feels designed by one person" comes from. They're
pure code-shape work — no device needed. Item 4 is where
`improve-codebase-architecture` earns its keep (the same screens keep
re-implementing buttons → structural, not cosmetic).
