/**
 * The loading contract shared by screens that read local data on focus:
 * a skeleton is shown until a one-way "has loaded once" latch is set, and
 * post-login hydration extends the skeleton even past that point (a freshly
 * empty local database mid-sync must not masquerade as "no data").
 *
 * This module is the pure decision logic only — no React, no timers. Screens
 * own the `isLoading` / `hasLoadedOnce` state and call these functions from
 * render and from their load-completion handler. See useExercises and
 * WorkoutDashboardScreen for the reference wiring this was extracted from.
 */

export interface SkeletonGateInput {
    /** Post-login sync hydration is in flight; even a non-empty read may be partial. */
    isHydrating: boolean
    /** A load (initial, focus, refresh, or post-sync) is currently in flight. */
    isLoading: boolean
    /** One-way latch: true once the screen's first load has ever completed. */
    hasLoadedOnce: boolean
}

/**
 * Whether the skeleton should be shown instead of real content.
 *
 * Hydration always forces the skeleton. Otherwise the skeleton only shows
 * before the first successful load — a later `isLoading` (focus re-fetch,
 * pull-to-refresh) leaves existing content on screen instead of re-flashing
 * the skeleton, which is what makes a revisit feel instant rather than like
 * starting over.
 */
export const shouldShowSkeleton = ({ isHydrating, isLoading, hasLoadedOnce }: SkeletonGateInput): boolean =>
    isHydrating || (isLoading && !hasLoadedOnce)

/**
 * The one-way latch transition: given the latch's current value and a new
 * "did a load just complete" signal, what's the next latch value.
 *
 * Once true, a latch never returns to false for the life of a mounted
 * screen — a failed or superseded load must not un-set it.
 */
export const nextHasLoadedOnce = (current: boolean, justLoaded: boolean): boolean => current || justLoaded
