import { FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated'

// Motion tokens — the single source of truth for app animation timing.
//
// Keeping enter / exit / layout on shared durations is what unifies the app:
// toggled content fades in and out on the same clock, and the container around
// it reflows over the same window, so neighbours slide into place instead of
// some elements animating while others jump.
//
// Rule of thumb baked into the presets and wrappers (Appear / Collapsible):
//   - entrances may be expressive (use `slow` for screen/section reveals)
//   - exits are always quick (`base`) so content gets out of the way snappily
//   - any region that resizes has ONE layout owner, never nested layout props

export const Duration = {
    fast: 150,
    base: 200,
    slow: 320,
    // Skeleton pulse — one infinite withRepeat opacity loop per skeleton (see
    // SkeletonPulse), not an enter/exit/layout primitive, but still on the one
    // clock so every skeleton breathes in sync.
    shimmer: 800,
} as const

// List/stagger tuning: each item is offset by STEP, capped at MAX so long
// lists don't accumulate a visible lag at the tail.
const STAGGER_STEP_MS = 45
const STAGGER_MAX_INDEX = 8

export const staggerDelay = (index: number) => Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS

// Each helper returns a fresh builder so callers can chain (`.delay(...)`)
// without mutating a shared instance. Hoist the result to a module-level
// constant rather than calling these in a render body — entering/exiting/layout
// props are re-read per render, so a fresh object each render is wasted work.
export const Motion = {
    duration: Duration,

    // --- primitives -------------------------------------------------------
    // Fade in place — content that toggles within a container.
    fadeIn: () => FadeIn.duration(Duration.base),
    fadeOut: () => FadeOut.duration(Duration.base),
    // Fade + slide from below — content appearing in a scroll view.
    fadeInDown: () => FadeInDown.duration(Duration.base),
    fadeOutDown: () => FadeOutDown.duration(Duration.base),
    // Smooth resize / reposition of a container and its neighbours.
    layout: () => LinearTransition.duration(Duration.base),

    // --- presets ----------------------------------------------------------
    // Content sliding into a screen/section on mount.
    screenEnter: () => FadeInDown.duration(Duration.slow),
    // Staggered list/grid item entrance.
    listItem: (index: number) => FadeInDown.delay(staggerDelay(index)).duration(Duration.slow),
}
